import { useState, useEffect } from 'react';
import { api } from '../api';
import './PostRideModal.css';

// ── Condition config ────────────────────────────────────────────────────────

const CONDITIONS = [
  { id: 'dry',   label: 'Dry',              multiplier: 1.0 },
  { id: 'wet',   label: 'Wet',              multiplier: 1.3 },
  { id: 'muddy', label: 'Muddy / Off-road', multiplier: 1.5 },
];

// ── Bike type icons ─────────────────────────────────────────────────────────

function RoadIcon() {
  return (
    <svg viewBox="0 0 40 24" fill="none" className="prm-bike-icon">
      <circle cx="7"  cy="18" r="5" stroke="currentColor" strokeWidth="2"/>
      <circle cx="33" cy="18" r="5" stroke="currentColor" strokeWidth="2"/>
      <path d="M7 18L14 8h10l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M24 12l5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M14 8h-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M19 8l2-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function MtbIcon() {
  return (
    <svg viewBox="0 0 40 24" fill="none" className="prm-bike-icon">
      <circle cx="7"  cy="18" r="5.5" stroke="currentColor" strokeWidth="2"/>
      <circle cx="33" cy="18" r="5.5" stroke="currentColor" strokeWidth="2"/>
      <path d="M7 18L15 7h9l4 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M24 12l5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M15 7h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M19 7l1-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M11 3h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function GravelIcon() {
  return (
    <svg viewBox="0 0 40 24" fill="none" className="prm-bike-icon">
      <circle cx="7"  cy="18" r="5" stroke="currentColor" strokeWidth="2"/>
      <circle cx="33" cy="18" r="5" stroke="currentColor" strokeWidth="2"/>
      <path d="M7 18L14 9h10l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M24 13l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M14 9h-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M19 9l2-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M17 3h4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function TrainerIcon() {
  return (
    <svg viewBox="0 0 40 24" fill="none" className="prm-bike-icon">
      <rect x="6" y="17" width="28" height="3" rx="1.5" stroke="currentColor" strokeWidth="2"/>
      <line x1="10" y1="17" x2="8" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="30" y1="17" x2="32" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="14" r="4" stroke="currentColor" strokeWidth="2"/>
      <circle cx="28" cy="14" r="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 14L18 7h6l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M24 11l4 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function BikeIcon({ type, isTrainer }) {
  if (isTrainer)         return <TrainerIcon />;
  if (type === 'mtb')    return <MtbIcon />;
  if (type === 'gravel') return <GravelIcon />;
  return <RoadIcon />;
}

// ── Warning calculation ─────────────────────────────────────────────────────

function getWarnings(distanceMiles, conditionId, maintenanceStatus) {
  if (!conditionId || !maintenanceStatus) return [];
  const multiplier = CONDITIONS.find(c => c.id === conditionId)?.multiplier ?? 1;
  const effectiveMiles = distanceMiles * multiplier;
  const warnings = [];

  for (const section of (maintenanceStatus.sections || [])) {
    for (const item of section.items) {
      const s = item.status;
      if (
        (s.status === 'ok' || s.status === 'due_soon') &&
        s.remaining !== undefined &&
        s.remaining <= effectiveMiles
      ) {
        warnings.push({ label: item.label, action: item.action, currentStatus: s.status });
      }
    }
  }
  return warnings;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMiles(m) {
  return m < 10 ? m.toFixed(1) : Math.round(m).toString();
}

// ── RideCard ─────────────────────────────────────────────────────────────────

function RideCard({
  ride,
  condition,
  onCondition,
  maintenanceStatus,
  isEditing,
  onEditOpen,
  onEditClose,
  localEdit,
  onLocalEditChange,
  availableBikes,
  loadingBikes,
  wheels,
}) {
  const effectiveIsTrainer = localEdit?.isTrainer !== undefined
    ? localEdit.isTrainer
    : ride.isTrainer;
  const warnings = getWarnings(ride.distanceMiles, condition, maintenanceStatus);
  const noWheelsInstalled = ride.gearId && wheels && !wheels.front && !wheels.rear;

  return (
    <div className="prm-ride-card">
      {/* Ride header */}
      <div className="prm-ride-header">
        <div className="prm-bike-icon-wrap">
          <BikeIcon type={ride.bikeType} isTrainer={effectiveIsTrainer} />
        </div>
        <div className="prm-ride-info">
          <span className="prm-bike-name">{ride.bikeName || 'No bike assigned'}</span>
          <span className="prm-ride-name">{ride.name}</span>
          <span className="prm-ride-meta">
            {formatDate(ride.date)}&nbsp;·&nbsp;{formatMiles(ride.distanceMiles)} mi
          </span>
        </div>
        <button
          className={`prm-edit-btn${isEditing ? ' prm-edit-btn--active' : ''}`}
          onClick={isEditing ? onEditClose : onEditOpen}
        >
          {isEditing ? 'Done' : 'Edit'}
        </button>
      </div>

      {noWheelsInstalled && (
        <div className="prm-no-wheels-warning">
          No wheels installed on this bike — add them in the{' '}
          <a href="/garage" className="prm-no-wheels-link">Garage</a>
        </div>
      )}

      {isEditing ? (
        /* ── Edit form ── */
        <div className="prm-edit-form">
          {/* Bike selector */}
          <div className="prm-edit-row">
            <span className="prm-edit-field-label">Bike</span>
            <select
              className="prm-bike-select"
              value={localEdit?.gearId ?? ride.gearId ?? ''}
              onChange={e => onLocalEditChange('gearId', e.target.value || null)}
              disabled={loadingBikes}
            >
              {loadingBikes ? (
                <option>Loading…</option>
              ) : (
                <>
                  <option value="">No bike</option>
                  {availableBikes.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </>
              )}
            </select>
          </div>

          {effectiveIsTrainer ? (
            <>
              <div className="prm-trainer-info">
                <span className="prm-trainer-badge">Trainer Ride</span>
                <p className="prm-trainer-note">
                  Tire and brake wear not counted. Drivetrain wear counted at 60%.
                </p>
              </div>
              <button
                className="prm-toggle-type-btn"
                onClick={() => onLocalEditChange('isTrainer', false)}
              >
                Switch to outdoor ride
              </button>
            </>
          ) : (
            <>
              <div className="prm-edit-row">
                <span className="prm-edit-field-label">Conditions</span>
                <div className="prm-conditions">
                  {CONDITIONS.map(c => (
                    <button
                      key={c.id}
                      className={`prm-condition-pill${condition === c.id ? ' prm-condition-pill--active' : ''}`}
                      onClick={() => onCondition(condition === c.id ? null : c.id)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                {condition && (
                  <button className="prm-clear-btn" onClick={() => onCondition(null)}>
                    Clear conditions
                  </button>
                )}
              </div>
              <button
                className="prm-toggle-type-btn"
                onClick={() => {
                  onLocalEditChange('isTrainer', true);
                  onCondition(null);
                }}
              >
                Mark as trainer ride
              </button>
            </>
          )}
        </div>
      ) : (
        /* ── Normal view ── */
        <>
          {effectiveIsTrainer ? (
            <div className="prm-trainer-info">
              <span className="prm-trainer-badge">Trainer Ride</span>
              <p className="prm-trainer-note">
                Tire and brake wear not counted. Drivetrain wear counted at 60%.
              </p>
            </div>
          ) : (
            <>
              <div className="prm-conditions">
                {CONDITIONS.map(c => (
                  <button
                    key={c.id}
                    className={`prm-condition-pill${condition === c.id ? ' prm-condition-pill--active' : ''}`}
                    onClick={() => onCondition(condition === c.id ? null : c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {condition && warnings.length > 0 && (
                <div className="prm-warnings">
                  <span className="prm-warnings-label">Heads up after this ride:</span>
                  <div className="prm-warning-badges">
                    {warnings.map((w, i) => (
                      <span
                        key={i}
                        className={`prm-warning-badge prm-warning-badge--${w.currentStatus === 'due_soon' ? 'alert' : 'critical'}`}
                      >
                        {w.label} – {w.action}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── PostRideModal ────────────────────────────────────────────────────────────

export default function PostRideModal({ rides, onClose }) {
  const [conditions,     setConditions]     = useState({});
  const [maintenanceStatus, setMaintenanceStatus] = useState({});
  const [saving,         setSaving]         = useState(false);
  const [editingRideId,  setEditingRideId]  = useState(null);
  // localEdits: per-ride overrides for gearId and isTrainer before save
  const [localEdits,     setLocalEdits]     = useState({});
  const [availableBikes, setAvailableBikes] = useState([]);
  const [loadingBikes,   setLoadingBikes]   = useState(false);
  const [bikeWheels,     setBikeWheels]     = useState({});

  // Pre-load maintenance status and installed wheels for every unique bike
  useEffect(() => {
    const uniqueGearIds = [...new Set(rides.map(r => r.gearId).filter(Boolean))];
    for (const gearId of uniqueGearIds) {
      setMaintenanceStatus(prev => ({ ...prev, [gearId]: null }));
      api.getMaintenanceStatus(gearId)
        .then(status => setMaintenanceStatus(prev => ({ ...prev, [gearId]: status })))
        .catch(() => setMaintenanceStatus(prev => ({ ...prev, [gearId]: false })));
      api.getBikeWheels(gearId)
        .then(wheels => setBikeWheels(prev => ({ ...prev, [gearId]: wheels })))
        .catch(() => {});
    }
  }, [rides]);

  function setCondition(activityId, conditionId) {
    setConditions(prev => ({ ...prev, [activityId]: conditionId }));
  }

  function handleEditOpen(rideId) {
    setEditingRideId(rideId);
    if (availableBikes.length === 0 && !loadingBikes) {
      setLoadingBikes(true);
      api.getBikes()
        .then(setAvailableBikes)
        .catch(() => {})
        .finally(() => setLoadingBikes(false));
    }
  }

  function handleLocalEditChange(rideId, field, value) {
    setLocalEdits(prev => ({
      ...prev,
      [rideId]: { ...(prev[rideId] || {}), [field]: value },
    }));
  }

  function getEffectiveRide(ride) {
    const edit = localEdits[ride.id] || {};
    return {
      ...ride,
      ...('isTrainer' in edit && { isTrainer: edit.isTrainer }),
      ...('gearId'    in edit && { gearId:    edit.gearId }),
    };
  }

  async function handleSave() {
    // Trainer rides are always included. Regular rides need a condition selected.
    const payload = rides
      .map(getEffectiveRide)
      .filter(r => r.isTrainer || conditions[r.id])
      .map(r => r.isTrainer
        ? { activityId: r.id, isTrainer: true,          distanceMiles: r.distanceMiles, gearId: r.gearId }
        : { activityId: r.id, condition: conditions[r.id], distanceMiles: r.distanceMiles, gearId: r.gearId }
      );

    setSaving(true);
    try {
      if (payload.length > 0) await api.saveRideConditions(payload);
    } catch {
      // Non-fatal — dismiss anyway
    }
    setSaving(false);
    onClose();
  }

  const anyConditionSet = rides.some(r => {
    const eff = getEffectiveRide(r);
    return eff.isTrainer || conditions[r.id];
  });

  return (
    <div className="prm-backdrop" role="dialog" aria-modal="true">
      <div className="prm-sheet">

        {/* Header */}
        <div className="prm-header">
          <h2 className="prm-heading">New Rides</h2>
          <p className="prm-subheading">
            Tag your conditions so Auxo can account for extra wear on wet or muddy rides.
          </p>
        </div>

        {/* Ride list */}
        <div className="prm-rides">
          {rides.map(ride => (
            <RideCard
              key={ride.id}
              ride={ride}
              condition={conditions[ride.id] || null}
              onCondition={cid => setCondition(ride.id, cid)}
              maintenanceStatus={ride.gearId ? maintenanceStatus[ride.gearId] : null}
              isEditing={editingRideId === ride.id}
              onEditOpen={() => handleEditOpen(ride.id)}
              onEditClose={() => setEditingRideId(null)}
              localEdit={localEdits[ride.id] || null}
              onLocalEditChange={(field, value) => handleLocalEditChange(ride.id, field, value)}
              availableBikes={availableBikes}
              loadingBikes={loadingBikes}
              wheels={ride.gearId ? (bikeWheels[ride.gearId] ?? null) : null}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="prm-footer">
          <button
            className="btn-pill btn-pill-gold prm-done-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'All done'}
          </button>
          <button className="prm-skip" onClick={onClose}>
            Skip for now
          </button>
        </div>

      </div>
    </div>
  );
}
