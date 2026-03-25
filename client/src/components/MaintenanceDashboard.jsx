import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import AppHeader from './AppHeader';
import BikeSetup from './BikeSetup';
import './MaintenanceDashboard.css';

const BIKE_IMAGES = {
  road:   '/bikes/road.png',
  mtb:    '/bikes/mtb.png',
  gravel: '/bikes/gravel.png',
};

// ── SVG donut: red = critical (due/overdue), teal = alerts (due_soon) ──
function DonutChart({ critical, alerts, totalItems }) {
  const r    = 36;
  const cx   = 44;
  const cy   = 44;
  const circ = 2 * Math.PI * r;

  const critDash  = totalItems > 0 ? (critical / totalItems) * circ : 0;
  const alertDash = totalItems > 0 ? (alerts   / totalItems) * circ : 0;
  const allOk     = critical === 0 && alerts === 0;

  return (
    <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
      {/* Background track */}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="rgba(255,255,255,0.1)" strokeWidth="10" />

      {/* All-good ring */}
      {allOk && (
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="#4ecdc4" strokeWidth="10"
          transform="rotate(-90 44 44)" />
      )}

      {/* Alert segment — teal, starts after critical */}
      {alerts > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="#4ecdc4" strokeWidth="10"
          strokeDasharray={`${alertDash} ${circ - alertDash}`}
          strokeDashoffset={circ - critDash}
          transform="rotate(-90 44 44)"
          strokeLinecap="butt"
        />
      )}

      {/* Critical segment — red, starts at 12 o'clock */}
      {critical > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="#ff4757" strokeWidth="10"
          strokeDasharray={`${critDash} ${circ - critDash}`}
          strokeDashoffset="0"
          transform="rotate(-90 44 44)"
          strokeLinecap="butt"
        />
      )}
    </svg>
  );
}

// ── Individual bike summary card ──
function BikeCard({ bike }) {
  const navigate = useNavigate();
  const [view,       setView]       = useState('loading');
  const [statusData, setStatusData] = useState(null);

  const loadStatus = useCallback(async () => {
    setView('loading');
    try {
      const data = await api.getMaintenanceStatus(bike.id);
      setStatusData(data);
      setView('dashboard');
    } catch (err) {
      if (err.message.includes('400')) {
        setView('setup');
      } else {
        setView('error');
      }
    }
  }, [bike.id]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  if (view === 'loading') {
    return (
      <div className="quiver-card quiver-card--loading">
        <div className="quiver-card-img-placeholder" />
        <div className="quiver-card-body">
          <div className="quiver-skeleton quiver-skeleton--name" />
          <div className="quiver-skeleton quiver-skeleton--sub" />
        </div>
      </div>
    );
  }

  if (view === 'setup') {
    return (
      <div className="quiver-card quiver-card--setup">
        <div className="quiver-card-body">
          <h2 className="quiver-card-name">{bike.name}</h2>
          <BikeSetup bike={bike} onSaved={loadStatus} />
        </div>
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div className="quiver-card quiver-card--error">
        <div className="quiver-card-body">
          <h2 className="quiver-card-name">{bike.name}</h2>
          <p className="quiver-card-error-msg">Failed to load maintenance data.</p>
          <button className="btn-pill quiver-see-more" onClick={loadStatus}>Retry</button>
        </div>
      </div>
    );
  }

  const { bikeType, sections } = statusData;
  const bikeImage  = BIKE_IMAGES[bikeType] || '/bikes/road.png';
  const critical   = sections.reduce((n, s) =>
    n + s.items.filter(i => ['due', 'overdue'].includes(i.status.status)).length, 0);
  const alerts     = sections.reduce((n, s) =>
    n + s.items.filter(i => i.status.status === 'due_soon').length, 0);
  const totalItems = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="quiver-card">
      <div className="quiver-card-img-wrap">
        <img
          src={bikeImage}
          alt={bike.name}
          className="quiver-card-img"
          draggable={false}
        />
      </div>

      <div className="quiver-card-body">
        <h2 className="quiver-card-name">{bike.name}</h2>

        <div className="quiver-card-status">
          <DonutChart critical={critical} alerts={alerts} totalItems={totalItems} />
          <div className="quiver-card-counts">
            <p className="quiver-count-critical">
              {critical} Critical Item{critical !== 1 ? 's' : ''}
            </p>
            <p className="quiver-count-alerts">
              {alerts} Alert{alerts !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <button
          className="btn-pill quiver-see-more"
          onClick={() => navigate(`/maintenance/${bike.id}`)}
        >
          See More
        </button>
      </div>
    </div>
  );
}

// ── Screen ──
export default function MaintenanceDashboard() {
  const navigate = useNavigate();
  const [bikes,   setBikes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  function fetchBikes() {
    setLoading(true);
    setError(null);
    api.getBikes()
      .then(data => {
        console.log('[MaintenanceDashboard] fetched bikes:', data);
        setBikes(data);
      })
      .catch(err => {
        console.error('[MaintenanceDashboard] failed to fetch bikes:', err.message);
        setError(err.message || 'Could not load bikes from Strava.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchBikes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="screen quiver-screen">
      <AppHeader />

      <div className="quiver-body">

        {/* ── Heading ── */}
        <div className="quiver-heading">
          <p className="quiver-heading-sub">Review Your</p>
          <h1 className="quiver-heading-main">Quiver</h1>
        </div>

        {/* ── Bike cards ── */}
        {loading && (
          <p className="quiver-status-text">Loading your bikes…</p>
        )}

        {!loading && error && (
          <div className="quiver-error">
            <p>{error}</p>
            <button className="btn-pill btn-pill-outline" onClick={fetchBikes}>Retry</button>
          </div>
        )}

        {!loading && !error && bikes.length === 0 && (
          <div className="quiver-empty">
            <p>No bikes found on your Strava account.</p>
            <p>
              Add a bike in your{' '}
              <a href="https://www.strava.com/settings/gear" target="_blank" rel="noreferrer">
                Strava gear settings
              </a>
              , then come back.
            </p>
          </div>
        )}

        {!loading && !error && bikes.length > 0 && (
          <div className="quiver-cards">
            {bikes.map(bike => (
              <BikeCard key={bike.id} bike={bike} />
            ))}
          </div>
        )}

        {/* ── Footer links ── */}
        <div className="quiver-footer-links">
          <button className="quiver-link" onClick={() => navigate('/add-service-log')}>
            Add a Service Log
          </button>
          <span className="quiver-link-sep" aria-hidden="true">·</span>
          <button className="quiver-link" onClick={() => navigate('/add-bike')}>
            Add a Bike
          </button>
          <span className="quiver-link-sep" aria-hidden="true">·</span>
          <button className="quiver-link" onClick={() => navigate('/book-maintenance')}>
            Book Maintenance
          </button>
        </div>

      </div>
    </div>
  );
}
