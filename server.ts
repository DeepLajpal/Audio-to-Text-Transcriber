import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

// Increase payload limits for base64 audio and JSON bodies
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

// Ensure temporary upload directory exists
const UPLOAD_DIR = path.join("/tmp", "audio-transcribe-uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (e) {
    console.error("Could not create upload directory:", e);
  }
}

// Configure multer for disk storage with NO FILE SIZE LIMIT
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || ".audio";
    cb(null, `upload-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    // UNLIMITED upload file size (set to 50 GB ceiling to prevent overflow while allowing virtually unbounded files)
    fileSize: 50 * 1024 * 1024 * 1024,
    files: 1,
  },
});

// Initialize Gemini Client (lazily guarded for safety)
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in the environment.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function resolveAudioMimeType(fileName: string, detectedMime?: string): string {
  const ext = path.extname(fileName).toLowerCase();

  // For Gemini Files API and audio decoding, M4A is an MPEG-4 audio container
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".mp3") return "audio/mp3";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".aac") return "audio/aac";
  if (ext === ".flac") return "audio/flac";
  if (ext === ".ogg" || ext === ".oga") return "audio/ogg";
  if (ext === ".webm" || ext === ".weba") return "audio/webm";
  if (ext === ".mp4") return "audio/mp4";

  if (detectedMime && detectedMime !== "application/octet-stream" && detectedMime.includes("/")) {
    if (detectedMime === "audio/x-m4a" || detectedMime === "audio/m4a") return "audio/mp4";
    return detectedMime;
  }

  const mimeMap: Record<string, string> = {
    ".mp3": "audio/mp3",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".flac": "audio/flac",
    ".webm": "audio/webm",
    ".weba": "audio/webm",
    ".wma": "audio/x-ms-wma",
    ".mp4": "audio/mp4",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
  };
  return mimeMap[ext] || "audio/mp3";
}

function parseTranscriptionText(rawText: string) {
  // Strip out any markdown code fences if generated
  const cleaned = rawText.replace(/```[a-z]*\n?/gi, "").trim();
  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  const segments = [];
  let currentSpeaker = "Speaker 1";
  let segmentCount = 0;

  for (const line of lines) {
    // Check for [MM:SS] or [HH:MM:SS] or MM:SS at the start of the line
    const timestampMatch = line.match(/^(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\]|(\d{1,2}:\d{2}(?::\d{2})?))\s*[-:]?\s*/);
    let remaining = line;
    let timestampStr = "";

    if (timestampMatch) {
      timestampStr = timestampMatch[1] || timestampMatch[2] || "";
      remaining = line.slice(timestampMatch[0].length).trim();
    }

    // Check if remaining starts with a speaker: [Speaker Name]: or Speaker Name:
    const speakerMatch = remaining.match(/^(?:\[([^\]]+)\]|([A-Za-z0-9_\s]{1,30})):\s*/);
    let text = remaining;
    if (speakerMatch) {
      const candidateSpeaker = (speakerMatch[1] || speakerMatch[2] || "").trim();
      if (candidateSpeaker && candidateSpeaker.length <= 30 && !candidateSpeaker.includes(".")) {
        currentSpeaker = candidateSpeaker;
        text = remaining.slice(speakerMatch[0].length).trim();
      }
    }

    if (!text || text.length < 1) continue;

    // Convert timestamp string to seconds
    let seconds = 0;
    if (timestampStr) {
      const parts = timestampStr.split(":").map(Number);
      if (parts.length === 3) seconds = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
      else if (parts.length === 2) seconds = (parts[0] || 0) * 60 + (parts[1] || 0);
    } else {
      seconds = segmentCount * 5;
      const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
      const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
      timestampStr = `${mins}:${secs}`;
    }

    segmentCount++;
    segments.push({
      id: `seg-${segmentCount}`,
      timestamp: timestampStr,
      startSeconds: seconds,
      speaker: currentSpeaker,
      text: text,
    });
  }

  if (segments.length === 0 && cleaned.length > 0) {
    const sentences = cleaned.match(/[^.!?]+[.!?]+(\s|$)/g) || [cleaned];
    return sentences.map((sentence, idx) => ({
      id: `seg-${idx + 1}`,
      timestamp: `00:${(idx * 5).toString().padStart(2, "0")}`,
      startSeconds: idx * 5,
      speaker: "Speaker 1",
      text: sentence.trim(),
    }));
  }

  return segments;
}

