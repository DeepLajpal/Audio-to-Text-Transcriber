import React, { useState } from 'react';
import {
  Sparkles,
  CheckSquare,
  Tag,
  MessageSquare,
  Send,
  Loader2,
  X,
  RefreshCw,
  Lightbulb,
  Cpu,
} from 'lucide-react';
import { TranscriptionResult } from '../types';
import {
  extractClientSideInsights,
  findLocalAnswerInTranscript,
} from '../services/localTranscriber';

interface AIInsightsPanelProps {
  result: TranscriptionResult;
  isOpen: boolean;
  onClose: () => void;
  onUpdateResult: (updated: Partial<TranscriptionResult>) => void;
}

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({
  result,
  isOpen,
  onClose,
  onUpdateResult,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [qaHistory, setQaHistory] = useState<Array<{ q: string; a: string; isLocal?: boolean }>>([]);

  if (!isOpen) return null;

  const handleGenerateInsights = async (preferClientSide = false) => {
    setIsGenerating(true);
    setInsightError(null);

    if (preferClientSide) {
      try {
        const localInsights = extractClientSideInsights(result.fullText, result.segments);
        onUpdateResult({
          summary: localInsights.summary,
          actionItems: localInsights.actionItems,
          keyTopics: localInsights.keyTopics,
        });
        setIsGenerating(false);
        return;
      } catch (err: any) {
        console.error('Local insight generation error:', err);
      }
    }

    try {
      const response = await fetch('/api/generate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: result.fullText }),
      });

      if (!response.ok) {
        // Fall back to client-side extractive summarizer
        const localInsights = extractClientSideInsights(result.fullText, result.segments);
        onUpdateResult({
          summary: localInsights.summary,
          actionItems: localInsights.actionItems,
          keyTopics: localInsights.keyTopics,
        });
        setIsGenerating(false);
        return;
      }
      const data = await response.json();

      onUpdateResult({
        summary: data.summary,
        actionItems: data.actionItems,
        keyTopics: data.keyTopics,
      });
    } catch (err: any) {
      console.warn('Cloud insights failed, falling back to on-device insights:', err);
      try {
        const localInsights = extractClientSideInsights(result.fullText, result.segments);
        onUpdateResult({
          summary: localInsights.summary,
          actionItems: localInsights.actionItems,
          keyTopics: localInsights.keyTopics,
        });
      } catch {
        setInsightError(err?.message || 'Failed to generate summary. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isAsking) return;

    const userQ = question.trim();
    setQuestion('');
    setIsAsking(true);

    try {
      const response = await fetch('/api/ask-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: result.fullText, question: userQ }),
      });

      if (!response.ok) {
        // Fallback to local on-device transcript search
        const localAnswer = findLocalAnswerInTranscript(result.segments, result.fullText, userQ);
        setQaHistory((prev) => [...prev, { q: userQ, a: localAnswer, isLocal: true }]);
        return;
      }
      const data = await response.json();
      setQaHistory((prev) => [...prev, { q: userQ, a: data.answer }]);
    } catch (err: any) {
      console.warn('Cloud Q&A failed, falling back to on-device transcript analysis:', err);
      const localAnswer = findLocalAnswerInTranscript(result.segments, result.fullText, userQ);
      setQaHistory((prev) => [...prev, { q: userQ, a: localAnswer, isLocal: true }]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div
      id="ai-insights-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-xs"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">AI Audio Intelligence</h2>
              <p className="text-xs text-zinc-500">
                Executive summary, action items, and conversational Q&amp;A
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {insightError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
              <div className="flex items-center justify-between">
                <p className="font-medium">{insightError}</p>
                <button
                  onClick={handleGenerateInsights}
                  className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-rose-700"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Summary Section */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-700">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                Executive Summary
              </h3>

              <button
                onClick={handleGenerateInsights}
                disabled={isGenerating}
                className="flex items-center gap-1 text-xs font-medium text-purple-700 hover:text-purple-900 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isGenerating ? 'animate-spin' : ''}`} />
                {result.summary ? 'Regenerate' : 'Generate Summary'}
              </button>
            </div>

            {isGenerating ? (
              <div className="flex items-center gap-2 py-4 text-xs text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                Analyzing transcript semantics and drafting summary...
              </div>
            ) : result.summary ? (
              <p className="text-sm leading-relaxed text-zinc-800">{result.summary}</p>
            ) : (
              <p className="text-xs text-zinc-500 italic">
                Click Generate Summary to extract key findings and takeaways from this audio.
              </p>
            )}
          </div>

          {/* Action Items */}
          {result.actionItems && result.actionItems.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
              <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-700">
                <CheckSquare className="h-3.5 w-3.5 text-emerald-600" />
                Action Items &amp; Next Steps
              </h3>
              <ul className="space-y-2">
                {result.actionItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-zinc-800">
                    <input
                      type="checkbox"
                      id={`action-item-${idx}`}
                      className="mt-0.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                    />
                    <label htmlFor={`action-item-${idx}`} className="cursor-pointer leading-snug">
                      {item}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Key Topics */}
          {result.keyTopics && result.keyTopics.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-700">
                <Tag className="h-3.5 w-3.5 text-zinc-500" />
                Key Discussion Topics
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {result.keyTopics.map((topic, idx) => (
                  <span
                    key={idx}
                    className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 shadow-xs"
                  >
                    #{topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Q&A */}
          <div className="rounded-xl border border-zinc-200 p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-700">
              <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
              Ask Questions About This Audio
            </h3>

            {/* Q&A History */}
            {qaHistory.length > 0 && (
              <div className="mb-4 space-y-3 max-h-48 overflow-y-auto pr-1">
                {qaHistory.map((item, idx) => (
                  <div key={idx} className="space-y-1 text-xs">
                    <div className="font-semibold text-zinc-900">Q: {item.q}</div>
                    <div className="rounded-lg bg-zinc-50 p-2.5 leading-relaxed text-zinc-700">
                      {item.a}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Question Input form */}
            <form onSubmit={handleAskQuestion} className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. What was agreed upon for the timeline?"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!question.trim() || isAsking}
                className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {isAsking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Ask</span>
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-zinc-200 p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
