import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import PostRideModal from '../components/PostRideModal';
import { api } from '../api';
import './AccountLandingScreen.css';

const PULL_THRESHOLD = 64;

export default function AccountLandingScreen({ athlete, hasConfiguredBikes, onLogout, summary, onRefreshSummary }) {
  const ACTIONS = [
    { id: 'service-log', label: 'Add Service Log',    path: '/add-service-log' },
    { id: 'quiver',      label: 'Review Your Quiver', path: hasConfiguredBikes ? '/maintenance' : '/add-bike' },
    { id: 'book-service',label: 'Book Service',       path: '/book-service' },
    { id: 'profile',     label: 'Update Profile',     path: '/profile' },
  ];
  const navigate = useNavigate();
  const firstname = athlete?.firstname || 'Rider';

  const [newRides, setNewRides] = useState([]);
  const [showRideModal, setShowRideModal] = useState(false);
  const ridesCheckedRef = useRef(false);

  // Pull-to-refresh state
  const [pullProgress, setPullProgress] = useState(0); // 0–1 during drag
  const [refreshing,   setRefreshing]   = useState(false);
  const pullDyRef      = useRef(0);
  const refreshingRef  = useRef(false);
  const onRefreshRef   = useRef(onRefreshSummary);
  useEffect(() => { onRefreshRef.current = onRefreshSummary; }, [onRefreshSummary]);

  useEffect(() => {
    let startY = 0;
    let active = false;

    function onStart(e) {
      if (window.scrollY === 0 && !refreshingRef.current) {
        startY = e.touches[0].clientY;
        active = true;
      }
    }

    function onMove(e) {
      if (!active) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) { active = false; pullDyRef.current = 0; setPullProgress(0); return; }
      e.preventDefault();
      pullDyRef.current = dy;
      setPullProgress(Math.min(dy / (PULL_THRESHOLD * 2), 1));
    }

    function onEnd() {
      if (!active) return;
      active = false;
      const dy = pullDyRef.current;
      pullDyRef.current = 0;
      setPullProgress(0);
      if (dy >= PULL_THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        Promise.resolve(onRefreshRef.current?.()).finally(() => {
          refreshingRef.current = false;
          setRefreshing(false);
        });
      }
    }

    document.addEventListener('touchstart', onStart,  { passive: true  });
    document.addEventListener('touchmove',  onMove,   { passive: false });
    document.addEventListener('touchend',   onEnd,    { passive: true  });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove',  onMove);
      document.removeEventListener('touchend',   onEnd);
    };
  }, []);

  // Check for new Strava rides since last login — only once per mount, only
  // when Strava is linked (athlete prop is set by the parent when token exists).
  useEffect(() => {
    if (ridesCheckedRef.current || !athlete) return;
    ridesCheckedRef.current = true;
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
        {/* Pull-to-refresh indicator */}
        {(refreshing || pullProgress > 0.05) && (
          <div
            className="ptr-indicator"
            style={{ opacity: refreshing ? 1 : Math.min(pullProgress * 1.5, 1) }}
          >
            {refreshing && <div className="ptr-spinner" />}
          </div>
        )}

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
