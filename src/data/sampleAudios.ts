export interface PresetSample {
  id: string;
  title: string;
  speakerCount: number;
  duration: string;
  description: string;
  category: string;
  simulatedTranscript: {
    segments: Array<{ timestamp: string; speaker: string; text: string }>;
    summary: string;
    actionItems: string[];
    keyTopics: string[];
  };
}

export const PRESET_SAMPLES: PresetSample[] = [
  {
    id: 'product-sync',
    title: 'Product Launch & Roadmap Sync',
    speakerCount: 3,
    duration: '02:45',
    category: 'Business',
    description: 'Quarterly roadmap alignment discussion covering feature freezes and QA milestones.',
    simulatedTranscript: {
      segments: [
        { timestamp: '00:00', speaker: 'Sarah (Lead)', text: 'Good morning everyone. Thanks for joining today’s product alignment call. We have three main items on the agenda: the finalization of the audio engine, our mobile app QA schedule, and next week’s rollout.' },
        { timestamp: '00:24', speaker: 'Marcus (Engineering)', text: 'On the audio engine side, we completed the chunked streaming pipeline yesterday. It now handles uploads without any size ceiling, and initial latency is down thirty percent.' },
        { timestamp: '00:48', speaker: 'Elena (Design)', text: 'From the design perspective, the transcript viewer with synchronized playback is fully validated with users. The clickable timestamps and speaker labels tested especially well.' },
        { timestamp: '01:15', speaker: 'Sarah (Lead)', text: 'That is tremendous progress. Marcus, can we make sure the automated failover between transcription models is covered in our staging regression suite?' },
        { timestamp: '01:38', speaker: 'Marcus (Engineering)', text: 'Yes, absolutely. We will have the synthetic load test running overnight and share the report in the engineering channel before tomorrow standup.' },
        { timestamp: '02:05', speaker: 'Elena (Design)', text: 'I will also supply the finalized dark and light color tokens for the export modal and audio waveform components today.' },
        { timestamp: '02:28', speaker: 'Sarah (Lead)', text: 'Excellent work team. Let’s reconvene on Thursday to review the staging deployment metrics. Have a great day everyone.' }
      ],
      summary: 'The team reviewed progress on the audio engine, UX synchronization, and QA testing. Engineering confirmed the chunked streaming pipeline with unlimited file sizes is complete and latency is reduced by 30%. QA regression testing will run overnight with staging review set for Thursday.',
      actionItems: [
        'Marcus to run automated load and failover tests overnight and post results in Slack.',
        'Elena to deliver finalized light and dark theme tokens for waveform and export modal.',
        'Team to reconvene Thursday morning for final staging deployment signoff.'
      ],
      keyTopics: ['Audio Streaming Engine', 'QA Regression', 'Transcript Viewer UX', 'Staging Review']
    }
  },
  {
    id: 'ai-lecture',
    title: 'University Lecture: Multimodal AI',
    speakerCount: 1,
    duration: '01:50',
    category: 'Education',
    description: 'Computer Science lecture on cross-attention mechanisms in audio-visual foundation models.',
    simulatedTranscript: {
      segments: [
        { timestamp: '00:00', speaker: 'Prof. Miller', text: 'Welcome back class. Today we transition from discrete natural language processing to continuous continuous-time multimodal foundation architectures.' },
        { timestamp: '00:26', speaker: 'Prof. Miller', text: 'Traditional automatic speech recognition relied heavily on hidden Markov models and connectionist temporal classification. Modern architectures instead map raw acoustic spectrograms directly into unified semantic embedding spaces.' },
        { timestamp: '00:58', speaker: 'Prof. Miller', text: 'Notice how this eliminates the acoustic-phonetic bottleneck. When the model processes context across millions of tokens, it can distinguish homophones simply from the conversational context.' },
        { timestamp: '01:28', speaker: 'Prof. Miller', text: 'For next Tuesday, please read chapter four on temporal convolutions and review the sample code on spectrogram feature extraction.' }
      ],
      summary: 'Prof. Miller covered the evolution of Automatic Speech Recognition (ASR), comparing classical Markov models with modern unified multimodal foundation models that map continuous spectrograms directly into semantic spaces.',
      actionItems: [
        'Read Chapter 4 on temporal convolution networks before Tuesday lecture.',
        'Review spectrogram feature extraction notebook in the course portal.'
      ],
      keyTopics: ['Speech Recognition History', 'Acoustic Spectrograms', 'Semantic Embeddings', 'Homophone Resolution']
    }
  },
  {
    id: 'tech-interview',
    title: 'Podcast: Founder Story & Architecture',
    speakerCount: 2,
    duration: '02:10',
    category: 'Podcast',
    description: 'In-depth interview on scaling distributed audio processing systems and zero-upload-limit storage.',
    simulatedTranscript: {
      segments: [
        { timestamp: '00:00', speaker: 'Host', text: 'Welcome back to Systems at Scale. Today I am sitting down with David, founder of WaveStream. David, tell us about the early architectural hurdles.' },
        { timestamp: '00:22', speaker: 'David', text: 'The hardest technical challenge was definitely handling arbitrary audio payloads. Most HTTP gateways enforce strict 10-megabyte or 50-megabyte request limits. When creators want to transcribe a 3-hour 4K video podcast, traditional APIs simply fail.' },
        { timestamp: '00:54', speaker: 'Host', text: 'And how did you solve the unbounded file problem without crashing server memory?' },
        { timestamp: '01:10', speaker: 'David', text: 'We moved entirely to streaming multipart disk buffers and chunked direct-to-cloud upload. Node never buffers more than 64 kilobytes in RAM at any given moment, which allows us to process 2-gigabyte files effortlessly.' },
        { timestamp: '01:45', speaker: 'Host', text: 'That is truly elegant engineering. Let’s take a short break and then discuss speaker diarization algorithms.' }
      ],
      summary: 'Discussion between host and David regarding architectures for processing unbounded multimedia files. Key focus on overcoming HTTP gateway payload limits through streaming multipart disk buffers with minimal memory footprints.',
      actionItems: [
        'Study streaming multipart buffer configurations for enterprise API gateways.',
        'Prepare follow-up segment on multi-speaker diarization algorithms.'
      ],
      keyTopics: ['HTTP Gateway Limits', 'Streaming Multipart Buffers', 'Large File Upload Architecture', 'Memory Efficiency']
    }
  }
];
