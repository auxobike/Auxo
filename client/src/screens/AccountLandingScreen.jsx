import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import PostRideModal from '../components/PostRideModal';
import { api } from '../api';
import './AccountLandingScreen.css';

// Module-level flag: only fetch new rides once per page load, not on every
// remount of this screen (e.g. navigating away and back in the same session).
let _ridesChecked = false;

export default function AccountLandingScreen({ athlete, hasConfiguredBikes, onLogout }) {
  const ACTIONS = [
    { id: 'service-log', label: 'Add Service Log',    path: '/add-service-log' },
    { id: 'quiver',      label: 'Review Your Quiver', path: hasConfiguredBikes ? '/maintenance' : '/add-bike' },
    { id: 'book-service',label: 'Book Service',       path: '/book-service' },
    { id: 'profile',     label: 'Update Profile',     path: '/profile' },
  ];
  const navigate = useNavigate();
  const firstname = athlete?.firstname || 'Rider';

  const [summary, setSummary] = useState(null);
  const [newRides, setNewRides] = useState([]);
  const [showRideModal, setShowRideModal] = useState(false);

  useEffect(() => {
    api.getSummary().then(setSummary).catch(() => {});
  }, []);

  // Check for new Strava rides since last login — only once per page load, only
  // when Strava is linked (athlete prop is set by the parent when token exists).
  useEffect(() => {
    if (_ridesChecked || !athlete) return;
    _ridesChecked = true;
    api.getNewRides()
      .then(rides => {
        if (rides.length > 0) {
          setNewRides(rides);
          setShowRideModal(true);
        }
      })
      .catch(() => {});
  }, [athlete]);

  return (
    <div className="screen landing-screen">
      <AppHeader onLogout={onLogout} />

      {showRideModal && (
        <PostRideModal
          rides={newRides}
          onClose={() => setShowRideModal(false)}
        />
      )}

      <main className="landing-body">
        {/* Greeting */}
        <div className="landing-greeting">
          <p className="landing-welcome-sub text-muted">Welcome back</p>
          <h1 className="landing-yo">
            Yo,&nbsp;{firstname}!
          </h1>
        </div>

        {/* Action buttons */}
        <div className="action-buttons">
          {ACTIONS.map(action => (
            <button
              key={action.id}
              className="btn-pill btn-pill-gold action-btn"
              onClick={() => navigate(action.path)}
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Quick stats strip */}
        <div className="landing-stats">
          <div className="stat-pill">
            <span className="stat-label">Bikes</span>
            <span className="stat-value text-accent">
              {summary ? summary.bikeCount : '—'}
            </span>
          </div>
          <div className="stat-divider" />
          <div className="stat-pill">
            <span className="stat-label">Items due</span>
            <span className="stat-value text-accent">
              {summary ? summary.itemsDue : '—'}
            </span>
          </div>
          <div className="stat-divider" />
          <div className="stat-pill">
            <span className="stat-label">Last ride</span>
            <span className="stat-value text-accent">
              {summary
                ? summary.lastRide
                  ? new Date(summary.lastRide + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : '—'
                : '—'}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
