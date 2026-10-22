import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  Circle, 
  AlertCircle 
} from 'lucide-react';
import { api } from '../services/api';
import Modal from '../components/Modal';

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function WeeklyPlan() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);

  // Compute Monday of the current week
  const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };

  const startOfWeek = getMonday(currentDate);

  // Generate 7 days for the current week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    return day;
  });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.getTasks('all');
      setTasks(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handlePrevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    setCurrentDate(next);
  };

  const handleCurrentWeek = () => {
    setCurrentDate(new Date());
  };

  const handleToggleTask = async (taskId, e) => {
    e.stopPropagation();
    try {
      await api.toggleTask(taskId);
      setTasks(tasks.map((t) => t.id === taskId ? { ...t, is_completed: !t.is_completed } : t));
    } catch (err) {
      alert(`Error toggling task: ${err.message}`);
    }
  };

  // Format date range string for week header
  const formatDateStr = (d) => d.toISOString().split('T')[0];
  const weekHeaderStr = `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      
      {/* Header and Week Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">
            Weekly Study Plan
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Visualize and track your daily scheduled preparation workload across the week.
          </p>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCurrentWeek}
            className="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
          >
            Current Week
          </button>
          <div className="flex items-center bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
            <button
              onClick={handlePrevWeek}
              className="p-2 text-slate-600 hover:bg-slate-100 transition-colors"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-semibold text-slate-800 font-mono">
              {weekHeaderStr}
            </span>
            <button
              onClick={handleNextWeek}
              className="p-2 text-slate-600 hover:bg-slate-100 transition-colors"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 7-Day Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((dayDate, i) => {
          const dateStr = formatDateStr(dayDate);
          const isToday = dateStr === todayStr;
          const dayTasks = tasks.filter((t) => t.date === dateStr);
          const totalMins = dayTasks.reduce((acc, curr) => acc + curr.duration, 0);

          return (
            <div 
              key={dateStr}
              className={`flex flex-col rounded-2xl border transition-all min-h-[420px] ${
                isToday 
                  ? 'bg-indigo-50/40 border-indigo-300 shadow-xs ring-1 ring-indigo-200' 
                  : 'bg-white border-slate-200/80 shadow-2xs'
              }`}
            >
              {/* Day Header */}
              <div className={`p-3.5 border-b text-center rounded-t-2xl ${
                isToday ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-800'
              }`}>
                <p className={`text-[11px] font-semibold uppercase tracking-wider ${isToday ? 'text-indigo-100' : 'text-slate-400'}`}>
                  {DAY_NAMES[i]}
                </p>
                <p className="text-lg font-bold font-heading">
                  {dayDate.getDate()}
                </p>
                <p className={`text-[10px] mt-0.5 ${isToday ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''} {totalMins > 0 ? `(${totalMins}m)` : ''}
                </p>
              </div>

              {/* Day Tasks List */}
              <div className="p-2 flex-1 space-y-2 overflow-y-auto max-h-[460px]">
                {dayTasks.length === 0 ? (
                  <div className="h-full flex items-center justify-center p-4 text-center">
                    <p className="text-[11px] text-slate-300 font-medium">No tasks</p>
                  </div>
                ) : (
                  dayTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xs ${
                        task.is_completed 
                          ? 'bg-slate-50 border-slate-200 opacity-60' 
                          : 'bg-white border-slate-200/80 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded truncate max-w-[85px]">
                          {task.subject}
                        </span>
                        <button
                          onClick={(e) => handleToggleTask(task.id, e)}
                          className="text-slate-300 hover:text-indigo-600 shrink-0"
                        >
                          {task.is_completed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Circle className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <h4 className={`text-xs font-semibold line-clamp-2 ${task.is_completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {task.title}
                      </h4>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100/80 text-[10px] text-slate-400">
                        <span>{task.duration}m</span>
                        <span className={`uppercase font-semibold text-[9px] px-1 py-0.2 rounded ${
                          task.priority === 'high' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Detail Modal */}
      <Modal
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title="Study Task Details"
        maxWidth="max-w-md"
      >
        {selectedTask && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md">
                  {selectedTask.subject}
                </span>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {selectedTask.topic}
                </span>
                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                  selectedTask.priority === 'high' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'
                }`}>
                  {selectedTask.priority}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 font-heading">
                {selectedTask.title}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <div>
                <span className="text-slate-400">Scheduled Date:</span>
                <p className="font-semibold text-slate-700 mt-0.5">{selectedTask.date}</p>
              </div>
              <div>
                <span className="text-slate-400">Allocated Time:</span>
                <p className="font-semibold text-slate-700 mt-0.5">{selectedTask.duration} minutes</p>
              </div>
              <div>
                <span className="text-slate-400">Start Time:</span>
                <p className="font-semibold text-slate-700 mt-0.5">{selectedTask.start_time || 'Not specified'}</p>
              </div>
              <div>
                <span className="text-slate-400">Current Status:</span>
                <p className={`font-semibold mt-0.5 ${selectedTask.is_completed ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {selectedTask.is_completed ? 'Completed' : 'Pending'}
                </p>
              </div>
            </div>

            {selectedTask.description && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Description & Notes
                </h4>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                  {selectedTask.description}
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={(e) => {
                  handleToggleTask(selectedTask.id, e);
                  setSelectedTask({ ...selectedTask, is_completed: !selectedTask.is_completed });
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
                  selectedTask.is_completed
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {selectedTask.is_completed ? 'Mark as Incomplete' : 'Mark as Completed'}
              </button>

              <button
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
