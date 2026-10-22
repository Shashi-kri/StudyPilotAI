import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Calendar, 
  AlertCircle,
  X,
  BookOpen
} from 'lucide-react';
import { api } from '../services/api';
import Modal from '../components/Modal';

export default function TaskManager() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [activeFilter, setActiveFilter] = useState('all'); // all, today, upcoming, completed, pending
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);

  // Form State for Create / Edit
  const initialForm = {
    title: '',
    subject: '',
    topic: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '10:00',
    duration: 60,
    priority: 'medium',
    description: '',
    is_completed: false
  };
  const [formData, setFormData] = useState(initialForm);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getTasks(activeFilter, selectedSubject === 'all' ? null : selectedSubject);
      setTasks(res);
    } catch (err) {
      setError(err.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [activeFilter, selectedSubject]);

  // Extract distinct subjects for dropdown filter
  const subjectsList = Array.from(new Set(tasks.map((t) => t.subject).filter(Boolean)));

  const handleOpenCreate = () => {
    setFormData({
      ...initialForm,
      date: new Date().toISOString().split('T')[0]
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      subject: task.subject,
      topic: task.topic,
      date: task.date,
      start_time: task.start_time || '',
      duration: task.duration,
      priority: task.priority,
      description: task.description || '',
      is_completed: task.is_completed
    });
  };

  const handleToggleTask = async (taskId) => {
    try {
      await api.toggleTask(taskId);
      // Optimistic or refresh
      setTasks(tasks.map((t) => t.id === taskId ? { ...t, is_completed: !t.is_completed } : t));
    } catch (err) {
      alert(`Error toggling task: ${err.message}`);
      fetchTasks();
    }
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.subject.trim() || !formData.topic.trim() || !formData.date) {
      alert("Please fill in Title, Subject, Topic, and Date.");
      return;
    }

    try {
      setFormSubmitting(true);
      if (editingTask) {
        await api.updateTask(editingTask.id, {
          title: formData.title,
          subject: formData.subject,
          topic: formData.topic,
          date: formData.date,
          start_time: formData.start_time || null,
          duration: parseInt(formData.duration, 10),
          priority: formData.priority,
          description: formData.description || null,
          is_completed: formData.is_completed
        });
        setEditingTask(null);
      } else {
        await api.createTask({
          title: formData.title,
          subject: formData.subject,
          topic: formData.topic,
          date: formData.date,
          start_time: formData.start_time || null,
          duration: parseInt(formData.duration, 10),
          priority: formData.priority,
          description: formData.description || null,
          is_completed: false
        });
        setIsCreateOpen(false);
      }
      fetchTasks();
    } catch (err) {
      alert(`Error saving task: ${err.message}`);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTask) return;
    try {
      await api.deleteTask(deletingTask.id);
      setTasks(tasks.filter((t) => t.id !== deletingTask.id));
      setDeletingTask(null);
    } catch (err) {
      alert(`Error deleting task: ${err.message}`);
    }
  };

  // Filter tasks client-side for search query
  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.topic.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      
      {/* Top Header & New Task Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">
            My Study Tasks
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Organize, prioritize, and check off your academic preparation units.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Tasks' },
            { id: 'today', label: 'Today' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'pending', label: 'Pending' },
            { id: 'completed', label: 'Completed' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeFilter === f.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Right side: Subject dropdown & Search input */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {subjectsList.length > 0 && (
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Subjects</option>
              {subjectsList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search title, subject, topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

      </div>

      {/* Task List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {loading && tasks.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Fetching study tasks...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <CheckSquare className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 font-heading">No tasks found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery ? "No tasks matching your search." : "No tasks in this category. Click 'New Task' or generate a plan to schedule your study sessions."}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div 
              key={task.id}
              className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-all ${
                task.is_completed ? 'opacity-60 bg-slate-50/40' : ''
              }`}
            >
              <div className="flex items-start gap-4 flex-1">
                <button
                  onClick={() => handleToggleTask(task.id)}
                  className="mt-1 text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
                  title={task.is_completed ? "Mark as pending" : "Mark as completed"}
                >
                  {task.is_completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 hover:text-indigo-500" />
                  )}
                </button>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100/80">
                      {task.subject}
                    </span>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {task.topic}
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

                  <h3 className={`text-base font-semibold text-slate-800 ${task.is_completed ? 'line-through text-slate-400' : ''}`}>
                    {task.title}
                  </h3>

                  {task.description && (
                    <p className="text-xs text-slate-500 max-w-2xl">{task.description}</p>
                  )}
                </div>
              </div>

              {/* Right metadata & Action buttons */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <div className="text-left sm:text-right">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{task.date}</span>
                    {task.start_time && (
                      <span className="font-mono text-slate-400">@{task.start_time}</span>
                    )}
                  </div>
                  <div className="flex items-center sm:justify-end gap-1 text-[11px] text-slate-400 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{task.duration} mins</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(task)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Edit Task"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeletingTask(task)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete Task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Task Modal */}
      <Modal
        isOpen={isCreateOpen || !!editingTask}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingTask(null);
        }}
        title={editingTask ? "Edit Study Task" : "Create New Study Task"}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveForm} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Master Binary Search Trees"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Data Structures"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Topic <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Tree Traversals"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Duration (mins)
              </label>
              <input
                type="number"
                min="15"
                max="360"
                step="15"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>

            {editingTask && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.is_completed ? "done" : "pending"}
                  onChange={(e) => setFormData({ ...formData, is_completed: e.target.value === "done" })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                >
                  <option value="pending">Pending</option>
                  <option value="done">Completed</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Study Notes (Optional)
            </label>
            <textarea
              rows="3"
              placeholder="Key sub-topics, problem lists, or textbook chapter notes..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsCreateOpen(false);
                setEditingTask(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
            >
              {formSubmitting ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingTask}
        onClose={() => setDeletingTask(null)}
        title="Confirm Task Deletion"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete the study task <strong className="text-slate-900">"{deletingTask?.title}"</strong>?
          </p>
          <p className="text-xs text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100">
            This action cannot be undone. All recorded progress for this task will be permanently removed from SQLite storage.
          </p>
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              onClick={() => setDeletingTask(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
