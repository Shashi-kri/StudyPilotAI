import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  Send,
  X,
  Sparkles,
  Mic,
  MicOff,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Clock,
  BookOpen,
  RotateCcw,
  Volume2,
  VolumeX,
  Flame
} from 'lucide-react';
import { api } from '../services/api';

const EXAMPLE_PROMPTS = [
  "Create a 7-day DSA revision plan",
  "Show me my pending tasks",
  "Which topics should I revise next?",
  "Add a one-hour revision session for Operating Systems tomorrow",
  "I have my Computer Networks exam in 10 days",
  "What's my study progress?"
];

// ---------------------------------------------------------------------------
// Speech Synthesis (TTS)
// ---------------------------------------------------------------------------
function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  // Strip markdown bold markers for TTS
  const clean = text.replace(/\*\*/g, '').replace(/\*/g, '');
  const utt = new SpeechSynthesisUtterance(clean);
  utt.rate = 0.95;
  utt.pitch = 1.0;
  utt.volume = 0.9;
  // Prefer a natural-sounding voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Alex')
  ) || voices[0];
  if (preferred) utt.voice = preferred;
  window.speechSynthesis.speak(utt);
}

function stopSpeaking() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function AlexaAssistant({ isOpen, onClose, onNavigate }) {
  const [messages, setMessages] = useState([
    {
      id: 'msg-0',
      sender: 'assistant',
      text: "Hello! I'm your StudyPilot Alexa+ companion. How can I assist your exam preparation today? You can ask me to generate a revision plan, check your pending tasks, or schedule a study session.",
      cardType: null,
      cardData: null,
      suggestedActions: [
        { label: "Create 7-Day DSA Plan", action_type: "chat_query", payload: { query: "Create a 7-day DSA revision plan" } },
        { label: "Show Pending Tasks", action_type: "chat_query", payload: { query: "Show me my pending tasks" } },
        { label: "What should I study next?", action_type: "chat_query", payload: { query: "Which topics should I revise next?" } }
      ],
      generationMode: 'mock'
    }
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [voiceError, setVoiceError] = useState(null);
  const [actionStatus, setActionStatus] = useState({});
  const [interimTranscript, setInterimTranscript] = useState('');

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);

  // Determine if Web Speech API is supported
  const speechSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, scrollToBottom]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      stopSpeaking();
    };
  }, []);

  if (!isOpen) return null;

  // ---------------------------------------------------------------------------
  // Voice Recognition
  // ---------------------------------------------------------------------------
  const startListening = () => {
    if (!speechSupported) {
      setVoiceError('Voice input is not supported in your browser. Please type your question.');
      setTimeout(() => setVoiceError(null), 4000);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceError(null);
      setInterimTranscript('');
      stopSpeaking();
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      setInterimTranscript(interim);
      if (final) {
        setInput(final.trim());
        setInterimTranscript('');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
      // Auto-submit if we captured something
      setTimeout(() => {
        if (inputRef.current?.value?.trim()) {
          const form = inputRef.current.closest('form');
          if (form) form.requestSubmit();
        }
      }, 300);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setInterimTranscript('');
      const errorMessages = {
        'no-speech': 'No speech detected. Please try again.',
        'audio-capture': 'Microphone access denied. Please allow microphone permissions.',
        'not-allowed': 'Microphone access was blocked. Please update browser permissions.',
        'network': 'Network error during speech recognition. Check your connection.',
        'aborted': null // User cancelled — no message needed
      };
      const msg = errorMessages[event.error] ?? `Voice error: ${event.error}`;
      if (msg) {
        setVoiceError(msg);
        setTimeout(() => setVoiceError(null), 5000);
      }
    };

    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setInterimTranscript('');
  };

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // ---------------------------------------------------------------------------
  // Send Message
  // ---------------------------------------------------------------------------
  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg = { id: `user-${Date.now()}`, sender: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    stopSpeaking();

    const history = messages.slice(-6).map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text
    }));

    try {
      const res = await api.sendAssistantChat(query, history);
      const assistantMsg = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        text: res.reply,
        cardType: res.card_type,
        cardData: res.card_data,
        suggestedActions: res.suggested_actions,
        generationMode: res.generation_mode
      };
      setMessages(prev => [...prev, assistantMsg]);
      if (isTtsEnabled) speak(res.reply);
    } catch (err) {
      const errMsg = `Sorry, I encountered an issue: ${err.message}. Please try again.`;
      setMessages(prev => [
        ...prev,
        { id: `ast-err-${Date.now()}`, sender: 'assistant', text: errMsg, cardType: null }
      ]);
      if (isTtsEnabled) speak(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Action Buttons
  // ---------------------------------------------------------------------------
  const handleAction = async (action, msgId) => {
    if (!action) return;

    if (action.action_type === 'chat_query' && action.payload?.query) {
      handleSend(action.payload.query);
      return;
    }
    if (action.action_type === 'navigate' && action.payload?.route) {
      const route = action.payload.route.replace('/', '');
      onNavigate(route || 'dashboard');
      onClose();
      return;
    }
    if (action.action_type === 'create_task' && action.payload) {
      try {
        setActionStatus(prev => ({ ...prev, [msgId]: 'saving' }));
        await api.createTask(action.payload);
        setActionStatus(prev => ({ ...prev, [msgId]: 'saved' }));
        if (isTtsEnabled) speak('Session saved to your schedule!');
      } catch (err) {
        alert(`Error adding session: ${err.message}`);
        setActionStatus(prev => ({ ...prev, [msgId]: 'error' }));
      }
      return;
    }
    if (action.action_type === 'save_plan' && action.payload) {
      try {
        setActionStatus(prev => ({ ...prev, [msgId]: 'saving' }));
        await api.savePlan(action.payload);
        setActionStatus(prev => ({ ...prev, [msgId]: 'saved' }));
        if (isTtsEnabled) speak('Study plan saved! Navigating to your tasks.');
        setTimeout(() => { onNavigate('tasks'); onClose(); }, 1000);
      } catch (err) {
        alert(`Error saving plan: ${err.message}`);
        setActionStatus(prev => ({ ...prev, [msgId]: 'error' }));
      }
      return;
    }
  };

  // ---------------------------------------------------------------------------
  // Priority Badge Color
  // ---------------------------------------------------------------------------
  const priorityColor = (p) =>
    p === 'high' ? 'text-rose-600 bg-rose-50' :
    p === 'medium' ? 'text-amber-600 bg-amber-50' :
    'text-slate-500 bg-slate-100';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col h-[88vh] max-h-[780px] animate-in zoom-in-95 duration-200">

        {/* ── Header ── */}
        <div className="relative px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50">
          <div className="flex items-center gap-3">
            {/* Alexa orb */}
            <div className={`relative flex items-center justify-center w-10 h-10 rounded-2xl shadow-lg shadow-indigo-500/40 ${
              isListening
                ? 'bg-gradient-to-tr from-cyan-400 via-blue-500 to-violet-500 animate-pulse'
                : 'bg-gradient-to-tr from-cyan-500 via-indigo-500 to-violet-500'
            }`}>
              <Bot className="w-5 h-5 text-white" />
              {isListening && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-slate-900 animate-ping" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">Alexa+ Study Companion</h3>
                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                  isListening
                    ? 'bg-red-500/20 text-red-300 border-red-400/30'
                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30'
                }`}>
                  {isListening ? '● Listening' : 'Ready'}
                </span>
              </div>
              <p className="text-xs text-indigo-200">AI-Powered Exam Guidance & Conversational Scheduling</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* TTS toggle */}
            <button
              onClick={() => { setIsTtsEnabled(v => !v); stopSpeaking(); }}
              className="p-1.5 rounded-xl text-indigo-300 hover:text-white hover:bg-white/10 transition-colors"
              title={isTtsEnabled ? 'Mute voice responses' : 'Enable voice responses'}
            >
              {isTtsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => { setMessages([messages[0]]); setActionStatus({}); stopSpeaking(); }}
              className="p-1.5 rounded-xl text-indigo-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => { onClose(); stopSpeaking(); }}
              className="p-1.5 rounded-xl text-indigo-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Close assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Listening / Voice Bar ── */}
        {(isListening || interimTranscript) && (
          <div className="bg-indigo-900/90 text-indigo-100 py-2 px-5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
              {interimTranscript ? (
                <span className="text-cyan-200 italic">"{interimTranscript}"</span>
              ) : (
                'Listening... Speak now'
              )}
            </span>
            <div className="flex items-end gap-0.5 h-5">
              {[0.1, 0.3, 0.2, 0.4, 0.15, 0.35, 0.25].map((delay, i) => (
                <span
                  key={i}
                  className="w-1 bg-cyan-400 rounded-full"
                  style={{
                    height: `${8 + Math.random() * 12}px`,
                    animation: `voiceWave 0.6s ease-in-out infinite alternate`,
                    animationDelay: `${delay}s`
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Voice Error ── */}
        {voiceError && (
          <div className="bg-rose-50 text-rose-700 text-xs px-5 py-2 border-b border-rose-200 flex items-center gap-2">
            <span>⚠️</span> {voiceError}
          </div>
        )}

        {/* ── Messages ── */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const status = actionStatus[msg.id];

            return (
              <div key={msg.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[86%] space-y-2.5 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                  {/* Message bubble */}
                  <div className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm rounded-tr-sm'
                      : 'bg-white text-slate-800 border border-slate-200/80 shadow-xs rounded-tl-sm'
                  }`}>
                    {/* Render bold (**text**) from replies */}
                    {msg.text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                      part.startsWith('**') && part.endsWith('**')
                        ? <strong key={i}>{part.slice(2, -2)}</strong>
                        : part
                    )}
                    {/* TTS replay for assistant messages */}
                    {!isUser && isTtsEnabled && (
                      <button
                        onClick={() => speak(msg.text)}
                        className="ml-2 text-slate-400 hover:text-indigo-500 transition-colors inline-flex items-center"
                        title="Replay response"
                      >
                        <Volume2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* ── Plan Preview Card ── */}
                  {msg.cardType === 'plan_preview' && msg.cardData && (
                    <div className="bg-white border border-indigo-200 rounded-2xl p-4 shadow-sm space-y-3 animate-in fade-in w-full">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-indigo-700">{msg.cardData.plan_title}</span>
                        <span className="text-xs text-slate-500">{msg.cardData.total_hours_planned} hrs • {msg.cardData.tasks_count} sessions</span>
                      </div>
                      <div className="space-y-1.5">
                        {msg.cardData.tasks?.slice(0, 3).map((t, idx) => (
                          <div key={idx} className="p-2 bg-slate-50 rounded-xl text-xs flex items-center justify-between">
                            <div className="truncate pr-2">
                              <p className="font-semibold text-slate-800 truncate">{t.title}</p>
                              <p className="text-[11px] text-slate-400">{t.date} • {t.duration} mins</p>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${priorityColor(t.priority)}`}>
                              {t.priority}
                            </span>
                          </div>
                        ))}
                      </div>
                      {msg.suggestedActions?.map((act, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAction(act, msg.id)}
                          disabled={status === 'saving' || status === 'saved'}
                          className="w-full py-2 px-3 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          {status === 'saved' ? (
                            <><CheckCircle2 className="w-4 h-4 text-emerald-300" /><span>Plan Saved to Tasks!</span></>
                          ) : status === 'saving' ? (
                            <span>Saving tasks...</span>
                          ) : (
                            <><span>{act.label}</span><ArrowRight className="w-3.5 h-3.5" /></>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ── Task List Card ── */}
                  {msg.cardType === 'task_list' && msg.cardData && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2 w-full">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-800">{msg.cardData.title}</span>
                        <span className="text-xs text-slate-500">{msg.cardData.total_count} tasks</span>
                      </div>
                      <div className="space-y-1.5">
                        {msg.cardData.tasks?.map((t) => (
                          <div key={t.id} className="p-2 bg-slate-50 rounded-xl text-xs flex items-center justify-between">
                            <div className="truncate pr-2">
                              <p className="font-semibold text-slate-800 truncate">{t.title}</p>
                              <p className="text-[11px] text-slate-400">{t.subject} • Due {t.date}</p>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${priorityColor(t.priority)}`}>
                              {t.duration}m
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Task Preview Card ── */}
                  {msg.cardType === 'task_preview' && msg.cardData && (
                    <div className="bg-white border border-indigo-200 rounded-2xl p-4 shadow-sm space-y-3 w-full">
                      <div className="space-y-1 text-xs">
                        <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {msg.cardData.subject}
                        </span>
                        <h4 className="font-semibold text-sm text-slate-800">{msg.cardData.title}</h4>
                        <p className="text-slate-500">{msg.cardData.date} • {msg.cardData.duration} minutes</p>
                      </div>
                      {msg.suggestedActions?.map((act, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAction(act, msg.id)}
                          disabled={status === 'saved'}
                          className={`w-full py-2 px-3 text-xs font-semibold rounded-xl transition-colors ${
                            act.action_type === 'create_task'
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {status === 'saved' && act.action_type === 'create_task' ? '✅ Session Added!' : act.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ── Recommendation Card ── */}
                  {msg.cardType === 'recommendation' && msg.cardData && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2 w-full">
                      <h4 className="text-xs font-bold text-slate-800 pb-1 border-b border-slate-100">{msg.cardData.title}</h4>
                      <div className="space-y-2">
                        {msg.cardData.items?.map((it, idx) => (
                          <div key={idx} className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-indigo-900">{it.subject}</span>
                              <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${priorityColor(it.priority)}`}>{it.priority}</span>
                            </div>
                            <p className="font-medium text-slate-700">{it.topic}</p>
                            <p className="text-[11px] text-slate-500">{it.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Metric Card ── */}
                  {msg.cardType === 'metric_card' && msg.cardData && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm w-full">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
                          <p className="text-lg font-bold text-emerald-700">{msg.cardData.completed_tasks}</p>
                          <p className="text-emerald-600">Completed</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-2.5 text-center">
                          <p className="text-lg font-bold text-amber-700">{msg.cardData.pending_tasks ?? (msg.cardData.total_tasks - msg.cardData.completed_tasks)}</p>
                          <p className="text-amber-600">Pending</p>
                        </div>
                        <div className="bg-indigo-50 rounded-xl p-2.5 text-center">
                          <p className="text-lg font-bold text-indigo-700">{msg.cardData.completion_rate}%</p>
                          <p className="text-indigo-600">Completion</p>
                        </div>
                        {msg.cardData.streak_days > 0 && (
                          <div className="bg-orange-50 rounded-xl p-2.5 text-center">
                            <p className="text-lg font-bold text-orange-600 flex items-center justify-center gap-1">
                              <Flame className="w-4 h-4" />{msg.cardData.streak_days}
                            </p>
                            <p className="text-orange-500">Day Streak</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Suggested Action Pills (chat_query / navigate) ── */}
                  {msg.suggestedActions && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {msg.suggestedActions.map((act, idx) => {
                        if (act.action_type === 'chat_query') {
                          return (
                            <button key={idx} onClick={() => handleAction(act, msg.id)}
                              className="px-3 py-1 rounded-full text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 transition-colors">
                              {act.label}
                            </button>
                          );
                        }
                        if (act.action_type === 'navigate') {
                          return (
                            <button key={idx} onClick={() => handleAction(act, msg.id)}
                              className="px-3 py-1 rounded-full text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1">
                              {act.label}<ArrowRight className="w-3 h-3" />
                            </button>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}

                  {/* Generation mode badge */}
                  {!isUser && msg.generationMode && msg.generationMode !== 'mock' && (
                    <span className="text-[10px] text-indigo-400 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> {msg.generationMode}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 items-center text-slate-400 text-xs py-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Quick Prompt Ribbon ── */}
        <div className="px-5 py-2 bg-slate-100/70 border-t border-slate-200/60 overflow-x-auto flex items-center gap-2 text-xs scrollbar-thin">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">Try:</span>
          {EXAMPLE_PROMPTS.slice(0, 4).map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 transition-all text-xs whitespace-nowrap shrink-0 shadow-xs"
            >
              "{prompt}"
            </button>
          ))}
        </div>

        {/* ── Input Bar ── */}
        <div className="p-4 bg-white border-t border-slate-100">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
            {/* Mic button */}
            <button
              type="button"
              onClick={toggleVoice}
              disabled={!speechSupported}
              className={`p-2.5 rounded-xl transition-all shrink-0 ${
                isListening
                  ? 'bg-red-500 text-white ring-2 ring-red-400 ring-offset-1 animate-pulse'
                  : speechSupported
                    ? 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
              }`}
              title={
                !speechSupported ? 'Voice not supported in this browser'
                : isListening ? 'Stop listening'
                : 'Start voice input'
              }
            >
              {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            <input
              ref={inputRef}
              type="text"
              placeholder={isListening ? 'Listening...' : "Ask Alexa+: 'Create a 7-day DSA plan' or 'Show pending tasks'..."}
              value={interimTranscript || input}
              onChange={(e) => { if (!isListening) setInput(e.target.value); }}
              readOnly={isListening}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />

            <button
              type="submit"
              disabled={(!input.trim() && !interimTranscript) || loading}
              className="p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {!speechSupported && (
            <p className="text-[10px] text-slate-400 mt-1.5 text-center">
              Voice input requires Chrome or Edge. Use text input on other browsers.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
