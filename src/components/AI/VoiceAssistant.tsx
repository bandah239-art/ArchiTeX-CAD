import React, { useState, useRef, useEffect, useCallback } from 'react';
// import { API_BASE } from '../../services/apiConfig'; // Deprecated, not used
import { buildProceduralObject } from '../../services/proceduralBuilder';
import { getViewer } from '../../services/viewerControls';
import { useCalculationStore } from '../../store/calculationStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { CalculationModule } from '../../types/calculations';

interface ChatResponse {
  reply: string;
  intent?: string;
  action?: {
    calculator_id?: string;
    parameters?: Record<string, unknown>;
    action?: string;
    target_path?: string;
    type?: string;
    dimensions?: Record<string, number>;
    position?: Record<string, number>;
    panel?: string;
    view?: string;
  } | null;
}


type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function MicIcon() {
  return (
    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth="2" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path strokeWidth="2" d="M19 11a7 7 0 0 1-14 0M12 18v3" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth="2" d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9V5a3 3 0 0 0-5.94-.6" />
      <path strokeWidth="2" d="M19 11a7 7 0 0 1-2.16 3.39M5 11a7 7 0 0 0 12 5.1M12 18v3M3 3l18 18" />
    </svg>
  );
}

import { emergingAPI } from '../../services/emergingAPI';

