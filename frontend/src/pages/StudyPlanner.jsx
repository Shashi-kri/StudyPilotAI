import React, { useState } from 'react';
import { 
  Sparkles, 
  Calendar, 
  Clock, 
  BookOpen, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  ArrowLeft, 
  RefreshCw, 
  Save, 
  Sliders,
  Check,
  ChevronDown
} from 'lucide-react';
import { api } from '../services/api';

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function StudyPlanner({ onNavigate }) {
  // Form State
  const [studentName, setStudentName] = useState('');
  
  // Default exam date set to 14 days from today
  const defaultExamDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  };

  const [examDate, setExamDate] = useState(defaultExamDate());
  const [dailyHours, setDailyHours] = useState(2.5);
  const [preferredDays, setPreferredDays] = useState([...WEEKDAYS]);
  const [breakPreferences, setBreakPreferences] = useState('10 min break per study block');
  const [isRevisionPrioritized, setIsRevisionPrioritized] = useState(true);

  // Subjects & Topics
  const [subjects, setSubjects] = useState([
    {
      id: 'sub-1',
      name: 'Data Structures & Algorithms',
      difficulty: 'hard',
      topicInput: '',
      topics: ['Binary Search Trees', 'Graph Traversals (BFS/DFS)', 'Dynamic Programming'],
      topicPriorities: {
        'Binary Search Trees': 'high',
        'Graph Traversals (BFS/DFS)': 'high',
        'Dynamic Programming': 'high'
      }
    },
    {
      id: 'sub-2',
      name: 'Computer Networks',
      difficulty: 'medium',
      topicInput: '',
      topics: ['TCP Congestion Control', 'IP Subnetting & CIDR'],
      topicPriorities: {
        'TCP Congestion Control': 'medium',
        'IP Subnetting & CIDR': 'medium'
      }
    }
  ]);

  // Generation & Preview State
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [formError, setFormError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Handlers for subject manipulation
  const handleAddSubject = () => {
    setSubjects([
      ...subjects,
      {
        id: `sub-${Date.now()}`,
        name: '',
        difficulty: 'medium',
        topicInput: '',
        topics: [],
        topicPriorities: {}
      }
    ]);
  };

  const handleRemoveSubject = (id) => {
    if (subjects.length <= 1) {
      alert("At least one subject is required for study planning.");
      return;
    }
    setSubjects(subjects.filter((s) => s.id !== id));
  };

  const handleSubjectChange = (id, field, value) => {
    setSubjects(subjects.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleAddTopic = (subId) => {
    setSubjects(subjects.map((s) => {
      if (s.id === subId && s.topicInput.trim()) {
        const newTopic = s.topicInput.trim();
        if (s.topics.includes(newTopic)) return s;
        return {
          ...s,
          topics: [...s.topics, newTopic],
          topicPriorities: { ...s.topicPriorities, [newTopic]: 'medium' },
          topicInput: ''
        };
      }
      return s;
    }));
  };

  const handleRemoveTopic = (subId, topicName) => {
    setSubjects(subjects.map((s) => {
      if (s.id === subId) {
        const nextTopics = s.topics.filter((t) => t !== topicName);
        const nextPriorities = { ...s.topicPriorities };
        delete nextPriorities[topicName];
        return { ...s, topics: nextTopics, topicPriorities: nextPriorities };
      }
      return s;
    }));
  };

  const handleTopicPriorityChange = (subId, topicName, priority) => {
    setSubjects(subjects.map((s) => {
      if (s.id === subId) {
        return {
          ...s,
          topicPriorities: { ...s.topicPriorities, [topicName]: priority }
        };
      }
      return s;
    }));
  };

  const togglePreferredDay = (day) => {
    if (preferredDays.includes(day)) {
      if (preferredDays.length <= 1) {
        alert("Please select at least one study day per week.");
        return;
      }
      setPreferredDays(preferredDays.filter((d) => d !== day));
    } else {
      setPreferredDays([...preferredDays, day]);
    }
  };

  // Validation
  const validateForm = () => {
    if (!examDate) {
      setFormError("Please select an examination date.");
      return false;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (examDate <= todayStr) {
      setFormError("Examination date must be in the future (at least tomorrow).");
      return false;
    }

    for (let i = 0; i < subjects.length; i++) {
      const s = subjects[i];
      if (!s.name.trim()) {
        setFormError(`Please enter a name for Subject #${i + 1}.`);
        return false;
      }
      if (s.topics.length === 0) {
        setFormError(`Subject "${s.name}" must contain at least one topic. Type a topic and press Add.`);
        return false;
      }
    }

    if (preferredDays.length === 0) {
      setFormError("Please select at least one preferred study day.");
      return false;
    }

    setFormError(null);
    return true;
  };

  // Generate Plan
  const handleGenerate = async () => {
    if (!validateForm()) return;

    try {
      setGenerating(true);
      setFormError(null);

      // Collect topic priority map
      const mergedPriorityMap = {};
      subjects.forEach((s) => {
        Object.entries(s.topicPriorities).forEach(([top, prio]) => {
          mergedPriorityMap[top] = prio;
        });
      });

      const payload = {
        student_name: studentName.trim() || undefined,
        subjects: subjects.map((s) => ({
          name: s.name.trim(),
          difficulty: s.difficulty,
          topics: s.topics
        })),
        exam_date: examDate,
        daily_hours: parseFloat(dailyHours),
        preferred_days: preferredDays,
        topic_priority: mergedPriorityMap,
        break_preferences: breakPreferences,
        is_revision_prioritized: isRevisionPrioritized
      };

      const result = await api.generatePlan(payload);
      setGeneratedPlan(result);
    } catch (err) {
      setFormError(`Study plan generation error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // Save Plan into SQLite Tasks Table
  const handleSavePlan = async () => {
    if (!generatedPlan) return;

    try {
      setSaving(true);
      const subjectDiffMap = {};
      const topicPrioMap = {};
      subjects.forEach((s) => {
        subjectDiffMap[s.name] = s.difficulty;
        Object.entries(s.topicPriorities).forEach(([top, prio]) => {
          topicPrioMap[top] = prio;
        });
      });

      const savePayload = {
        title: generatedPlan.plan_title,
        student_name: studentName.trim() || undefined,
        exam_date: generatedPlan.exam_date,
        daily_hours: generatedPlan.daily_hours,
        preferred_days: preferredDays,
        subject_difficulty: subjectDiffMap,
        topic_priority: topicPrioMap,
        break_preferences: breakPreferences,
        tasks: generatedPlan.tasks
      };

      await api.savePlan(savePayload);
      setSaveSuccess(true);
      setTimeout(() => {
        onNavigate('tasks');
      }, 1200);
    } catch (err) {
      alert(`Error saving study plan: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // If plan has been generated and ready for review:
  if (generatedPlan) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
        
        {/* Plan Header & Review Banner */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generated with {generatedPlan.generation_mode.toUpperCase()} Engine</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">
                {generatedPlan.plan_title}
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Target Exam Date: <span className="font-semibold text-slate-700">{generatedPlan.exam_date}</span> • Daily Target: <span className="font-semibold text-slate-700">{generatedPlan.daily_hours} hrs/day</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setGeneratedPlan(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Edit Parameters</span>
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                <span>Regenerate</span>
              </button>
              <button
                onClick={handleSavePlan}
                disabled={saving || saveSuccess}
                className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Saved! Redirecting...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving Plan...' : 'Save Plan & Create Tasks'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Feasibility Alert Note */}
          {!generatedPlan.is_workload_feasible && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Workload Feasibility Notice</p>
                <p className="mt-0.5 text-amber-800">{generatedPlan.feasibility_notes}</p>
              </div>
            </div>
          )}

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Study Days</span>
              <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 font-heading">{generatedPlan.total_study_days} days</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Total Workload</span>
              <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 font-heading">{generatedPlan.total_hours_planned} hrs</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Total Sessions</span>
              <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 font-heading">{generatedPlan.total_tasks_count} tasks</p>
            </div>
          </div>

          {/* Generated Timeline Tasks */}
          <div className="space-y-3 pt-4">
            <h3 className="text-lg font-bold text-slate-900 font-heading">Scheduled Task Sequence</h3>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
              {generatedPlan.tasks.map((t, idx) => (
                <div key={idx} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        {t.date} {t.start_time ? `• ${t.start_time}` : ''}
                      </span>
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        {t.subject}
                      </span>
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                        t.priority === 'high' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {t.priority}
                      </span>
                    </div>
                    <h4 className="text-base font-semibold text-slate-800">{t.title}</h4>
                    <p className="text-xs text-slate-500">{t.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">
                      {t.duration} mins
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    );
  }

  // Study Plan Form
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Intelligent Scheduling Engine</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">
          AI Study Plan Generator
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Input your subjects, exam date, and daily study capacity to synthesize a structured, non-overlapping preparation schedule.
        </p>
      </div>

      {formError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Main Configuration Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-8">
        
        {/* Section 1: Target Exam & Student Details */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>1. Exam Target & Student Profile</span>
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Student Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Alex Chen"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Examination Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={examDate}
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                required
              />
            </div>
          </div>
        </div>

        {/* Section 2: Study Capacity & Preferences */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h3 className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>2. Daily Availability & Study Days</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600">
                  Available Study Hours Per Day
                </label>
                <span className="text-xs font-bold text-indigo-600 font-mono">
                  {dailyHours} hours / day
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8.0"
                step="0.5"
                value={dailyHours}
                onChange={(e) => setDailyHours(e.target.value)}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>30m</span>
                <span>2h</span>
                <span>4h</span>
                <span>6h</span>
                <span>8h</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">
                Preferred Study Days
              </label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => {
                  const isSelected = preferredDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => togglePreferredDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Break Preferences
              </label>
              <input
                type="text"
                placeholder="e.g. 10 min break per hour"
                value={breakPreferences}
                onChange={(e) => setBreakPreferences(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="rev-prio"
                checked={isRevisionPrioritized}
                onChange={(e) => setIsRevisionPrioritized(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <label htmlFor="rev-prio" className="text-xs font-medium text-slate-700 select-none cursor-pointer">
                Reserve final day before exam for mock drills and comprehensive revision
              </label>
            </div>
          </div>
        </div>

        {/* Section 3: Subjects & Topics */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>3. Subjects & Topics Breakdown</span>
            </h3>
            <button
              type="button"
              onClick={handleAddSubject}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Subject</span>
            </button>
          </div>

          <div className="space-y-4">
            {subjects.map((sub, sIdx) => (
              <div 
                key={sub.id} 
                className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-4 transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Subject #{sIdx + 1} Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Operating Systems"
                        value={sub.name}
                        onChange={(e) => handleSubjectChange(sub.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Difficulty
                      </label>
                      <select
                        value={sub.difficulty}
                        onChange={(e) => handleSubjectChange(sub.id, 'difficulty', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      >
                        <option value="easy">Easy (45 mins/topic)</option>
                        <option value="medium">Medium (60 mins/topic)</option>
                        <option value="hard">Hard (90 mins/topic)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveSubject(sub.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors mt-5"
                    title="Remove Subject"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Topics Tag List */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Topics & Subsections
                  </label>
                  
                  {/* Topic Input Box */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a topic (e.g. Memory Management) and click Add"
                      value={sub.topicInput}
                      onChange={(e) => handleSubjectChange(sub.id, 'topicInput', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTopic(sub.id);
                        }
                      }}
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTopic(sub.id)}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900 rounded-xl transition-colors"
                    >
                      Add
                    </button>
                  </div>

                  {/* Rendered Topic Chips */}
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {sub.topics.map((topic) => {
                      const prio = sub.topicPriorities[topic] || 'medium';
                      return (
                        <div 
                          key={topic} 
                          className="inline-flex items-center gap-2 pl-3 pr-2 py-1 bg-white border border-slate-200 rounded-xl text-xs shadow-2xs"
                        >
                          <span className="font-medium text-slate-700">{topic}</span>
                          <select
                            value={prio}
                            onChange={(e) => handleTopicPriorityChange(sub.id, topic, e.target.value)}
                            className="text-[10px] font-semibold uppercase bg-slate-50 border border-slate-200 rounded-md py-0.5 px-1.5 text-slate-600 cursor-pointer"
                          >
                            <option value="high">High Prio</option>
                            <option value="medium">Med Prio</option>
                            <option value="low">Low Prio</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveTopic(sub.id, topic)}
                            className="text-slate-400 hover:text-rose-500 ml-0.5"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    {sub.topics.length === 0 && (
                      <p className="text-xs text-slate-400 italic py-1">No topics added yet. Add at least one topic above.</p>
                    )}
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>

        {/* Action Button: Generate Schedule */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.01] active:scale-[0.98]"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Synthesizing Optimal Schedule...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Study Plan</span>
              </>
            )}
          </button>
        </div>

      </div>

    </div>
  );
}
