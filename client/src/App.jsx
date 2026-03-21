import { useEffect, useState } from 'react';
import { api } from './api';
import MaintenanceDashboard from './components/MaintenanceDashboard';
import './App.css';

export default function App() {
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMe()
      .then(data => { if (data.authenticated) setAthlete(data.athlete); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setAthlete(null);
  };

  if (loading) return <div className="loading">Loading…</div>;

  if (!athlete) {
    return (
      <div className="landing">
        <h1>Auxo</h1>
        <p>Track your bike maintenance, powered by your Strava rides.</p>
        <button onClick={api.connectStrava} className="btn-strava">
          Connect with Strava
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-logo">Auxo</h1>
        <div className="user-info">
          {athlete.profile_medium && (
            <img src={athlete.profile_medium} alt="Profile" className="avatar" />
          )}
          <span>{athlete.firstname} {athlete.lastname}</span>
          <button onClick={handleLogout} className="btn-logout">Logout</button>
        </div>
      </header>

      <main className="app-main">
        <MaintenanceDashboard />
      </main>
    </div>
  );
}
