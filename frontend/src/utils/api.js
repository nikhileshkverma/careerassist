import axios from 'axios';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('ca5_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) { localStorage.removeItem('ca5_token'); window.location.href = '/login'; }
  return Promise.reject(err);
});

export const authAPI = {
  register: d => api.post('/auth/register', d),
  login:    d => api.post('/auth/login', d),
  me:       () => api.get('/auth/me'),
};

export const profileAPI = {
  get:         () => api.get('/profile'),
  save:        d  => api.post('/profile', d),
  parseResume: fd => api.post('/profile/parse-resume', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const careerAPI = {
  recommend:         () => api.post('/career/recommend'),
  getRecommendations:() => api.get('/career/recommendations'),
  simulate:      (skill, skills) => api.post('/career/simulate', { new_skill: skill, new_skills: skills }),
  roadmap:       d      => api.post('/career/roadmap', d),
  counsel:       d      => api.post('/career/counsel', d),
  counselHistory:() => api.get('/career/counsel/history'),
  clearCounselHistory: () => api.delete('/career/counsel/history'),
  aiStatus:      () => api.get('/career/ai-status'),
};

export const resumeAPI = {
  list:          () => api.get('/resume'),
  upload:        fd => api.post('/resume/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update:     (id,d) => api.put(`/resume/${id}`, d),
  remove:        id  => api.delete(`/resume/${id}`),
  setPrimary:    id  => api.patch(`/resume/${id}/primary`),
  analyzeJD:  (id,d) => api.post(`/resume/${id}/analyze-jd`, d),
  tailor:     (id,d) => api.post(`/resume/${id}/tailor`, d),
  tailorTemp: (id,d) => api.post(`/resume/${id}/tailor-temp`, d),
  reparse:    (id)   => api.post(`/resume/${id}/reparse`),
  editSection:(id,d) => api.post(`/resume/${id}/edit-section`, d),
  chat:       (id,d) => api.post(`/resume/${id}/chat`, d),
  fetchMarketRoles: () => api.get('/resume/market-roles'),
};

export const jobsAPI = {
  recommended: (params) => api.get('/jobs/recommended', { params }),
  saved:       () => api.get('/jobs/saved'),
  applied:     () => api.get('/jobs/applied'),
  saveJob:     (id, d) => api.post(`/jobs/${id}/save`, d || {}),
  unsaveJob:   id => api.delete(`/jobs/${id}/save`),
  applyJob:    (id, d) => api.post(`/jobs/${id}/apply`, d || {}),
  confirmApply:(id, didApply) => api.post(`/jobs/${id}/confirm-apply`, { didApply }),
  dismiss:      id => api.post(`/jobs/${id}/dismiss`),
  clearDismissed: () => api.delete('/jobs/dismissed'),
  liveSearch: (company, query) => api.get('/jobs/live-search', { params: { company, query } }),
  refresh:     (force) => api.post(`/jobs/refresh${force ? '?force=true' : ''}`),
  meta:        () => api.get('/jobs/meta'),
};

export const feedbackAPI = {
  submit:         d    => api.post('/feedback', d),
  myFeedback:     ()   => api.get('/feedback/my'),
  publishedStories: () => api.get('/feedback/published-stories'),
  adminAll:       ()   => api.get('/feedback/admin/all'),
  adminUpdate:    (id,d) => api.patch(`/feedback/admin/${id}`, d),
  adminPublish:   (id,publish) => api.patch(`/feedback/admin/${id}/publish`, { publish }),
  adminStats:     ()   => api.get('/feedback/admin/stats'),
};

export const notifAPI = {
  getAll:       () => api.get('/notifications'),
  unreadCount:  () => api.get('/notifications/unread-count'),
  readAll:      () => api.patch('/notifications/read-all'),
  markRead:     id => api.patch(`/notifications/${id}/read`),
};

export const successAPI = { report: d => api.post('/success/report', d) };

export const adminAPI = {
  stats:      () => api.get('/admin/stats'),
  users:      () => api.get('/admin/users'),
  deleteUser: id => api.delete(`/admin/users/${id}`),
  getRoles:   () => api.get('/admin/roles'),
  createRole: d  => api.post('/admin/roles', d),
  deleteRole: id => api.delete(`/admin/roles/${id}`),
  activity:   () => api.get('/admin/activity'),
};

export default api;

export const eventsAPI = {
  getAll: params => api.get('/events', { params }),
};
