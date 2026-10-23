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
  Activity,
  Layers,
  Sparkles
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

  const getLatestModeLabel = (mode) => {
    if (!mode) return 'Not verified';
    if (mode === 'llm' || mode === 'gemini' || mode === 'openai') return 'Live LLM';
    if (mode === 'deterministic_fallback') return 'Deterministic Fallback';
    if (mode === 'mock') return 'Deterministic Mock Engine';
    return mode;
  };

  const getLatestModeColor = (mode) => {
    if (!mode) return 'text-slate-500 bg-slate-100';
    if (mode === 'llm' || mode === 'gemini' || mode === 'openai') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (mode === 'deterministic_fallback') return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-indigo-700 bg-indigo-50 border-indigo-200';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">
          System & AI Settings
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Real-time diagnostics, verified AI provider status, and architecture configuration for StudyPilot AI.
        </p>
      </div>

      {/* Backend & AI Diagnostic Grid */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 font-heading">System Diagnostics & AI Status</h3>
              <p className="text-xs text-slate-400">Live health verification and generation mode telemetry</p>
            </div>
          </div>

          <button
            onClick={fetchHealth}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Refresh Diagnostics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {loading && !health ? (
          <div className="py-6 text-center text-xs text-slate-400">Verifying system diagnostics...</div>
        ) : error ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Connection Error: {error}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* 1. Backend Service API */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-400">Backend Service</span>
              <div className="flex items-center gap-2 mt-2">
                <CheckCircle2 className={`w-4 h-4 ${health.status === 'healthy' ? 'text-emerald-500' : 'text-amber-500'}`} />
                <span className="text-sm font-bold text-slate-800 uppercase">{health.status}</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1">FastAPI REST engine</span>
            </div>

            {/* 2. SQLite Database */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-400">Database Storage</span>
              <div className="flex items-center gap-2 mt-2">
                <Database className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-bold text-slate-800 uppercase">{health.database}</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1">SQLite relational persistence</span>
            </div>

            {/* 3. Configured Provider & Model */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-400">Configured AI Provider</span>
              <div className="flex items-center gap-2 mt-2">
                <Cpu className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-bold text-slate-800 capitalize">
                  {health.configured_provider || health.ai_provider || 'Mock'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 truncate" title={health.configured_model || health.ai_model_name}>
                Model: {health.configured_model || health.ai_model_name || 'deterministic'}
              </span>
            </div>

            {/* 4. Live Generation Verification */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-400">Live Generation Verification</span>
              <div className="flex items-center gap-2 mt-2">
                <span className={`w-2.5 h-2.5 rounded-full ${health.live_generation_verified ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span className={`text-sm font-bold ${health.live_generation_verified ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {health.live_generation_verified ? 'Verified (Live)' : 'Not verified'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1">
                {health.live_generation_verified 
                  ? 'Successful live LLM call confirmed' 
                  : 'No successful live call recorded yet'}
              </span>
            </div>

            {/* 5. Latest Generation Mode */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between sm:col-span-2 lg:col-span-2">
              <span className="text-xs font-medium text-slate-400">Latest Generation Mode</span>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${getLatestModeColor(health.latest_generation_mode)}`}>
                  {getLatestModeLabel(health.latest_generation_mode)}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1">
                {health.latest_generation_mode
                  ? `Last executed via ${getLatestModeLabel(health.latest_generation_mode)}`
                  : 'Not verified (No study plan generated in current session yet)'}
              </span>
            </div>

          </div>
        )}
      </div>

      {/* AI Architecture & Provider Guide */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 font-heading">AI Provider & Fallback Architecture</h3>
            <p className="text-xs text-slate-400">Isolated provider layer with deterministic mock fallback</p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
          {health?.configured_provider === 'gemini' || health?.ai_provider === 'gemini' ? (
            <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-indigo-900 text-sm">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Configured Provider: Google Gemini ({health.configured_model || health.ai_model_name})</span>
              </div>
              <p>
                StudyPilot AI is configured to use Google Gemini for natural-language understanding, dynamic query explanations, and intelligent schedule generation. 
                If the Gemini API encounters rate limits, network timeouts, or high-demand spikes (HTTP 503), the engine automatically falls back to the deterministic local scheduler without interrupting user workflow.
              </p>
              <p className="text-[11px] text-indigo-700/80 italic">
                Note: Live status is only marked as <strong>Verified</strong> once an actual API generation has completed successfully.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-indigo-900 text-sm">
                <Info className="w-4 h-4 text-indigo-600" />
                <span>Deterministic Planning Engine (Active)</span>
              </div>
              <p>
                StudyPilot AI includes a built-in deterministic planning algorithm. It calculates topic weights based on syllabus difficulty, prioritizes high-impact topics, prevents overlapping times, ensures daily study capacity limits, and reserves revision buffers before exams—<strong>operating entirely offline without requiring paid external API keys</strong>.
              </p>
            </div>
          )}

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-3">
            <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <Key className="w-4 h-4 text-slate-500" />
              <span>Environment Configuration</span>
            </h4>
            <p>
              AI provider credentials are configured securely in <code className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-800">backend/.env</code>:
            </p>
            <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed">
{`# In backend/.env
AI_PROVIDER="gemini"
GEMINI_API_KEY="your-gemini-api-key"
AI_MODEL_NAME="gemini-1.5-flash"`}
            </pre>
            <p className="text-[11px] text-slate-500 italic">
              Security note: API keys are strictly kept on the server and are never exposed to the frontend. All AI requests pass through the backend proxy service.
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
          StudyPilot AI features a conversational study assistant inspired by Alexa+, combining voice-style interaction, structured UI action cards, and algorithmic exam scheduling into a unified web dashboard. The assistant is built with the Web Speech API and designed around the conversational AI companion paradigm.
        </p>
      </div>

    </div>
  );
}
