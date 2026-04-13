import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api } from '../api';
import './BikeInspector.css';

const BIKE_IMAGES = {
  road:   '/bikes/road-bike-black.png',
  mtb:    '/bikes/hardtail.png',
  gravel: '/bikes/gravel-bike-white.png',
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

// ── Constants shared with recent rides edit form ──────────────────────────────

const CONDITIONS = [
  { id: 'dry',   label: 'Dry' },
  { id: 'wet',   label: 'Wet' },
  { id: 'muddy', label: 'Muddy / Off-road' },
];

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
  const [showResetConfirm,  setShowResetConfirm]  = useState(false);
  const [resetting,         setResetting]         = useState(false);
  const [logError,          setLogError]          = useState(null);

  // Recent rides state
  const [recentRides,   setRecentRides]   = useState([]);
  const [loadingRides,  setLoadingRides]  = useState(false);
  const [editingRideId, setEditingRideId] = useState(null);
  const [rideEdits,     setRideEdits]     = useState({});
  const [savingRide,    setSavingRide]    = useState(null);

  // Bike list for prev/next nav
  useEffect(() => {
    api.getBikes().then(setBikes).catch(() => {});
  }, []);

  // Recent rides for this bike
  useEffect(() => {
    setLoadingRides(true);
    api.getRecentRidesForBike(bikeId)
      .then(setRecentRides)
      .catch(() => {})
      .finally(() => setLoadingRides(false));
  }, [bikeId]);

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

  async function handleReset() {
    setResetting(true);
    try {
      await api.resetServiceIntervals(bikeId);
      setShowResetConfirm(false);
      await loadStatus();
    } catch (err) {
      console.error('[BikeInspector] reset failed:', err.message);
    } finally {
      setResetting(false);
    }
  }

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
    setLogError(null);
    setLoggingItems(prev => new Set(prev).add(itemId));
    try {
      await api.logService(bikeId, itemId);
      await loadStatus();
    } catch (err) {
      console.error('[BikeInspector] log service failed:', err.message);
      setLogError(err.message || 'Failed to log service. Please try again.');
    } finally {
      setLoggingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  // ── Recent rides edit helpers ──

  function setRideEdit(rideId, field, value) {
    setRideEdits(prev => ({
      ...prev,
      [rideId]: { ...(prev[rideId] || {}), [field]: value },
    }));
  }

  function getEffectiveRideValues(ride) {
    const edit = rideEdits[ride.id] || {};
    const baseCondition = ride.condition && ride.condition !== 'trainer' ? ride.condition : null;
    return {
      isTrainer: 'isTrainer'  in edit ? edit.isTrainer  : ride.isTrainer,
      condition: 'condition'  in edit ? edit.condition  : baseCondition,
      gearId:    'gearId'     in edit ? edit.gearId     : ride.gearId,
    };
  }

  function cancelRideEdit(rideId) {
    setEditingRideId(null);
    setRideEdits(prev => { const next = { ...prev }; delete next[rideId]; return next; });
  }

  async function handleSaveRideEdit(ride) {
    const { isTrainer, condition, gearId } = getEffectiveRideValues(ride);
    setSavingRide(ride.id);
    try {
      if (!isTrainer && !condition) {
        await api.clearRideCondition(ride.id);
      } else {
        await api.updateRideCondition(ride.id, {
          isTrainer,
          condition: isTrainer ? null : condition,
          gearId,
          distanceMiles: ride.distanceMiles,
        });
      }
      const updated = await api.getRecentRidesForBike(bikeId);
      setRecentRides(updated);
      cancelRideEdit(ride.id);
    } catch (err) {
      console.error('[BikeInspector] save ride edit failed:', err.message);
    } finally {
      setSavingRide(null);
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

  const bikeImage = BIKE_IMAGES[statusData?.bikeType] || '/bikes/road-bike-black.png';
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

          {/* Mileage stats */}
          <div className="inspector-mileage-strip">
            <div className="inspector-mileage-stat">
              <span className="inspector-mileage-label">Strava Miles</span>
              <span className="inspector-mileage-value">{statusData.rawMileage?.toLocaleString() ?? '—'}</span>
            </div>
            {statusData.effectiveMileage > statusData.rawMileage && (
              <>
                <div className="inspector-mileage-divider" />
                <div className="inspector-mileage-stat">
                  <span className="inspector-mileage-label">Effective Miles</span>
                  <span className="inspector-mileage-value inspector-mileage-value--accent">
                    {statusData.effectiveMileage?.toLocaleString()}
                  </span>
                </div>
              </>
            )}
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

        {logError && (
          <div className="inspector-log-error">
            <p>{logError}</p>
            <button onClick={() => setLogError(null)}>Dismiss</button>
          </div>
        )}

        {/* Recent Rides */}
        <div className="inspector-recent-rides">
          <h3 className="inspector-recent-rides-heading">Recent Rides</h3>

          {loadingRides ? (
            <div className="inspector-recent-rides-loading"><SpinnerIcon /></div>
          ) : recentRides.length === 0 ? (
            <p className="inspector-recent-rides-empty">No recent rides found for this bike.</p>
          ) : (
            recentRides.map(ride => {
                const isEditing = editingRideId === ride.id;
                const { isTrainer: effIsTrainer, condition: effCondition } =
                  getEffectiveRideValues(ride);

                return (
                  <div key={ride.id} className="inspector-ride-row">
                    {/* Ride summary row */}
                    <div className="inspector-ride-summary">
                      <div className="inspector-ride-summary-info">
                        <span className="inspector-ride-name">{ride.name}</span>
                        <span className="inspector-ride-meta">
                          {ride.date
                            ? new Date(ride.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : ''
                          }
                          {ride.distanceMiles ? ` · ${ride.distanceMiles < 10 ? ride.distanceMiles.toFixed(1) : Math.round(ride.distanceMiles)} mi` : ''}
                        </span>
                      </div>
                      <div className="inspector-ride-summary-right">
                        {ride.hasCondition && !isEditing && (
                          effIsTrainer ? (
                            <span className="inspector-ride-badge inspector-ride-badge--trainer">Trainer</span>
                          ) : effCondition ? (
                            <span className={`inspector-ride-badge inspector-ride-badge--${effCondition}`}>
                              {effCondition.charAt(0).toUpperCase() + effCondition.slice(1)}
                            </span>
                          ) : null
                        )}
                        {!ride.hasCondition && !isEditing && (
                          <span className="inspector-ride-badge inspector-ride-badge--untagged">Not tagged</span>
                        )}
                        <button
                          className={`inspector-ride-edit-btn${isEditing ? ' inspector-ride-edit-btn--active' : ''}`}
                          onClick={() => isEditing ? cancelRideEdit(ride.id) : setEditingRideId(ride.id)}
                        >
                          {isEditing ? 'Cancel' : 'Edit'}
                        </button>
                      </div>
                    </div>

                    {/* Inline edit form */}
                    {isEditing && (
                      <div className="inspector-ride-edit-form">
                        {/* Bike selector */}
                        <div className="inspector-ride-edit-field">
                          <span className="inspector-ride-edit-label">Bike</span>
                          <select
                            className="inspector-ride-select"
                            value={rideEdits[ride.id]?.gearId ?? ride.gearId ?? ''}
                            onChange={e => setRideEdit(ride.id, 'gearId', e.target.value || null)}
                          >
                            <option value="">No bike</option>
                            {bikes.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                        </div>

                        {effIsTrainer ? (
                          <>
                            <span className="inspector-trainer-badge-sm">Trainer Ride — drivetrain wear 60%, tires/brakes 0%</span>
                            <button
                              className="inspector-ride-toggle-btn"
                              onClick={() => setRideEdit(ride.id, 'isTrainer', false)}
                            >
                              Switch to outdoor ride
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="inspector-ride-edit-field">
                              <span className="inspector-ride-edit-label">Conditions</span>
                              <div className="inspector-ride-conditions">
                                {CONDITIONS.map(c => (
                                  <button
                                    key={c.id}
                                    className={`inspector-condition-pill${effCondition === c.id ? ' inspector-condition-pill--active' : ''}`}
                                    onClick={() => setRideEdit(ride.id, 'condition', effCondition === c.id ? null : c.id)}
                                  >
                                    {c.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {effCondition && (
                              <button
                                className="inspector-ride-clear-btn"
                                onClick={() => setRideEdit(ride.id, 'condition', null)}
                              >
                                Clear conditions
                              </button>
                            )}
                            <button
                              className="inspector-ride-toggle-btn"
                              onClick={() => {
                                setRideEdit(ride.id, 'isTrainer', true);
                                setRideEdit(ride.id, 'condition', null);
                              }}
                            >
                              Mark as trainer ride
                            </button>
                          </>
                        )}

                        <div className="inspector-ride-edit-actions">
                          <button
                            className="btn-pill btn-pill-gold inspector-ride-save-btn"
                            onClick={() => handleSaveRideEdit(ride)}
                            disabled={savingRide === ride.id}
                          >
                            {savingRide === ride.id ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>

        {/* Footer */}
        <div className="inspector-footer">
          <button
            className="btn-pill btn-pill-outline inspector-adjust-btn"
            onClick={() => navigate(`/maintenance/${bikeId}/intervals`)}
          >
            Adjust Service Intervals
          </button>
          <button
            className="btn-pill btn-pill-outline inspector-adjust-btn"
            onClick={() => navigate(`/maintenance/${bikeId}/settings`)}
          >
            Edit Bike Settings
          </button>
          {!showResetConfirm ? (
            <button
              className="inspector-reset-link"
              onClick={() => setShowResetConfirm(true)}
            >
              Reset All Service Intervals
            </button>
          ) : (
            <div className="inspector-reset-confirm">
              <p className="inspector-forget-confirm-text">
                Are you sure? This will mark all maintenance items as serviced today,
                as if your bike just had a full overhaul.
              </p>
              <div className="inspector-forget-confirm-actions">
                <button
                  className="inspector-forget-cancel"
                  onClick={() => setShowResetConfirm(false)}
                  disabled={resetting}
                >
                  Cancel
                </button>
                <button
                  className="inspector-reset-overhaul-btn"
                  onClick={handleReset}
                  disabled={resetting}
                >
                  {resetting ? 'Resetting…' : 'Yes, Reset'}
                </button>
              </div>
            </div>
          )}

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
