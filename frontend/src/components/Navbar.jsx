import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Sparkles, 
  CheckSquare, 
  CalendarRange, 
  Settings as SettingsIcon, 
  Bot, 
  Menu, 
  X,
  Compass,
  Timer
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenAssistant, onOpenTimer, aiMode = "mock" }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'planner', label: 'AI Study Planner', icon: Sparkles },
    { id: 'tasks', label: 'My Tasks', icon: CheckSquare },
    { id: 'weekly', label: 'Weekly Schedule', icon: CalendarRange },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div 
              onClick={() => setActiveTab('dashboard')} 
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <span className="font-heading font-bold text-xl tracking-tight bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 bg-clip-text text-transparent">
                  StudyPilot
                </span>
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200/60 uppercase tracking-wider">
                  AI
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Action: Alexa+ Assistant Trigger & Mode Badge */}
          <div className="flex items-center gap-3">
            {/* Mode badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
              <span className={`w-2 h-2 rounded-full ${aiMode === 'llm' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="capitalize">{aiMode} Mode</span>
            </div>

            {/* Pomodoro Focus Timer Button */}
            <button
              onClick={onOpenTimer}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition active:scale-95"
              title="Study Focus Timer (Pomodoro)"
            >
              <Timer className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Focus Timer</span>
            </button>

            {/* Alexa+ Assistant Launcher Button */}
            <button
              onClick={onOpenAssistant}
              className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-md shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <Bot className="w-4 h-4" />
              <span>Ask Alexa+</span>
            </button>

            {/* Mobile menu button */}
            <div className="flex md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/80 bg-white/95 px-4 pt-2 pb-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
