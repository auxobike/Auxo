import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api } from '../api';
import './BikeInspector.css';

const BIKE_IMAGES = {
  road:   '/bikes/road.png',
  mtb:    '/bikes/mtb.png',
  gravel: '/bikes/gravel.png',
};

// ── Status helpers ────────────────────────────────────────────────────────────

function statusPillText(item) {
  const s  = item.status;
  const st = s.status;
  if (st === 'due' || st === 'overdue') return 'DUE';

  switch (item.trigger?.type) {
    case 'miles':              return `${s.remaining} mi`;
    case 'rides':              return `${s.remaining} rides`;
    case 'days':               return `${s.remaining} days`;
    case 'miles_or_days':      return s.milesRemaining <= s.daysRemaining
                                 ? `${s.milesRemaining} mi`
                                 : `${s.daysRemaining} days`;
    case 'chain_replacements': return `${s.remaining} chains`;
    case 'hours_or_days':      return `${s.hoursRemaining} hrs`;
    case 'hours_user_defined': return `${s.remaining} hrs`;
    default: return '';
  }
}

function sectionWorstStatus(items) {
  if (items.some(i => i.status.status === 'overdue'))  return 'overdue';
  if (items.some(i => i.status.status === 'due'))      return 'due';
  if (items.some(i => i.status.status === 'due_soon')) return 'due_soon';
  return 'ok';
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function LogArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="spinner-icon">
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ItemRow({ item, logging, onLog, onLearn }) {
  const navigate = useNavigate();
  const st       = item.status.status;
  const pillText = statusPillText(item);

  return (
    <div className="inspector-item">
      <button
        className={`inspector-log-btn${logging ? ' inspector-log-btn--loading' : ''}`}
        onClick={onLog}
        disabled={logging}
        aria-label={`Log service: ${item.label} — ${item.action}`}
      >
        {logging ? <SpinnerIcon /> : <LogArrowIcon />}
      </button>

      <div className="inspector-item-info">
        <span className="inspector-item-label">{item.label}</span>
        <span className="inspector-item-action">{item.action}</span>
      </div>

      {pillText && (
        <span className={`inspector-status-pill inspector-status-pill--${st}`}>
          {pillText}
        </span>
      )}

      <button
        className="inspector-learn-btn"
        onClick={() => navigate('/learn')}
        aria-label={`Learn about ${item.label}`}
      >
        Learn
      </button>
    </div>
  );
}

function SectionCard({ section, bikeId, loggingItems, onLog }) {
  const worst       = sectionWorstStatus(section.items);
  const needsBook   = worst !== 'ok';
  const bookUrgent  = worst === 'due' || worst === 'overdue';

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">
        <div className="inspector-section-title-row">
          <span className={`inspector-section-dot dot--${worst}`} aria-hidden="true" />
          <h3 className="inspector-section-title">{section.label}</h3>
        </div>
        {needsBook && (
          <button className={`inspector-book-btn${bookUrgent ? ' inspector-book-btn--urgent' : ' inspector-book-btn--soon'}`}>
            Book
          </button>
        )}
      </div>

      <div className="inspector-items">
        {section.items.map(item => (
          <ItemRow
            key={item.id}
            item={item}
            logging={loggingItems.has(item.id)}
            onLog={() => onLog(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function BikeInspector({ onLogout }) {
  const { bikeId }  = useParams();
  const navigate    = useNavigate();

  const [statusData,       setStatusData]       = useState(null);
  const [loadingStatus,    setLoadingStatus]    = useState(true);
  const [error,            setError]            = useState(null);
  const [bikes,            setBikes]            = useState([]);
  const [loggingItems,     setLoggingItems]     = useState(new Set());
  const [showForgetConfirm, setShowForgetConfirm] = useState(false);
  const [forgetting,        setForgetting]        = useState(false);

  // Bike list for prev/next nav
  useEffect(() => {
    api.getBikes().then(setBikes).catch(() => {});
  }, []);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError(null);
    try {
      const data = await api.getMaintenanceStatus(bikeId);
      setStatusData(data);
    } catch (err) {
      setError(err.message || 'Failed to load maintenance data.');
    } finally {
      setLoadingStatus(false);
    }
  }, [bikeId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function handleForgetBike() {
    setForgetting(true);
    try {
      await api.deleteBike(bikeId);
      navigate('/maintenance', { replace: true });
    } catch (err) {
      console.error('[BikeInspector] forget bike failed:', err.message);
      setForgetting(false);
      setShowForgetConfirm(false);
    }
  }

  async function handleLog(itemId) {
    setLoggingItems(prev => new Set(prev).add(itemId));
    try {
      await api.logService(bikeId, itemId);
      await loadStatus();
    } catch (err) {
      console.error('[BikeInspector] log service failed:', err.message);
    } finally {
      setLoggingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  // Bike carousel nav
  const bikeIdx = bikes.findIndex(b => b.id === bikeId);
  const hasManyBikes = bikes.length > 1;
  const prevBike = hasManyBikes ? bikes[(bikeIdx - 1 + bikes.length) % bikes.length] : null;
  const nextBike = hasManyBikes ? bikes[(bikeIdx + 1) % bikes.length]                : null;

  // Derived counts
  const critical = statusData
    ? statusData.sections.reduce((n, s) =>
        n + s.items.filter(i => ['due', 'overdue'].includes(i.status.status)).length, 0)
    : 0;
  const alerts = statusData
    ? statusData.sections.reduce((n, s) =>
        n + s.items.filter(i => i.status.status === 'due_soon').length, 0)
    : 0;

  const bikeImage = BIKE_IMAGES[statusData?.bikeType] || '/bikes/road.png';
  const bikeName  = statusData?.gear?.name
    || bikes.find(b => b.id === bikeId)?.name
    || '…';

  // ── Render ──

  if (loadingStatus) {
    return (
      <div className="screen inspector-screen">
        <AppHeader onLogout={onLogout} />
        <div className="inspector-loading">
          <p className="inspector-loading-text">Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="screen inspector-screen">
        <AppHeader onLogout={onLogout} />
        <div className="inspector-error">
          <p className="inspector-error-text">{error}</p>
          <button className="btn-pill btn-pill-outline" onClick={loadStatus}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen inspector-screen">
      <AppHeader onLogout={onLogout} />

      {/* ── Bike navigation header ── */}
      <div className="inspector-nav-header">
        <button
          className="inspector-nav-arrow"
          onClick={() => navigate(`/maintenance/${prevBike.id}`)}
          disabled={!prevBike}
          aria-label="Previous bike"
        >
          <ChevronLeftIcon />
        </button>
        <h1 className="inspector-bike-name">{bikeName}</h1>
        <button
          className="inspector-nav-arrow"
          onClick={() => navigate(`/maintenance/${nextBike.id}`)}
          disabled={!nextBike}
          aria-label="Next bike"
        >
          <ChevronRightIcon />
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="inspector-body">

        {/* Hero */}
        <div className="inspector-hero">
          <div className="inspector-hero-img-wrap">
            <img
              src={bikeImage}
              alt={bikeName}
              className="inspector-hero-img"
              draggable={false}
            />
            <div className="inspector-hero-banners">
              <div className="inspector-banner inspector-banner--critical">
                {critical} Critical Item{critical !== 1 ? 's' : ''}
              </div>
              <div className="inspector-banner inspector-banner--alert">
                {alerts} Alert{alerts !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <button
            className="btn-pill btn-pill-ghost inspector-mechanic-btn"
            onClick={() => navigate('/book-service')}
          >
            Find a Mechanic
          </button>
        </div>

        {/* Maintenance sections */}
        <div className="inspector-sections">
          {statusData.sections.map(section => (
            <SectionCard
              key={section.id}
              section={section}
              bikeId={bikeId}
              loggingItems={loggingItems}
              onLog={handleLog}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="inspector-footer">
          <button
            className="btn-pill btn-pill-outline inspector-adjust-btn"
            onClick={() => navigate(`/maintenance/${bikeId}/intervals`)}
          >
            Adjust Service Intervals
          </button>
          <button className="inspector-reset-link">
            Reset All Service Intervals
          </button>

          {!showForgetConfirm ? (
            <button
              className="inspector-reset-link inspector-forget-link"
              onClick={() => setShowForgetConfirm(true)}
            >
              Forget this bike
            </button>
          ) : (
            <div className="inspector-forget-confirm">
              <p className="inspector-forget-confirm-text">
                Are you sure? This will remove all maintenance data for{' '}
                <strong>{bikeName}</strong>.
              </p>
              <div className="inspector-forget-confirm-actions">
                <button
                  className="inspector-forget-cancel"
                  onClick={() => setShowForgetConfirm(false)}
                  disabled={forgetting}
                >
                  Cancel
                </button>
                <button
                  className="inspector-forget-delete"
                  onClick={handleForgetBike}
                  disabled={forgetting}
                >
                  {forgetting ? 'Removing…' : 'Yes, Forget'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
