import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import AppHeader from './AppHeader';
import './MaintenanceDashboard.css';

const BIKE_IMAGES = {
  road:   '/bikes/road-bike-black.png',
  mtb:    '/bikes/hardtail.png',
  gravel: '/bikes/gravel-bike-white.png',
};

// ── SVG donut: three-segment ring always filling the full circle ──
// Red = critical (due/overdue), gold = alerts (due_soon), teal = ok
function DonutChart({ critical, alerts, totalItems }) {
  const r    = 36;
  const cx   = 44;
  const cy   = 44;
  const circ = 2 * Math.PI * r;

  const ok       = Math.max(0, totalItems - critical - alerts);
  const critLen  = totalItems > 0 ? (critical / totalItems) * circ : 0;
  const alertLen = totalItems > 0 ? (alerts   / totalItems) * circ : 0;
  const okLen    = totalItems > 0 ? (ok       / totalItems) * circ : circ;

  // Segments ordered: critical → alerts → ok, each starting where the previous ends.
  // strokeDashoffset (negative) advances the dash pattern so the segment begins
  // at the right position around the ring (12 o'clock origin via rotate(-90)).
  const segments = [
    { color: '#ff4757', len: critLen,  offset: 0 },
    { color: '#c9960c', len: alertLen, offset: critLen },
    { color: '#128D93', len: okLen,    offset: critLen + alertLen },
  ];

  return (
    <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
      {segments
        .filter(s => s.len > 0)
        .map(s => (
          <circle
            key={s.color}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="10"
            strokeLinecap="butt"
            strokeDasharray={`${s.len} ${circ - s.len}`}
            strokeDashoffset={-s.offset}
            transform="rotate(-90 44 44)"
          />
        ))
      }
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
    } catch {
      setView('error');
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
  const bikeImage  = BIKE_IMAGES[bikeType] || '/bikes/road-bike-black.png';
  const critical   = sections.reduce((n, s) =>
    n + s.items.filter(i => ['due', 'overdue'].includes(i.status.status)).length, 0);
  const alerts     = sections.reduce((n, s) =>
    n + s.items.filter(i => i.status.status === 'due_soon').length, 0);
  const totalItems = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="quiver-card" onClick={() => navigate(`/maintenance/${bike.id}`)}>
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

        <button className="btn-pill quiver-see-more">
          See More
        </button>
      </div>
    </div>
  );
}

// ── Screen ──
export default function MaintenanceDashboard({ onLogout }) {
  const navigate = useNavigate();
  const [bikes,   setBikes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  function fetchBikes() {
    setLoading(true);
    setError(null);
    Promise.all([api.getBikes(), api.getConfiguredBikes()])
      .then(([allBikes, { configuredBikeIds }]) => {
        const configured = new Set(configuredBikeIds);
        setBikes(allBikes.filter(b => configured.has(b.id)));
      })
      .catch(err => {
        console.error('[MaintenanceDashboard] failed to fetch bikes:', err.message);
        setError(err.message || 'Could not load bikes.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchBikes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="screen quiver-screen">
      <AppHeader onLogout={onLogout} />

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
            <p>No bikes set up yet.</p>
            <p>Use <strong>Add a Bike</strong> below to get started.</p>
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
