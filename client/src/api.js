const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include', // send session cookie
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const api = {
  // Auth
  getMe:          () => apiFetch('/auth/me'),
  logout:         () => apiFetch('/auth/logout', { method: 'POST' }),
  connectStrava:  () => { window.location.href = `${BASE_URL}/auth/strava`; },

  // Strava
  getActivities:  (page = 1) => apiFetch(`/api/strava/activities?page=${page}&per_page=30`),
  getActivity:    (id) => apiFetch(`/api/strava/activities/${id}`),
  getBikes:       () => apiFetch('/api/strava/bikes'),
  getBike:        (id) => apiFetch(`/api/strava/bikes/${id}`),

  // Maintenance
  getMaintenanceStatus: (bikeId) => apiFetch(`/api/maintenance/status/${bikeId}`),
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