/**
 * Robust multi-model cascade for transcription.
 * Tests models in sequence until a non-empty, high-fidelity transcript is produced.
 */
async function transcribeAudioWithGemini(
  ai: GoogleGenAI,
  audioPart: any,
  promptInstructions: string
): Promise<string> {
  const modelsToTry = [
    {
      name: "gemini-3.6-flash",
      config: {},
    },
    {
      name: "gemini-3.5-flash",
      config: {},
    },
    {
      name: "gemini-3.1-flash-lite",
      config: {},
    },
  ];

  let lastError: any = null;

  for (const m of modelsToTry) {
    try {
      console.log(`[Audio Transcribe] Trying model ${m.name}...`);
      const response = await ai.models.generateContent({
        model: m.name,
        contents: [
          audioPart,
          { text: promptInstructions }
        ],
        config: m.config,
      });

      const text = response.text?.trim() || "";
      if (text.length > 0 && !text.includes("[NO_SPEECH]")) {
        console.log(`[Audio Transcribe] Model ${m.name} succeeded (${text.length} characters)`);
        return text;
      }
      console.warn(`[Audio Transcribe] Model ${m.name} returned empty text, trying next fallback...`);
    } catch (err: any) {
      console.warn(`[Audio Transcribe] Model ${m.name} failed (${err?.message}), trying next fallback...`);
      lastError = err;
    }
  }

  // Fallback attempt with gemini-3.5-transcribe
  try {
    console.log(`[Audio Transcribe] Trying model: gemini-3.5-transcribe...`);
    const response = await ai.models.generateContent({
      model: "gemini-3.5-transcribe",
      contents: {
        parts: [
          audioPart,
          { text: promptInstructions }
        ]
      }
    });
    const text = response.text?.trim() || "";
    if (text.length > 0) {
      return text;
    }
  } catch (transcribeErr: any) {
    console.warn(`[Audio Transcribe] gemini-3.5-transcribe failed:`, transcribeErr?.message);
    if (!lastError) lastError = transcribeErr;
  }

  if (lastError) {
    throw lastError;
  }
  return "";
}

/**
 * Robust multi-model generator for JSON insights
 */
async function generateJsonWithGemini<T>(
  ai: GoogleGenAI,
  prompt: string,
  fallbackDefault: T
): Promise<T> {
  const modelsToTry = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
  ];

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[Generate Insights JSON] Trying model ${modelName}...`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const raw = response.text?.trim() || "";
      if (raw) {
        const parsed = JSON.parse(raw);
        console.log(`[Generate Insights JSON] Model ${modelName} succeeded.`);
        return parsed as T;
      }
    } catch (err: any) {
      console.warn(`[Generate Insights JSON] Model ${modelName} failed (${err?.message}), attempting fallback...`);
      lastError = err;
    }
  }

  if (lastError) {
    console.error("[Generate Insights JSON] All models in cascade failed:", lastError);
    throw lastError;
  }
  return fallbackDefault;
}

/**
 * Robust multi-model generator for conversational Q&A
 */
async function askQuestionWithGemini(
  ai: GoogleGenAI,
  prompt: string
): Promise<string> {
  const modelsToTry = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
  ];

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[Ask Question] Trying model ${modelName}...`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });

      const raw = response.text?.trim() || "";
      if (raw) {
        console.log(`[Ask Question] Model ${modelName} succeeded.`);
        return raw;
      }
    } catch (err: any) {
      console.warn(`[Ask Question] Model ${modelName} failed (${err?.message}), attempting fallback...`);
      lastError = err;
    }
  }

  if (lastError) {
    console.error("[Ask Question] All models in cascade failed:", lastError);
    throw lastError;
  }
  return "Could not generate an answer at this time.";
}

