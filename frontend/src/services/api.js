const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const res = await fetch(url, config);
    if (!res.ok) {
      let errorMsg = `HTTP Error ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson.detail) {
          errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // Fallback to status text
        errorMsg = res.statusText || errorMsg;
      }
      throw new Error(errorMsg);
    }
    return await res.json();
  } catch (err) {
    console.error(`API Error on [${options.method || 'GET'} ${url}]:`, err);
    throw err;
  }
}

export const api = {
  // Health
  getHealth: () => request('/health'),

  // Dashboard
  getDashboard: () => request('/dashboard'),

  // Tasks
  getTasks: (filterType = 'all', subject = null) => {
    let q = `?filter_type=${encodeURIComponent(filterType)}`;
    if (subject) q += `&subject=${encodeURIComponent(subject)}`;
    return request(`/tasks${q}`);
  },
  getTask: (id) => request(`/tasks/${id}`),
  createTask: (taskData) => request('/tasks', {
    method: 'POST',
    body: JSON.stringify(taskData),
  }),
  updateTask: (id, taskData) => request(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(taskData),
  }),
  toggleTask: (id) => request(`/tasks/${id}/toggle`, {
    method: 'POST',
  }),
  deleteTask: (id) => request(`/tasks/${id}`, {
    method: 'DELETE',
  }),

  // Plans
  generatePlan: (planRequest) => request('/plans/generate', {
    method: 'POST',
    body: JSON.stringify(planRequest),
  }),
  savePlan: (planData) => request('/plans', {
    method: 'POST',
    body: JSON.stringify(planData),
  }),
  getPlans: () => request('/plans'),
  getPlan: (id) => request(`/plans/${id}`),
  getPlanIcalUrl: (id) => `/api/plans/${id}/export/ical`,

  // Conversational Assistant
  sendAssistantChat: (message, conversationHistory = []) => request('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message, conversation_history: conversationHistory }),
  }),
};
