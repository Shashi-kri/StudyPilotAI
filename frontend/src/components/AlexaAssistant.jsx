import React, { useState, useRef, useEffect } from 'react';
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
  Volume2
} from 'lucide-react';
import { api } from '../services/api';

const EXAMPLE_PROMPTS = [
  "Create a 7-day DSA revision plan",
  "Show me my pending tasks",
  "Which topics should I revise next?",
  "Add a one-hour revision session for operating systems tomorrow",
  "I have my Computer Networks exam in 10 days"
];

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
  const [isSimulatedListening, setIsSimulatedListening] = useState(false);
  const [actionStatus, setActionStatus] = useState({});

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.slice(-4).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

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

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ast-err-${Date.now()}`,
          sender: 'assistant',
          text: `Sorry, I encountered an issue: ${err.message}. Please try again or rephrase.`,
          cardType: null
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Handle action buttons inside cards
  const handleAction = async (action, msgId) => {
    if (!action) return;

    if (action.action_type === 'chat_query' && action.payload?.query) {
      handleSend(action.payload.query);
      return;
    }

    if (action.action_type === 'navigate' && action.payload?.route) {
      const routeClean = action.payload.route.replace('/', '');
      onNavigate(routeClean || 'dashboard');
      onClose();
      return;
    }

    if (action.action_type === 'create_task' && action.payload) {
      try {
        setActionStatus((prev) => ({ ...prev, [msgId]: 'saving' }));
        await api.createTask(action.payload);
        setActionStatus((prev) => ({ ...prev, [msgId]: 'saved' }));
      } catch (err) {
        alert(`Error adding session: ${err.message}`);
        setActionStatus((prev) => ({ ...prev, [msgId]: 'error' }));
      }
      return;
    }

    if (action.action_type === 'save_plan' && action.payload) {
      try {
        setActionStatus((prev) => ({ ...prev, [msgId]: 'saving' }));
        await api.savePlan(action.payload);
        setActionStatus((prev) => ({ ...prev, [msgId]: 'saved' }));
        setTimeout(() => {
          onNavigate('tasks');
          onClose();
        }, 1000);
      } catch (err) {
        alert(`Error saving plan: ${err.message}`);
        setActionStatus((prev) => ({ ...prev, [msgId]: 'error' }));
      }
      return;
    }
  };

  // Simulated Alexa+ Voice Toggle
  const toggleSimulatedVoice = () => {
    if (!isSimulatedListening) {
      setIsSimulatedListening(true);
      // Simulate speech recognition after 2 seconds
      setTimeout(() => {
        setIsSimulatedListening(false);
        const randomPrompt = EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)];
        setInput(randomPrompt);
      }, 1600);
    } else {
      setIsSimulatedListening(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
        aria-hidden="true" 
      />

      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col h-[85vh] max-h-[760px] animate-in zoom-in-95 duration-200">
        
        {/* Alexa+ Inspired Header with Aura */}
        <div className="relative px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50">
          <div className="flex items-center gap-3">
            {/* Glowing Alexa+ Orb */}
            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/40 animate-alexa-pulse">
              <Bot className="w-5 h-5 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-heading tracking-tight">Alexa+ Study Companion</h3>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  Simulated
                </span>
              </div>
              <p className="text-xs text-indigo-200">
                AI-Powered Exam Guidance & Conversational Scheduling
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setMessages([messages[0]]);
                setActionStatus({});
              }}
              className="p-1.5 rounded-xl text-indigo-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-indigo-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Close assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Voice Equalizer simulation bar if active */}
        {isSimulatedListening && (
          <div className="bg-indigo-900/90 text-indigo-100 py-2 px-6 flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              Simulating Alexa+ voice input... Speak now
            </span>
            <div className="flex items-center gap-1">
              <span className="w-1 bg-cyan-400 rounded-full animate-voice-wave" style={{ animationDelay: '0.1s' }} />
              <span className="w-1 bg-cyan-400 rounded-full animate-voice-wave" style={{ animationDelay: '0.3s' }} />
              <span className="w-1 bg-cyan-400 rounded-full animate-voice-wave" style={{ animationDelay: '0.2s' }} />
              <span className="w-1 bg-cyan-400 rounded-full animate-voice-wave" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const status = actionStatus[msg.id];

            return (
              <div 
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] space-y-2.5 ${isUser ? 'items-end' : 'items-start'}`}>
                  {/* Bubble text */}
                  <div 
                    className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      isUser 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm rounded-tr-xs' 
                        : 'bg-white text-slate-800 border border-slate-200/80 shadow-2xs rounded-tl-xs'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Rendered Card Payload (if present) */}
                  {msg.cardType === 'plan_preview' && msg.cardData && (
                    <div className="bg-white border border-indigo-200 rounded-2xl p-4 shadow-sm space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-indigo-700 font-heading">
                          {msg.cardData.plan_title}
                        </span>
                        <span className="text-xs text-slate-500">
                          {msg.cardData.total_hours_planned} hrs ({msg.cardData.tasks_count} sessions)
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {msg.cardData.tasks?.slice(0, 3).map((t, idx) => (
                          <div key={idx} className="p-2 bg-slate-50 rounded-xl text-xs flex items-center justify-between">
                            <div className="truncate pr-2">
                              <p className="font-semibold text-slate-800 truncate">{t.title}</p>
                              <p className="text-[11px] text-slate-400">{t.date} • {t.duration} mins</p>
                            </div>
                            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded shrink-0">
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
                          className="w-full py-2 px-3 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5"
                        >
                          {status === 'saved' ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                              <span>Plan Saved to Tasks!</span>
                            </>
                          ) : status === 'saving' ? (
                            <span>Saving tasks...</span>
                          ) : (
                            <>
                              <span>{act.label}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {msg.cardType === 'task_list' && msg.cardData && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-800 font-heading">
                          {msg.cardData.title}
                        </span>
                        <span className="text-xs text-slate-500">
                          {msg.cardData.total_count} tasks
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {msg.cardData.tasks?.map((t) => (
                          <div key={t.id} className="p-2 bg-slate-50 rounded-xl text-xs flex items-center justify-between">
                            <div className="truncate pr-2">
                              <p className="font-semibold text-slate-800 truncate">{t.title}</p>
                              <p className="text-[11px] text-slate-400">{t.subject} • Due {t.date}</p>
                            </div>
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded shrink-0">
                              {t.duration}m
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.cardType === 'task_preview' && msg.cardData && (
                    <div className="bg-white border border-indigo-200 rounded-2xl p-4 shadow-sm space-y-3">
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
                          {status === 'saved' && act.action_type === 'create_task' ? (
                            "Session Added to Schedule!"
                          ) : (
                            act.label
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {msg.cardType === 'recommendation' && msg.cardData && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
                      <h4 className="text-xs font-bold text-slate-800 font-heading pb-1 border-b border-slate-100">
                        {msg.cardData.title}
                      </h4>
                      <div className="space-y-2">
                        {msg.cardData.items?.map((it, idx) => (
                          <div key={idx} className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-indigo-900">{it.subject}</span>
                              <span className="text-[9px] font-semibold uppercase text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                {it.priority}
                              </span>
                            </div>
                            <p className="font-medium text-slate-700">{it.topic}</p>
                            <p className="text-[11px] text-slate-500">{it.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Quick Prompt Pills */}
                  {msg.suggestedActions && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.suggestedActions.map((act, idx) => {
                        if (act.action_type === 'chat_query') {
                          return (
                            <button
                              key={idx}
                              onClick={() => handleAction(act, msg.id)}
                              className="px-3 py-1 rounded-full text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 transition-colors"
                            >
                              {act.label}
                            </button>
                          );
                        }
                        if (act.action_type === 'navigate') {
                          return (
                            <button
                              key={idx}
                              onClick={() => handleAction(act, msg.id)}
                              className="px-3 py-1 rounded-full text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1"
                            >
                              <span>{act.label}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 items-center text-slate-400 text-xs py-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center animate-spin">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span>Alexa+ is analyzing your request...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Example Quick Prompts Ribbon */}
        <div className="px-5 py-2 bg-slate-100/70 border-t border-slate-200/60 overflow-x-auto flex items-center gap-2 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">Try asking:</span>
          {EXAMPLE_PROMPTS.slice(0, 3).map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 transition-all text-xs whitespace-nowrap shrink-0 shadow-2xs"
            >
              "{prompt}"
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-slate-100">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            {/* Simulated Voice Mic Button */}
            <button
              type="button"
              onClick={toggleSimulatedVoice}
              className={`p-2.5 rounded-xl transition-all ${
                isSimulatedListening 
                  ? 'bg-rose-500 text-white animate-pulse' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-indigo-600'
              }`}
              title={isSimulatedListening ? "Listening..." : "Simulate Alexa+ Voice Input"}
            >
              {isSimulatedListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            <input
              type="text"
              placeholder="Ask Alexa+: 'Create a 7-day DSA revision plan' or 'Show my pending tasks'..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />

            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