// ---------------- API ROUTES ----------------

// Health check and feature capability information (supports root /health, /_health, and /api/health)
app.get(["/health", "/api/health", "/_health"], (req, res) => {
  res.json({
    status: "ok",
    service: "Audio to Text Transcriber API",
    noLimitUploads: true,
    maxUploadLimit: "Unlimited (streaming multipart up to 50 GB)",
    supportedFormats: [
      "mp3", "wav", "m4a", "aac", "ogg", "flac", "webm", "wma", "mp4", "mov", "mkv"
    ],
    timestamp: new Date().toISOString(),
  });
});

// Transcribe an uploaded audio file of ANY size
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file provided." });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname || "audio-recording";
  const fileSize = req.file.size;
  const mimeType = resolveAudioMimeType(originalName, req.file.mimetype);

  const {
    language = "auto",
    detectSpeakers = "true",
    timestampGranularity = "detailed",
    customVocabulary = "",
  } = req.body;

  console.log(`Received upload: ${originalName}, Size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB, Mime: ${mimeType}`);

  let uploadedGeminiFile: { name: string; uri: string; mimeType: string } | null = null;
  const ai = getGeminiClient();

  try {
    // For all files (large or small), upload via Gemini Files API for robust zero-limit processing
    console.log(`Uploading file to Gemini Files API (${originalName}, ${mimeType})...`);
    const fileUploadResult = await ai.files.upload({
      file: filePath,
      config: {
        mimeType,
      },
    });
    uploadedGeminiFile = {
      name: fileUploadResult.name,
      uri: fileUploadResult.uri,
      mimeType: fileUploadResult.mimeType || mimeType,
    };
    console.log(`Gemini File uploaded: ${uploadedGeminiFile.name}, initial state: ${fileUploadResult.state}`);

    // Wait until file is ACTIVE (essential for large audio files like 27MB m4a)
    let fileObj = await ai.files.get({ name: fileUploadResult.name });
    let attempts = 0;
    const maxAttempts = 60; // Up to 60 seconds
    while (fileObj.state === "PROCESSING" && attempts < maxAttempts) {
      console.log(`Waiting for Gemini file ${fileUploadResult.name} to become ACTIVE (current: ${fileObj.state}, poll ${attempts + 1})...`);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      fileObj = await ai.files.get({ name: fileUploadResult.name });
      attempts++;
    }

    if (fileObj.state === "FAILED") {
      throw new Error(`Gemini audio processing failed: ${fileObj.error?.message || "File could not be decoded"}`);
    }

    // Build the transcription prompt
    const promptInstructions = [
      "You are an expert, professional verbatim speech-to-text transcription engine.",
      "PRIMARY DIRECTIVE: Accurately listen to and transcribe EVERY spoken word in this audio file.",
      "Linguistic Fidelity: The audio may be in English, Hindi, Hinglish (mixed Hindi-English), or other languages, with regional accents (e.g. Indian English, American, British, etc.). Faithfully transcribe the spoken words in the exact language spoken. Do not translate or summarize unless explicitly instructed.",
      detectSpeakers === "true"
        ? "Speaker Diarization: Identify distinct speakers and label them as [Speaker 1], [Speaker 2], or their identified names if mentioned/introduced (e.g. [Dhruv], [Sir], [Host], etc.)."
        : "Format as continuous speech.",
      "Timestamps: Provide timestamps at the start of each speech segment in the format [MM:SS] (or [HH:MM:SS] for longer recordings).",
      timestampGranularity === "detailed"
        ? "Provide granular timestamps for every phrase, sentence, or natural pause."
        : "Provide timestamps at the start of each speaker turn or paragraph.",
      customVocabulary ? `Vocabulary / Domain Terminology hints: ${customVocabulary}.` : "",
      "Output formatting: Output each line strictly in the following format:",
      "[MM:SS] [Speaker Name]: Spoken text here.",
      "IMPORTANT: Do NOT include introductory greetings, explanations, or markdown codeblocks. Begin directly with the first timestamped transcript line.",
    ]
      .filter(Boolean)
      .join("\n");

    const filePart = {
      fileData: {
        fileUri: uploadedGeminiFile.uri,
        mimeType: uploadedGeminiFile.mimeType,
      },
    };

    let transcriptText = await transcribeAudioWithGemini(ai, filePart, promptInstructions);

    if (!transcriptText || transcriptText.trim().length === 0) {
      transcriptText = "[00:00] [Speaker 1]: [No intelligible speech detected in this audio recording. Please verify audio clarity and volume.]";
    }

    const segments = parseTranscriptionText(transcriptText);

    // Format file size
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(fileSize) / Math.log(k));
    const fileSizeFormatted = `${parseFloat((fileSize / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;

    // Return the completed transcript
    res.json({
      id: `transcript-${Date.now()}`,
      fileName: originalName,
      fileSize,
      fileSizeFormatted,
      createdAt: new Date().toISOString(),
      fullText: transcriptText,
      segments,
      detectedLanguage: language === "auto" ? "Auto-detected" : language,
    });
  } catch (err: any) {
    console.error("Transcription error:", err);
    res.status(500).json({
      error: err?.message || "Failed to transcribe audio file.",
    });
  } finally {
    // Clean up local temp file
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error("Failed to clean up temp file:", e);
      }
    }
    // Clean up uploaded file on Gemini in background
    if (uploadedGeminiFile?.name) {
      ai.files.delete({ name: uploadedGeminiFile.name }).catch((delErr) => {
        console.warn("Could not delete gemini file:", delErr?.message);
      });
    }
  }
});

// Transcribe base64 inline audio (used for live microphone recording)
app.post("/api/transcribe-base64", async (req, res) => {
  const {
    audioBase64,
    mimeType = "audio/webm",
    fileName = "microphone-recording.webm",
    language = "auto",
    detectSpeakers = true,
  } = req.body;

  if (!audioBase64) {
    return res.status(400).json({ error: "Missing audioBase64 data." });
  }

  const ai = getGeminiClient();

  try {
    const promptInstructions = [
      "You are a professional speech-to-text transcription engine.",
      "Task: Transcribe this recorded audio accurately.",
      `Target Language: ${language === "auto" ? "Auto-detect spoken language" : language}.`,
      detectSpeakers
        ? "Identify and label distinct speakers as [Speaker 1], [Speaker 2], etc."
        : "Format as continuous speech.",
      "Include timestamps in the format [MM:SS] at the start of each sentence or speaker change.",
      "Format each line as: [MM:SS] [Speaker Name]: Text",
      "Do NOT add preamble or markdown codeblocks. Output the transcript directly.",
    ].join("\n");

    const audioPart = {
      inlineData: {
        data: audioBase64,
        mimeType,
      },
    };

    let transcriptText = await transcribeAudioWithGemini(ai, audioPart, promptInstructions);

    if (!transcriptText || transcriptText.trim().length === 0) {
      transcriptText = "[00:00] [Speaker 1]: [No clear speech detected in recorded audio.]";
    }

    const segments = parseTranscriptionText(transcriptText);

    // Approximate size from base64
    const approxBytes = Math.floor((audioBase64.length * 3) / 4);
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(Math.max(approxBytes, 1)) / Math.log(k));
    const fileSizeFormatted = `${parseFloat((approxBytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;

    res.json({
      id: `recording-${Date.now()}`,
      fileName,
      fileSize: approxBytes,
      fileSizeFormatted,
      createdAt: new Date().toISOString(),
      fullText: transcriptText,
      segments,
      detectedLanguage: language === "auto" ? "Auto-detected" : language,
    });
  } catch (err: any) {
    console.error("Base64 transcription error:", err);
    res.status(500).json({ error: err?.message || "Failed to transcribe audio recording." });
  }
});

