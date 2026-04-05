// In dev, requests are proxied by Vite (vite.config.js proxy → localhost:3001).
// In production, VITE_API_URL must be set as a build-time env var on the
// frontend Railway service (e.g. https://auxo-server-production.up.railway.app).
// Without it, all fetch calls resolve to the frontend origin and silently 404.
const BASE_URL = import.meta.env.VITE_API_URL || '';
console.log('[api] BASE_URL:', import.meta.env.VITE_API_URL, '| resolved:', BASE_URL);

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* ignore parse errors */ }
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  // Auth
  getMe:     () => apiFetch('/auth/me'),
  logout:    () => apiFetch('/auth/logout', { method: 'POST' }),
  register:  (email, password, confirm) => apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, confirm }),
  }),
  login: (email, password) => apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  connectStrava: () => {
    // Relative path works in both dev (Vite proxies /auth → localhost:3001)
    // and production (same domain, Express handles /auth directly).
    window.location.href = '/auth/strava';
  },

  // Strava
  getActivities:  (page = 1) => apiFetch(`/api/strava/activities?page=${page}&per_page=30`),
  getActivity:    (id) => apiFetch(`/api/strava/activities/${id}`),
  getBikes:       () => apiFetch('/api/strava/bikes'),
  getBike:        (id) => apiFetch(`/api/strava/bikes/${id}`),

  // Maintenance
  getConfiguredBikes:   () => apiFetch('/api/maintenance/configured'),
  getMaintenanceStatus: (bikeId) => apiFetch(`/api/maintenance/status/${bikeId}`),
  getMaintenanceItems:  (bikeId) => apiFetch(`/api/maintenance/items/${bikeId}`),
  configureBike: (bikeId, config) => apiFetch(`/api/maintenance/bikes/${bikeId}`, {
    method: 'PUT',
    body: JSON.stringify(config),
  }),
  logService: (bikeId, itemId, data = {}) => apiFetch(`/api/maintenance/log/${bikeId}/${itemId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getServiceHistory: (bikeId, itemId) => apiFetch(`/api/maintenance/history/${bikeId}/${itemId}`),
  getSummary: () => apiFetch('/api/maintenance/summary'),
  getBikeConfig:  (bikeId) => apiFetch(`/api/maintenance/bikes/${bikeId}/config`),
  deleteBike:     (bikeId) => apiFetch(`/api/maintenance/bikes/${bikeId}`, { method: 'DELETE' }),
  saveIntervals:  (bikeId, intervals) => apiFetch(`/api/maintenance/bikes/${bikeId}/intervals`, {
    method: 'PUT',
    body: JSON.stringify({ intervals }),
  }),

  // Profile / account management
  changePassword: (currentPassword, newPassword, confirm) => apiFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword, confirm }),
  }),
  updatePreferences: (prefs) => apiFetch('/auth/preferences', {
    method: 'PUT',
    body: JSON.stringify(prefs),
  }),
  deleteAccount: () => apiFetch('/auth/account', { method: 'DELETE' }),

  // Shops
  getFeaturedShops: () => apiFetch('/api/shops/featured'),
};
