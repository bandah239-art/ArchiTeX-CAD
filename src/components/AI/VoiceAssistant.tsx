import React, { useState, useRef, useEffect, useCallback } from 'react';
import { buildProceduralObject } from '../../services/proceduralBuilder';
import { getViewer } from '../../services/viewerControls';
import { useCalculationStore } from '../../store/calculationStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { CalculationModule } from '../../types/calculations';
import { emergingAPI } from '../../services/emergingAPI';

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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  intent?: string;
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

const INTENT_BADGE: Record<string, { label: string; cls: string }> = {
  calculate:   { label: 'Calculating',    cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  navigate:    { label: 'Navigating',     cls: 'bg-green-500/20 text-green-300 border-green-500/40' },
  switch_view: { label: 'Switching View', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  build_3d:    { label: 'Building 3D',    cls: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  os_command:  { label: 'System',         cls: 'bg-red-500/20 text-red-300 border-red-500/40' },
  clarify:     { label: 'Clarifying',     cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  chat:        { label: 'ARCH',           cls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
};

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

export function VoiceAssistant() {
  const [isListening, setIsListening]     = useState(false);
  const [isProcessing, setIsProcessing]   = useState(false);
  const [isSpeaking, setIsSpeaking]       = useState(false);
  const [chatOpen, setChatOpen]           = useState(false);
  const [typedInput, setTypedInput]       = useState('');
  const [messages, setMessages]           = useState<Message[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [continuousMode, setContinuousMode] = useState(false);

  const inputRef        = useRef<HTMLInputElement>(null);
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const voiceRef        = useRef<SpeechSynthesisVoice | null>(null);
  const recognitionRef  = useRef<SpeechRecognitionLike | null>(null);
  const synthRef        = useRef<SpeechSynthesis>(window.speechSynthesis);
  const activeUtteranceRef  = useRef<SpeechSynthesisUtterance | null>(null);
  const continuousModeRef   = useRef(false);
  const manualStopRef       = useRef(false);
  const processRef      = useRef<(text: string) => Promise<void>>();

  useEffect(() => { continuousModeRef.current = continuousMode; }, [continuousMode]);

  // Auto-scroll messages
  useEffect(() => {
    if (chatOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatOpen]);

  // Preload TTS voice (Chrome/Electron silent-end bug fix)
  useEffect(() => {
    const synth = synthRef.current;
    if (!synth) return;
    const pick = () => {
      const voices = synth.getVoices();
      if (!voices.length) return;
      voiceRef.current =
        voices.find((v) => v.lang.startsWith('en') && v.localService) ??
        voices.find((v) => v.lang.startsWith('en')) ??
        voices[0];
    };
    pick();
    synth.addEventListener('voiceschanged', pick);
    const t1 = setTimeout(pick, 500);
    const t2 = setTimeout(pick, 2000);
    return () => { synth.removeEventListener('voiceschanged', pick); clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const speak = useCallback((text: string) => {
    if (!synthRef.current || !text) return;
    try {
      synthRef.current.cancel();
      if (synthRef.current.paused) synthRef.current.resume();
      const utt = new SpeechSynthesisUtterance(text);
      activeUtteranceRef.current = utt;
      utt.rate = 1.0; utt.pitch = 1.0; utt.volume = 1.0;
      if (voiceRef.current) utt.voice = voiceRef.current;
      utt.onstart = () => setIsSpeaking(true);
      utt.onend   = () => { setIsSpeaking(false); activeUtteranceRef.current = null; };
      utt.onerror = (e) => {
        if ((e as SpeechSynthesisErrorEvent).error !== 'interrupted') console.error('TTS error', e);
        setIsSpeaking(false); activeUtteranceRef.current = null;
      };
      synthRef.current.speak(utt);
    } catch (err) {
      console.error('TTS failed:', err);
      setIsSpeaking(false);
    }
  }, []);

  const executeAction = useCallback((intent: string, action: ChatResponse['action']) => {
    if (!action) return;
    switch (intent) {
      case 'build_3d':
        buildProceduralObject(getViewer(), {
          type: action.type ?? 'box',
          dimensions: action.dimensions,
          position: action.position,
        });
        break;
      case 'calculate':
        useWorkspaceStore.getState().openPanel('calculator');
        if (action.calculator_id) {
          useCalculationStore.getState().setModule(action.calculator_id as CalculationModule);
          if (action.parameters && Object.keys(action.parameters).length > 0) {
            const calc = useCalculationStore.getState();
            calc.setInputs({ ...calc.currentInputs, ...action.parameters });
          }
        }
        break;
      case 'navigate':
        if (action.panel) {
          const store = useWorkspaceStore.getState();
          store.openPanel(action.panel as Parameters<typeof store.openPanel>[0]);
        }
        break;
      case 'switch_view':
        if (action.view === 'bim' || action.view === 'gis' || action.view === 'sld') {
          useWorkspaceStore.getState().setMainView(action.view);
        }
        break;
      case 'os_command':
        void window.electronAPI?.osAction?.(action.action ?? '', action.target_path);
        break;
    }
  }, []);

  const processVoiceCommand = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setLiveTranscript('');
    // Open chat so user can see the exchange
    setChatOpen(true);
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);
    try {
      const res: ChatResponse = await emergingAPI.voice(text);
      const reply  = res.reply  ?? 'Done.';
      const intent = res.intent ?? 'chat';
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', text: reply, intent }]);
      speak(reply);
      if (intent !== 'chat' && intent !== 'clarify') {
        executeAction(intent, res.action ?? null);
      }
    } catch (err) {
      const errMsg = 'Cannot reach backend. Make sure the Python server is running.';
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: 'assistant', text: errMsg }]);
      speak('Cannot reach the backend server.');
      console.error('Voice error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [speak, executeAction]);

  // Keep ref in sync — recognition handler always calls the latest version
  useEffect(() => { processRef.current = processVoiceCommand; }, [processVoiceCommand]);

  // Set up speech recognition ONCE
  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous     = false;
    rec.interimResults = true;   // show live partial transcript
    rec.lang           = 'en-US';

    rec.onresult = (event) => {
      // Show interim results as live transcript
      const partial = event.results[0]?.[0]?.transcript ?? '';
      setLiveTranscript(partial);
      // Only process final result (interimResults=true, results[0] is the current utterance)
      // When recognition ends, onend fires — we finalize there via the last transcript
    };

    rec.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setIsProcessing(false);
      setLiveTranscript('');
      if (event.error === 'not-allowed') {
        setChatOpen(true);
        setMessages((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, role: 'assistant', text: 'Microphone permission denied. Please allow microphone access in your browser/OS settings.' },
        ]);
      }
    };

    rec.onend = () => {
      setIsListening(false);
      // Fire the command with whatever was captured
      const captured = liveTranscriptRef.current.trim();
      if (captured) void processRef.current?.(captured);
      setLiveTranscript('');

      // Restart in continuous mode
      if (continuousModeRef.current && !manualStopRef.current) {
        setTimeout(() => {
          try { rec.start(); setIsListening(true); } catch { /* ignore */ }
        }, 600);
      }
      manualStopRef.current = false;
    };

    recognitionRef.current = rec;
    return () => { try { rec.stop(); } catch { /* ignore */ } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep liveTranscript in a ref so the onend closure can read the latest value
  const liveTranscriptRef = useRef('');
  useEffect(() => { liveTranscriptRef.current = liveTranscript; }, [liveTranscript]);

  useEffect(() => () => { synthRef.current?.cancel(); }, []);

  const toggleListen = () => {
    if (isSpeaking) { synthRef.current.cancel(); setIsSpeaking(false); }
    if (isListening) {
      manualStopRef.current = true;
      recognitionRef.current?.stop();
      setIsListening(false);
      setLiveTranscript('');
    } else {
      setLiveTranscript('');
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch {
        setChatOpen(true);
        setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: 'assistant', text: 'Could not start the microphone.' }]);
      }
    }
  };

  const handleTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = typedInput.trim();
    if (!text) return;
    setTypedInput('');
    void processVoiceCommand(text);
  };

  const hasSpeech = !!getSpeechRecognitionCtor();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-none">

      {/* ── Live transcript bubble while mic is active ── */}
      {isListening && (
        <div className="pointer-events-none bg-slate-800/95 backdrop-blur border border-red-500/40 rounded-lg px-3 py-2 text-xs text-slate-300 max-w-[220px] shadow-lg">
          {liveTranscript ? (
            <span className="text-white italic">"{liveTranscript}"</span>
          ) : (
            <span className="text-red-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              Listening…
            </span>
          )}
        </div>
      )}

      {/* ── Chat panel ── */}
      {chatOpen && (
        <div className="pointer-events-auto w-80 flex flex-col bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-sm font-semibold text-white">ARCH</span>
              <span className="text-xs text-slate-400">Voice AI</span>
            </div>
            <div className="flex items-center gap-1">
              {hasSpeech && (
                <button
                  type="button"
                  onClick={() => setContinuousMode((v) => !v)}
                  title={continuousMode ? 'Continuous mode ON — click to disable' : 'Enable continuous listening'}
                  className={`text-xs px-1.5 py-0.5 rounded transition-colors border ${
                    continuousMode
                      ? 'bg-emerald-700/40 text-emerald-300 border-emerald-600/50'
                      : 'bg-slate-700/50 text-slate-500 border-slate-600/30 hover:text-slate-300'
                  }`}
                >
                  ∞
                </button>
              )}
              <button
                type="button"
                onClick={() => setMessages([])}
                title="Clear history"
                className="text-slate-500 hover:text-slate-300 text-xs px-1.5 py-0.5 rounded hover:bg-slate-700 transition-colors"
              >
                clear
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 max-h-64 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-slate-500 text-xs text-center py-4">
                Say a command or type below.<br />
                <span className="text-slate-600">Try: "open energy panel", "calculate beam", "switch to GIS"</span>
              </p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col gap-0.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.role === 'assistant' && msg.intent && INTENT_BADGE[msg.intent] && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${INTENT_BADGE[msg.intent].cls}`}>
                    {INTENT_BADGE[msg.intent].label}
                  </span>
                )}
                <div className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                  msg.role === 'user' ? 'bg-indigo-600/70 text-white' : 'bg-slate-700/80 text-slate-200'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex items-center gap-2 text-indigo-400 text-xs">
                <span className="inline-block w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <span>ARCH is thinking…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Text input */}
          <form onSubmit={handleTypedSubmit} className="flex items-center gap-2 border-t border-slate-700 px-3 py-2">
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
        </div>
      )}

      {/* ── FAB row — exactly 2 buttons ── */}
      <div className="pointer-events-auto flex items-center gap-2">

        {/* Chat toggle */}
        <button
          type="button"
          onClick={() => {
            setChatOpen((v) => !v);
            setTimeout(() => inputRef.current?.focus(), 60);
          }}
          title={chatOpen ? 'Hide ARCH chat' : 'Open ARCH chat'}
          className={`relative flex items-center justify-center w-10 h-10 rounded-full shadow-xl transition-all duration-300 ${
            chatOpen ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-700 hover:bg-slate-600'
          }`}
        >
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {messages.filter((m) => m.role === 'assistant').length > 0 && !chatOpen && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
              {messages.filter((m) => m.role === 'assistant').length}
            </span>
          )}
        </button>

        {/* Mic FAB */}
        {hasSpeech && (
          <button
            type="button"
            onClick={toggleListen}
            disabled={isProcessing}
            title={isListening ? 'Stop — send command' : 'Speak to ARCH'}
            className={`flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-300 ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 ring-4 ring-red-500/30 animate-pulse'
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