export function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [robotResponse, setRobotResponse] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Preload a voice as soon as synthesis is ready — fixes the Chrome/Electron
  // bug where speak() fires and ends silently before voices are loaded.
  useEffect(() => {
    const synth = synthRef.current;
    if (!synth) return;
    const pickVoice = () => {
      const voices = synth.getVoices();
      if (!voices.length) return;
      // Prefer a natural-sounding English voice
      voiceRef.current =
        voices.find((v) => v.lang.startsWith('en') && v.localService) ??
        voices.find((v) => v.lang.startsWith('en')) ??
        voices[0];
    };
    pickVoice();
    synth.addEventListener('voiceschanged', pickVoice);
    // Fallback: some Windows/Electron builds never fire voiceschanged
    const t1 = setTimeout(pickVoice, 500);
    const t2 = setTimeout(pickVoice, 2000);
    return () => {
      synth.removeEventListener('voiceschanged', pickVoice);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (!synthRef.current || !text) return;
    try {
      synthRef.current.cancel();
      // Resume if paused — needed on some Chromium builds
      if (synthRef.current.paused) synthRef.current.resume();

      const utterance = new SpeechSynthesisUtterance(text);
      activeUtteranceRef.current = utterance; // Prevents GC silent-end bug in Chrome
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      if (voiceRef.current) utterance.voice = voiceRef.current;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => { setIsSpeaking(false); activeUtteranceRef.current = null; };
      utterance.onerror = (e) => {
        // 'interrupted' fires when cancel() is called before end — not a real error
        if ((e as SpeechSynthesisErrorEvent).error !== 'interrupted') {
          console.error('SpeechSynthesisUtterance error', e);
        }
        setIsSpeaking(false);
        activeUtteranceRef.current = null;
      };
      synthRef.current.speak(utterance);
    } catch (err) {
      console.error('Speech synthesis execution failed:', err);
      setIsSpeaking(false);
      activeUtteranceRef.current = null;
    }
  }, []);

  const executeAction = useCallback((intent: string, action: ChatResponse['action']) => {
    if (!action) return;
    if (intent === 'build_3d') {
      buildProceduralObject(getViewer(), {
        type: action.type ?? 'box',
        dimensions: action.dimensions,
        position: action.position,
      });
    } else if (intent === 'calculate') {
      const { calculator_id, parameters } = action;
      useWorkspaceStore.getState().openPanel('calculator');
      if (calculator_id) {
        useCalculationStore.getState().setModule(calculator_id as CalculationModule);
        if (parameters && Object.keys(parameters).length > 0) {
          const calc = useCalculationStore.getState();
          calc.setInputs({ ...calc.currentInputs, ...parameters });
        }
      }
    } else if (intent === 'navigate' && action.panel) {
      const store = useWorkspaceStore.getState();
      store.openPanel(action.panel as Parameters<typeof store.openPanel>[0]);
    } else if (intent === 'switch_view' && action.view) {
      const view = action.view;
      if (view === 'bim' || view === 'gis' || view === 'sld') {
        useWorkspaceStore.getState().setMainView(view);
      }
    } else if (intent === 'os_command') {
      if (window.electronAPI?.osAction) {
        void window.electronAPI.osAction(action.action ?? '', action.target_path);
      }
    }
  }, []);

  // Define processVoiceCommand to use emergingAPI.voice
  const processVoiceCommand = async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setRobotResponse('');
    try {
      const res = await emergingAPI.voice(text);
      const reply = res.action ?? res.command ?? 'Processed';
      setRobotResponse(reply);
      speak(reply);
    } catch (error) {
      console.error('Voice command error:', error);
      const errMsg = 'Voice command failed. Check backend.';
      setRobotResponse(errMsg);
      speak(errMsg);
    } finally {
      setIsProcessing(false);
    }
  };
  // sendMessage forwards to processVoiceCommand for compatibility
  const sendMessage = (text: string) => processVoiceCommand(text);


  // Deprecated alias removed; sendMessage now uses processVoiceCommand directly

  // Speech Recognition setup
  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      console.warn('Speech Recognition API not supported in this browser.');
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? '';
      setTranscript(text);
      void processVoiceCommand(text);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
      setIsProcessing(false);
      if (event.error === 'not-allowed') {
        setRobotResponse('Microphone permission was denied. Please allow microphone access in your browser settings.');
        speak('Microphone permission was denied.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch (e) {
        // ignore
      }
    };
  }, [processVoiceCommand, speak]);

  // Cancel speaking on unmount
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const toggleListen = () => {
    // If the robot is still speaking, stop it first
    if (isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setRobotResponse('');
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch {
        setRobotResponse('Could not start microphone.');
        speak('Could not start the microphone.');
      }
    }
  };

  const hasSpeech = !!getSpeechRecognitionCtor();

  const handleTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = typedInput.trim();
    if (!text) return;
    setTranscript(text);
    setTypedInput('');
    void sendMessage(text);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end justify-end space-y-2 pointer-events-none">
      {/* Response bubble */}
      {(transcript || isProcessing || robotResponse) && (
        <div className="bg-slate-800/95 backdrop-blur text-slate-200 p-3 rounded-lg shadow-xl max-w-xs text-sm pointer-events-auto border border-slate-700">
          {isProcessing ? (
            <div className="flex items-center space-x-2 text-indigo-400">
              <span className="inline-block w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <span>Processing...</span>
            </div>
          ) : (
            <>
              {transcript && <p className="text-gray-400 italic text-xs mb-1">"{transcript}"</p>}
              {robotResponse && (
                <div className="flex items-start gap-2">
                  {isSpeaking && (
                    <span className="mt-0.5 flex gap-[2px] flex-shrink-0">
                      <span className="w-1 h-3 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-4 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                  <p className="text-indigo-300 whitespace-pre-wrap">{robotResponse}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Text chat panel */}
      {chatOpen && (
        <form
          onSubmit={handleTypedSubmit}
          className="pointer-events-auto flex items-center gap-2 bg-slate-800/95 backdrop-blur border border-slate-700 rounded-xl px-3 py-2 shadow-xl w-72"
        >
          <input
            ref={inputRef}
            type="text"
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
            placeholder="Ask ARCH anything…"
            disabled={isProcessing}
            className="flex-1 bg-transparent text-slate-200 text-sm outline-none placeholder-slate-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isProcessing || !typedInput.trim()}
            className="text-indigo-400 hover:text-indigo-300 disabled:opacity-30 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
          </button>
        </form>
      )}

      {/* FAB row */}
      <div className="pointer-events-auto flex items-center gap-2">
        {/* Chat toggle button */}
        <button
          type="button"
          onClick={() => {
            setChatOpen((v) => !v);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          title="Type a message"
          className={`flex items-center justify-center w-10 h-10 rounded-full shadow-xl transition-all duration-300 ${
            chatOpen ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-700 hover:bg-slate-600'
          }`}
        >
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        {/* Mic FAB — only shown when speech recognition is available */}
        {hasSpeech && (
          <button
            type="button"
            onClick={toggleListen}
            disabled={isProcessing}
            className={`flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-300 ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 animate-pulse ring-4 ring-red-500/30'
                : isProcessing
                  ? 'bg-slate-600 cursor-wait'
                  : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'
            }`}
          >
            {isListening ? <MicOffIcon /> : <MicIcon />}
          </button>
        )}
      </div>
    </div>
  );
}
