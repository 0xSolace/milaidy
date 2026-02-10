/**
 * Bidirectional voice hook for chat + avatar lip sync.
 *
 * - Speech-to-text via Web Speech API (SpeechRecognition)
 * - Text-to-speech via Web SpeechSynthesis with simulated mouth animation
 * - Provides a `mouthOpen` value (0–1) for driving VRM lip sync
 */

import { useState, useRef, useCallback, useEffect } from "react";

/** Minimal SpeechRecognition interface for cross-browser support */
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionResultEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string; confidence: number } };
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export interface VoiceChatOptions {
  /** Called when a final transcript is ready to send */
  onTranscript: (text: string) => void;
  /** Language for speech recognition (default: "en-US") */
  lang?: string;
}

export interface VoiceChatState {
  /** Whether voice input is currently active */
  isListening: boolean;
  /** Whether the agent is currently speaking */
  isSpeaking: boolean;
  /** Current mouth openness (0-1) for lip sync */
  mouthOpen: number;
  /** Current interim transcript being recognized */
  interimTranscript: string;
  /** Whether Web Speech API is supported */
  supported: boolean;
  /** Toggle voice listening on/off */
  toggleListening: () => void;
  /** Speak text aloud with mouth animation */
  speak: (text: string) => void;
  /** Stop any current speech */
  stopSpeaking: () => void;
}

export function useVoiceChat(options: VoiceChatOptions): VoiceChatState {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [supported, setSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const animFrameRef = useRef<number>(0);
  const speakingStartRef = useRef<number>(0);
  const enabledRef = useRef(false);
  const onTranscriptRef = useRef(options.onTranscript);
  onTranscriptRef.current = options.onTranscript;

  // Check support on mount
  useEffect(() => {
    const SpeechRecognitionAPI: SpeechRecognitionCtor | undefined =
      (window as unknown as Record<string, SpeechRecognitionCtor | undefined>).SpeechRecognition ??
      (window as unknown as Record<string, SpeechRecognitionCtor | undefined>).webkitSpeechRecognition;
    setSupported(!!SpeechRecognitionAPI && !!window.speechSynthesis);
    synthRef.current = window.speechSynthesis ?? null;
  }, []);

  // Mouth animation loop: oscillates naturally while speaking
  useEffect(() => {
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (!isSpeaking) {
        setMouthOpen((prev) => prev * 0.85); // smooth close
        return;
      }
      const elapsed = (Date.now() - speakingStartRef.current) / 1000;
      // Layered sine waves for natural jaw movement (~6-8 Hz range)
      const base = Math.sin(elapsed * 12) * 0.3 + 0.4;
      const detail = Math.sin(elapsed * 18.7) * 0.15;
      const slow = Math.sin(elapsed * 4.2) * 0.1;
      const value = Math.max(0, Math.min(1, base + detail + slow));
      setMouthOpen(value);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isSpeaking]);

  const startRecognition = useCallback(() => {
    const SpeechRecognitionAPI: SpeechRecognitionCtor | undefined =
      (window as unknown as Record<string, SpeechRecognitionCtor | undefined>).SpeechRecognition ??
      (window as unknown as Record<string, SpeechRecognitionCtor | undefined>).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = options.lang ?? "en-US";

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const result = event.results[event.results.length - 1];
      if (!result) return;
      const transcript = result[0].transcript;
      if (result.isFinal && transcript.trim()) {
        setInterimTranscript("");
        onTranscriptRef.current(transcript.trim());
      } else {
        setInterimTranscript(transcript);
      }
    };

    recognition.onerror = (event: { error: string }) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        enabledRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (enabledRef.current) {
        try {
          recognition.start();
        } catch {
          // already started or other error
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      enabledRef.current = true;
      setIsListening(true);
    } catch {
      // failed to start
    }
  }, [options.lang]);

  const stopRecognition = useCallback(() => {
    enabledRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const toggleListening = useCallback(() => {
    if (enabledRef.current) {
      stopRecognition();
    } else {
      startRecognition();
    }
  }, [startRecognition, stopRecognition]);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      const synth = synthRef.current;
      if (!synth || !text.trim()) return;

      // Stop any current speech
      synth.cancel();
      utteranceRef.current = null;

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utteranceRef.current = utterance;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        speakingStartRef.current = Date.now();
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        utteranceRef.current = null;
        setIsSpeaking(false);
      };

      utterance.onerror = () => {
        utteranceRef.current = null;
        setIsSpeaking(false);
      };

      synth.speak(utterance);
    },
    [],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecognition();
      stopSpeaking();
    };
  }, [stopRecognition, stopSpeaking]);

  return {
    isListening,
    isSpeaking,
    mouthOpen,
    interimTranscript,
    supported,
    toggleListening,
    speak,
    stopSpeaking,
  };
}
