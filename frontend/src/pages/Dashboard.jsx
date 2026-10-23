import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Calendar, 
  Target, 
  TrendingUp, 
  Sparkles, 
  ArrowRight, 
  AlertCircle,
  BookOpen,
  Award,
  ChevronRight,
  Flame,
  Bot
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { api } from '../services/api';

export default function Dashboard({ onNavigate, onOpenAssistant }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleToggleTask = async (taskId) => {
    try {
      setActionLoading(true);
      setActionError(null);
      await api.toggleTask(taskId);
      await fetchDashboard();
    } catch (err) {
      setActionError(`Could not update task: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-medium">Loading your study cockpit...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-4xl mx-auto my-8 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
          <div>
            <h3 className="font-semibold text-lg font-heading">Unable to connect to backend</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={fetchDashboard}
          className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const {
    welcome_message,
    today_date,
    exam_countdown_days,
    next_exam_date,
    next_exam_title,
    total_tasks,
    completed_tasks,
    pending_tasks,
    completion_percentage,
    streak_days = 0,
    today_schedule = [],
    upcoming_sessions = [],
    weekly_progress = []
  } = data || {};

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Inline Action Error Banner */}
      {actionError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="ml-auto text-rose-400 hover:text-rose-600"
            aria-label="Dismiss"
          >×</button>
        </div>
      )}
      
      {/* Top Banner / Welcome & Exam Countdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* StudyPilot AI Hero Section with Luminous Assistant Light Ring */}
        <div className="lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-[#060D1E] via-[#0B152B] to-[#0A192F] rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-slate-950/40 border border-cyan-500/20">
          
          {/* Subtle Ambient Radial Glows */}
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 -mb-12 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* Left Content Area */}
            <div className="space-y-4 max-w-xl text-left">
              
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/70 backdrop-blur-md text-xs font-medium text-cyan-300 border border-cyan-500/30">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{today_date}</span>
                </div>
                {streak_days > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 backdrop-blur-md text-xs font-semibold text-amber-300 border border-amber-500/30 shadow-xs">
                    <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span>{streak_days}-Day Study Streak 🔥</span>
                  </div>
                )}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950/60 backdrop-blur-md text-[11px] font-semibold text-sky-300 border border-sky-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>AI Engine Ready</span>
                </div>
              </div>

              {/* Headline */}
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading leading-tight text-white">
                {welcome_message}
              </h1>

              {/* Supporting Text */}
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Empower your exam preparation with algorithmic schedule optimization, syllabus difficulty balancing, and on-demand conversational study guidance.
              </p>

              {/* Call-to-Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => onNavigate('planner')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>Create Study Plan</span>
                </button>
                
                <button
                  onClick={onOpenAssistant}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm backdrop-blur-md border border-white/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Bot className="w-4 h-4 text-cyan-300" />
                  <span>Ask AI Assistant</span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>

            </div>

            {/* Right: Original Luminous Blue/Cyan Smart-Assistant Light Ring */}
            <div className="shrink-0 flex flex-col items-center justify-center p-2">
              <div 
                onClick={onOpenAssistant}
                className="group cursor-pointer relative flex items-center justify-center transition-transform hover:scale-105"
                title="Click to interact with StudyPilot AI Assistant"
                role="button"
                tabIndex={0}
              >
                {/* Outermost ambient glow aura */}
                <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-xl animate-pulse" />

                {/* Concentric light-ring housing */}
                <div className="assistant-light-ring relative w-32 h-32 sm:w-36 sm:h-36 rounded-full flex items-center justify-center p-1 bg-gradient-to-tr from-cyan-900/40 via-sky-950/60 to-blue-900/40 border border-cyan-400/40 backdrop-blur-md">
                  
                  {/* Rotating luminous gradient ring */}
                  <div className="light-ring-spinner absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-300 border-r-sky-400 border-b-blue-500 opacity-90" />
                  
                  {/* Inner orb core */}
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#060D1E] border border-cyan-500/30 flex flex-col items-center justify-center text-center p-2 relative shadow-inner">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/30 group-hover:scale-110 transition-transform">
                        <Bot className="w-4 h-4" />
                      </div>
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping opacity-75" />
                    </div>
                    <span className="text-[10px] font-bold text-cyan-200 mt-1.5 tracking-tight uppercase">StudyPilot AI</span>
                    <span className="text-[9px] text-sky-400/80 font-medium">Assistant Active</span>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Exam Countdown & Target Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Exam Countdown</span>
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Target className="w-5 h-5" />
              </span>
            </div>

            <div className="mt-4">
              {exam_countdown_days !== null && exam_countdown_days !== undefined ? (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 font-heading">
                      {exam_countdown_days}
                    </span>
                    <span className="text-slate-500 font-medium">days left</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 mt-2 truncate">
                    {next_exam_title || 'Upcoming Examination'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Target Date: {next_exam_date}
                  </p>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-sm font-medium text-slate-600">No active exam date set</p>
                  <p className="text-xs text-slate-400 mt-1">Configure your subjects and target date in the planner.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={() => onNavigate('planner')}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
            >
              <span>{exam_countdown_days !== null ? 'Adjust Target in Planner' : 'Set Up Exam Target'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* 4 Metric Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Total Tasks */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Tasks</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <BookOpen className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">{total_tasks}</span>
            <p className="text-xs text-slate-400 mt-0.5">Assigned study units</p>
          </div>
        </div>

        {/* Completed Tasks */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Completed</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">{completed_tasks}</span>
            <p className="text-xs text-slate-400 mt-0.5">Finished sessions</p>
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pending</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">{pending_tasks}</span>
            <p className="text-xs text-slate-400 mt-0.5">Remaining to complete</p>
          </div>
        </div>

        {/* Overall Completion Percentage */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Completion Rate</span>
            <span className="p-2 rounded-xl bg-violet-50 text-violet-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">
                {completion_percentage}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, completion_percentage)}%` }}
              />
            </div>
          </div>
        </div>

      </div>

      {/* Main Grid: Today's Schedule & Weekly Progress Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Today's Study Schedule */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-heading">Today's Study Schedule</h2>
              <p className="text-xs text-slate-500">Check off sessions as you complete them.</p>
            </div>
            <button
              onClick={() => onNavigate('tasks')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>View All Tasks</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 divide-y divide-slate-100 shadow-xs">
            {today_schedule.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                  <Award className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">No sessions scheduled for today</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Take a well-deserved breather or use the AI planner to map out upcoming revision units.
                </p>
                <button
                  onClick={() => onNavigate('planner')}
                  className="mt-4 px-4 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                >
                  Generate New Schedule
                </button>
              </div>
            ) : (
              today_schedule.map((task) => (
                <div 
                  key={task.id} 
                  className={`py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-4 transition-opacity ${
                    task.is_completed ? 'opacity-60' : 'opacity-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleTask(task.id)}
                      disabled={actionLoading}
                      className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors"
                      title={task.is_completed ? "Mark as pending" : "Mark as completed"}
                    >
                      {task.is_completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <div>
                      <h4 className={`text-sm font-semibold text-slate-800 ${task.is_completed ? 'line-through text-slate-500' : ''}`}>
                        {task.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <span className="font-medium text-slate-700">{task.subject}</span> • {task.topic}
                      </p>
                      {task.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{task.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.start_time && (
                      <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                        {task.start_time}
                      </span>
                    )}
                    <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-md">
                      {task.duration}m
                    </span>
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                      task.priority === 'high' 
                        ? 'bg-rose-50 text-rose-600' 
                        : task.priority === 'medium' 
                        ? 'bg-amber-50 text-amber-600' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Upcoming Sessions Preview */}
          <div className="pt-4">
            <h3 className="text-sm font-bold text-slate-900 font-heading mb-3">Next Study Sessions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {upcoming_sessions.slice(0, 4).map((task) => (
                <div key={task.id} className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                  <div className="truncate pr-2">
                    <p className="text-xs font-medium text-indigo-600 truncate">{task.subject}</p>
                    <p className="text-sm font-semibold text-slate-800 truncate">{task.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{task.date} • {task.duration} mins</p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                    task.priority === 'high' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {task.priority}
                  </span>
                </div>
              ))}
              {upcoming_sessions.length === 0 && (
                <p className="text-xs text-slate-400 italic sm:col-span-2">No upcoming future sessions found.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Weekly Progress Visualization */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-heading">Weekly Activity</h2>
            <p className="text-xs text-slate-500">Tasks completed vs pending this week.</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly_progress} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="day_name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      borderRadius: '0.75rem', 
                      border: 'none', 
                      color: '#ffffff',
                      fontSize: '12px' 
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" name="Pending" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Weekly Total Load:</span>
              <span className="font-semibold text-slate-700">
                {weekly_progress.reduce((acc, curr) => acc + curr.completed + curr.pending, 0)} sessions
              </span>
            </div>
          </div>

          {/* Assistant Quick Suggestion Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-5 border border-indigo-100">
            <div className="flex items-center gap-2 text-orange-700 font-semibold text-sm font-heading">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <span>Study Tip</span>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Spacing your revision sessions across multiple days yields significantly higher retention than cramming. Let StudyPilot balance your workload!
            </p>
            <button
              onClick={onOpenAssistant}
              className="mt-3 text-xs font-semibold text-orange-600 hover:text-orange-800 flex items-center gap-1"
            >
              <span>Chat with Study Assistant</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
