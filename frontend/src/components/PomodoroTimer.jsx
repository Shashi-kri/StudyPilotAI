import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Coffee, BookOpen, Volume2, VolumeX, X } from 'lucide-react';

export default function PomodoroTimer({ tasks = [], isOpen, onClose, onCompleteTask }) {
  const [mode, setMode] = useState('focus'); // focus | shortBreak | longBreak
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);

  const timerRef = useRef(null);

  const MODE_DURATIONS = {
    focus: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60,
  };

  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {
      // AudioContext fallback
    }
  };

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsRunning(false);
            playBeep();
            if (mode === 'focus') {
              setSessionsCompleted((s) => s + 1);
              if (selectedTaskId && onCompleteTask) {
                onCompleteTask(selectedTaskId);
              }
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [isRunning, mode, selectedTaskId, soundEnabled, onCompleteTask]);

  const switchMode = (newMode) => {
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(MODE_DURATIONS[newMode]);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(MODE_DURATIONS[mode]);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const total = MODE_DURATIONS[mode];
  const progressPercent = Math.round(((total - timeLeft) / total) * 100);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⏳</span>
            <div>
              <h2 className="text-xl font-bold text-white">Study Focus Timer</h2>
              <p className="text-xs text-slate-400">Pomodoro Technique for Deep Work</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800 transition"
              title={soundEnabled ? 'Mute alert' : 'Enable alert sound'}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-800/80 rounded-2xl mb-8">
          <button
            onClick={() => switchMode('focus')}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              mode === 'focus'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen size={14} /> Focus (25m)
          </button>
          <button
            onClick={() => switchMode('shortBreak')}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              mode === 'shortBreak'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coffee size={14} /> Short (5m)
          </button>
          <button
            onClick={() => switchMode('longBreak')}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              mode === 'longBreak'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coffee size={14} /> Long (15m)
          </button>
        </div>

        {/* Circular Progress & Clock */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="relative w-56 h-56 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="44"
                className="stroke-slate-800"
                strokeWidth="7"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                className={`${
                  mode === 'focus'
                    ? 'stroke-blue-500'
                    : mode === 'shortBreak'
                    ? 'stroke-emerald-500'
                    : 'stroke-purple-500'
                } transition-all duration-500`}
                strokeWidth="7"
                strokeDasharray="276"
                strokeDashoffset={276 - (276 * progressPercent) / 100}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-5xl font-mono font-extrabold tracking-tight text-white">
                {formatTime(timeLeft)}
              </span>
              <span className="text-xs uppercase tracking-wider text-slate-400 mt-1">
                {isRunning ? (mode === 'focus' ? 'Focusing...' : 'Resting...') : 'Paused'}
              </span>
            </div>
          </div>
        </div>

        {/* Task Attachment */}
        {tasks.length > 0 && mode === 'focus' && (
          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Link with Task (optional):
            </label>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- No specific task --</option>
              {tasks.filter(t => !t.is_completed).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.subject}: {t.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-transform active:scale-95 ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
            }`}
          >
            {isRunning ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
          </button>
          <button
            onClick={resetTimer}
            className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition active:scale-95"
            title="Reset timer"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        {/* Sessions indicator */}
        <div className="mt-6 text-center text-xs text-slate-400 border-t border-slate-800 pt-4">
          Sessions completed this sitting: <strong className="text-white font-bold">{sessionsCompleted}</strong>
        </div>
      </div>
    </div>
  );
}
