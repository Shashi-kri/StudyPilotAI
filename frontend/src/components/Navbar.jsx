import React, { useState, useEffect, useRef } from 'react';
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
  const mobileMenuRef = useRef(null);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
    { id: 'planner', label: 'AI Study Planner', shortLabel: 'Planner', icon: Sparkles },
    { id: 'tasks', label: 'My Tasks', shortLabel: 'Tasks', icon: CheckSquare },
    { id: 'weekly', label: 'Weekly Schedule', shortLabel: 'Schedule', icon: CalendarRange },
    { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: SettingsIcon },
  ];

  // Close mobile menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center shrink-0">
            <div 
              onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }} 
              className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl p-1"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setActiveTab('dashboard'); setMobileMenuOpen(false); } }}
              aria-label="StudyPilot AI Home"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform shrink-0">
                <Compass className="w-5 h-5" />
              </div>
              <div className="flex items-center">
                <span className="font-heading font-bold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 bg-clip-text text-transparent">
                  StudyPilot
                </span>
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200/60 uppercase tracking-wider">
                  AI
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links (Responsive: hidden below lg: 1024px to prevent overflow) */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 xl:px-3.5 py-2 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="hidden xl:inline">{item.label}</span>
                  <span className="xl:hidden">{item.shortLabel}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Actions: Mode Badge, Focus Timer, AI Assistant, Hamburger Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            
            {/* Mode badge (Desktop wide only) */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
              <span className={`w-2 h-2 rounded-full ${aiMode !== 'mock' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="capitalize">{aiMode === 'mock' ? 'Mock Mode' : `${aiMode} (Live)`}</span>
            </div>

            {/* Pomodoro Focus Timer Button */}
            <button
              onClick={onOpenTimer}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              title="Study Focus Timer (Pomodoro)"
              aria-label="Open Focus Timer"
            >
              <Timer className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="hidden sm:inline">Focus Timer</span>
            </button>

            {/* AI Study Assistant Launcher Button */}
            <button
              onClick={onOpenAssistant}
              id="open-assistant-btn"
              className="relative inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-md shadow-orange-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 shrink-0"
              aria-label="Open AI Assistant"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-200 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <Bot className="w-4 h-4 shrink-0" />
              <span className="hidden xs:inline sm:inline">AI Assistant</span>
              <span className="xs:hidden sm:hidden">AI</span>
            </button>

            {/* Mobile / Tablet Menu Toggle Button (Visible below lg: 1024px) */}
            <div className="flex lg:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav-dropdown"
              >
                {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* Mobile Navigation Dropdown Menu */}
      {mobileMenuOpen && (
        <div 
          ref={mobileMenuRef}
          id="mobile-nav-dropdown"
          className="lg:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-md px-4 pt-3 pb-5 space-y-2 shadow-lg animate-in slide-in-from-top-2 duration-200"
        >
          {/* Nav Items */}
          <div className="space-y-1">
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
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Mobile Status & Utility Bar */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 px-1">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${aiMode !== 'mock' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="font-medium text-slate-700 capitalize">Engine: {aiMode === 'mock' ? 'Mock Mode' : `${aiMode} (Live)`}</span>
            </div>
            <button
              onClick={() => { onOpenTimer(); setMobileMenuOpen(false); }}
              className="text-indigo-600 font-medium hover:underline flex items-center gap-1"
            >
              <Timer className="w-3.5 h-3.5" />
              <span>Pomodoro Timer</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
