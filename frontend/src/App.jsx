import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import StudyPlanner from './pages/StudyPlanner';
import TaskManager from './pages/TaskManager';
import WeeklyPlan from './pages/WeeklyPlan';
import Settings from './pages/Settings';
import AlexaAssistant from './components/AlexaAssistant';
import PomodoroTimer from './components/PomodoroTimer';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [timerTasks, setTimerTasks] = useState([]);
  const [aiMode, setAiMode] = useState('mock');

  // Load system mode on initial mount
  useEffect(() => {
    api.getHealth()
      .then((res) => {
        if (res?.mock_mode) {
          setAiMode('mock');
        } else if (res?.ai_provider) {
          setAiMode(res.ai_provider);
        }
      })
      .catch(() => {
        setAiMode('mock');
      });
  }, []);

  const handleNavigate = (tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenTimer = () => {
    api.getTasks('all')
      .then((tasks) => setTimerTasks(tasks || []))
      .catch(() => setTimerTasks([]));
    setIsTimerOpen(true);
  };

  const handleToggleTimerTask = async (taskId) => {
    try {
      await api.toggleTask(taskId);
      setTimerTasks((prev) =>
        prev.map((t) => (t.id === Number(taskId) ? { ...t, is_completed: true } : t))
      );
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleNavigate}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        onOpenTimer={handleOpenTimer}
        aiMode={aiMode}
      />

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <Dashboard 
            onNavigate={handleNavigate} 
            onOpenAssistant={() => setIsAssistantOpen(true)} 
          />
        )}

        {activeTab === 'planner' && (
          <StudyPlanner 
            onNavigate={handleNavigate} 
          />
        )}

        {activeTab === 'tasks' && (
          <TaskManager />
        )}

        {activeTab === 'weekly' && (
          <WeeklyPlan />
        )}

        {activeTab === 'settings' && (
          <Settings />
        )}
      </main>

      {/* Alexa+ Conversational Assistant Modal */}
      <AlexaAssistant
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onNavigate={handleNavigate}
      />

      {/* Pomodoro Focus Timer Modal */}
      <PomodoroTimer
        isOpen={isTimerOpen}
        onClose={() => setIsTimerOpen(false)}
        tasks={timerTasks}
        onCompleteTask={handleToggleTimerTask}
      />

      {/* Application Footer */}
      <footer className="mt-auto py-6 border-t border-slate-200/80 bg-white text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 StudyPilot AI — Amazon Developer Hackathon 2026</p>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => handleNavigate('settings')} 
              className="hover:text-indigo-600 transition-colors"
            >
              System Diagnostics
            </button>
            <span>•</span>
            <span className="text-slate-400">Isolated Provider Architecture</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