// Generate deep insights, summary, and action items from a transcript
app.post("/api/generate-insights", async (req, res) => {
  const { transcript } = req.body;
  if (!transcript || transcript.trim().length === 0) {
    return res.status(400).json({ error: "Transcript text is required." });
  }

  const ai = getGeminiClient();

  try {
    const prompt = `Analyze this audio transcription and provide:
1. An Executive Summary (3-4 concise sentences)
2. Action Items & Next Steps (bulleted list of specific tasks and owners if mentioned)
3. Key Topics & Highlights (bulleted list of main themes discussed)

Transcript:
"""
${transcript.slice(0, 50000)}
"""

Respond in valid JSON format matching this structure:
{
  "summary": "Concise 3-4 sentence overview of the discussion and outcomes.",
  "actionItems": ["item 1", "item 2"],
  "keyTopics": ["topic 1", "topic 2"]
}`;

    const parsed = await generateJsonWithGemini<{
      summary?: string;
      actionItems?: string[];
      keyTopics?: string[];
    }>(ai, prompt, {
      summary: "Summary generated from transcript.",
      actionItems: [],
      keyTopics: [],
    });

    res.json({
      summary: parsed.summary || "Summary generated from transcript.",
      actionItems: parsed.actionItems || [],
      keyTopics: parsed.keyTopics || [],
    });
  } catch (err: any) {
    console.error("Insights generation error:", err);
    res.status(500).json({ error: err?.message || "Failed to generate insights." });
  }
});

