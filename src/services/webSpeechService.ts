/**
 * Browser-Native Web Speech API Helper.
 * Enables zero-download, instant real-time speech-to-text directly in supported browsers
 * (Chrome, Edge, Safari) without any model files or network uploads.
 */

export interface WebSpeechListener {
  onInterimResult: (text: string) => void;
  onFinalResult: (text: string) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

export class WebSpeechRecognizer {
  private recognition: any = null;
  private isListening = false;

  constructor() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
    }
  }

  public static isSupported(): boolean {
    return Boolean(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    );
  }

  public start(language: string, listener: WebSpeechListener) {
    if (!this.recognition) {
      listener.onError('Web Speech API is not supported in this browser.');
      return;
    }

    if (this.isListening) {
      this.stop();
    }

    this.recognition.lang = language && language !== 'auto' ? language : 'en-US';

    this.recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (final) {
        listener.onFinalResult(final);
      }
      if (interim) {
        listener.onInterimResult(interim);
      }
    };

    this.recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        listener.onError(event.error || 'Speech recognition error');
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      listener.onEnd();
    };

    try {
      this.recognition.start();
      this.isListening = true;
    } catch (e: any) {
      listener.onError(e.message || 'Failed to start speech recognition');
    }
  }

  public stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
      this.isListening = false;
    }
  }
}
