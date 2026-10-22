import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Cpu, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  Key, 
  Info,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';

export default function Settings() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getHealth();
      setHealth(res);
    } catch (err) {
      setError(err.message || 'Failed to connect to backend service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">
          System & AI Settings
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Configuration parameters, runtime diagnostics, and AI provider status for StudyPilot AI.
        </p>
      </div>

      {/* Backend Health Diagnostic Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 font-heading">Backend & Database Status</h3>
              <p className="text-xs text-slate-400">FastAPI & SQLite persistence engine</p>
            </div>
          </div>

          <button
            onClick={fetchHealth}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors"
            title="Refresh Health Check"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading && !health ? (
          <p className="text-xs text-slate-400">Checking system status...</p>
        ) : error ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Connection Error: {error}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-xs text-slate-400">Service API</span>
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold text-slate-800 uppercase">{health.status}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-xs text-slate-400">SQLite Database</span>
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold text-slate-800 uppercase">{health.database}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-xs text-slate-400">Active AI Mode</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${health.mock_mode ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <span className="text-sm font-semibold text-slate-800">
                  {health.mock_mode ? 'Deterministic Mock Mode' : 'Live LLM Provider'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Engine & Mock Mode Documentation */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 font-heading">AI Provider & Scheduling Architecture</h3>
            <p className="text-xs text-slate-400">Isolated provider layer with deterministic mock fallback</p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
          <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-indigo-900 text-sm">
              <Info className="w-4 h-4 text-indigo-600" />
              <span>Deterministic Mock Mode (Active by Default)</span>
            </div>
            <p>
              StudyPilot AI includes a built-in deterministic planning algorithm. It calculates topic weights based on syllabus difficulty, prioritizes high-impact topics, prevents overlapping times, ensures daily study capacity limits, and reserves revision buffers before exams—<strong>without requiring any paid external API keys</strong>.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-3">
            <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <Key className="w-4 h-4 text-slate-500" />
              <span>Configuring Live LLM Integration (Optional)</span>
            </h4>
            <p>
              To connect a live LLM (Google Gemini or OpenAI), configure your environment variables in <code className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-800">backend/.env</code>:
            </p>
            <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed">
{`# In backend/.env
AI_PROVIDER="gemini"
GEMINI_API_KEY="your-gemini-api-key"
AI_MODEL_NAME="gemini-1.5-flash"`}
            </pre>
            <p className="text-[11px] text-slate-500 italic">
              Note: The frontend never exposes secret API keys. All calls are routed through the secure backend AI service module.
            </p>
          </div>
        </div>
      </div>

      {/* Hackathon Alignment Card */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-md space-y-4">
        <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>Amazon Developer Hackathon 2026 Submission</span>
        </div>
        <h3 className="text-xl font-bold font-heading">Track: Alexa+ Companion Experience</h3>
        <p className="text-xs text-indigo-200 max-w-2xl leading-relaxed">
          StudyPilot AI simulates an Alexa+-inspired conversational study assistant. It combines dynamic speech-style interaction, structured UI action cards, and algorithmic exam scheduling into a unified web dashboard.
        </p>
      </div>

    </div>
  );
}