// Q&A / Ask questions about the transcript
app.post("/api/ask-transcript", async (req, res) => {
  const { transcript, question } = req.body;
  if (!transcript || !question) {
    return res.status(400).json({ error: "Transcript and question are required." });
  }

  const ai = getGeminiClient();

  try {
    const prompt = `You are an intelligent assistant reviewing an audio transcript.
Answer the user's question accurately based strictly on the transcript. Quote or mention timestamps if relevant.

Transcript:
"""
${transcript.slice(0, 50000)}
"""

Question: ${question}`;

    const answer = await askQuestionWithGemini(ai, prompt);
    res.json({ answer });
  } catch (err: any) {
    console.error("Q&A error:", err);
    res.status(500).json({ error: err?.message || "Failed to answer question." });
  }
});

// ---------------- VITE & STATIC SERVING ----------------

async function startServer() {
  // Determine if running in production mode:
  // 1. Explicit NODE_ENV === "production"
  // 2. Or executed as compiled bundle in dist/ (e.g. dist/server.cjs)
  // 3. Or when index.html is located in dist/ or current directory without NODE_ENV === "development"
  const isCjsBundle = typeof __filename !== "undefined" && (__filename.endsWith(".cjs") || __filename.includes("dist"));
  const possibleDistDirs = [
    path.join(process.cwd(), "dist"),
    typeof __dirname !== "undefined" ? __dirname : "",
    typeof __dirname !== "undefined" ? path.join(__dirname, "dist") : "",
    path.resolve("dist"),
  ].filter(Boolean);

  const foundDistPath = possibleDistDirs.find((d) => fs.existsSync(path.join(d, "index.html")));
  const hasDistIndex = Boolean(foundDistPath);
  const isProduction =
    process.env.NODE_ENV === "production" ||
    isCjsBundle ||
    (process.env.NODE_ENV !== "development" && hasDistIndex);

  if (isProduction) {
    process.env.NODE_ENV = "production";
    const distPath = foundDistPath || path.join(process.cwd(), "dist");

    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Application files not found.");
      }
    });
  } else {
    // Dynamic import to avoid bundling or loading Vite in production
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (${isProduction ? "production" : "development"})`);
  });
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

startServer().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
