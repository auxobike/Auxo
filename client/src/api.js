// In dev, requests are proxied by Vite (same origin — no CORS, cookies work).
// In production, set VITE_API_URL to your backend URL.
const BASE_URL = import.meta.env.VITE_API_URL || '';

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
    // Hard redirect must go directly to the backend (not through the Vite proxy)
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    window.location.href = `${backendUrl}/auth/strava`;
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
};
