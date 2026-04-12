import { useState, useEffect } from 'react';
import { api } from '../api';
import './PostRideModal.css';

// ── Condition config ────────────────────────────────────────────────────────

const CONDITIONS = [
  { id: 'dry',   label: 'Dry',           multiplier: 1.0 },
  { id: 'wet',   label: 'Wet',           multiplier: 1.3 },
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

function BikeIcon({ type, isTrainer }) {
  if (isTrainer)         return <TrainerIcon />;
  if (type === 'mtb')    return <MtbIcon />;
  if (type === 'gravel') return <GravelIcon />;
  return <RoadIcon />;
}

// ── Trainer icon ─────────────────────────────────────────────────────────────

function TrainerIcon() {
  return (
    <svg viewBox="0 0 40 24" fill="none" className="prm-bike-icon">
      {/* Rear roller stand */}
      <rect x="6" y="17" width="28" height="3" rx="1.5" stroke="currentColor" strokeWidth="2"/>
      <line x1="10" y1="17" x2="8" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="30" y1="17" x2="32" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      {/* Bike silhouette on trainer */}
      <circle cx="12" cy="14" r="4" stroke="currentColor" strokeWidth="2"/>
      <circle cx="28" cy="14" r="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 14L18 7h6l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M24 11l4 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
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
      // Only flag items that are currently ok or due_soon and would tip over with this ride
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

function RideCard({ ride, condition, onCondition, maintenanceStatus }) {
  const warnings = getWarnings(ride.distanceMiles, condition, maintenanceStatus);

  return (
    <div className="prm-ride-card">
      {/* Ride header */}
      <div className="prm-ride-header">
        <div className="prm-bike-icon-wrap">
          <BikeIcon type={ride.bikeType} isTrainer={ride.isTrainer} />
        </div>
        <div className="prm-ride-info">
          <span className="prm-bike-name">{ride.bikeName || 'No bike assigned'}</span>
          <span className="prm-ride-name">{ride.name}</span>
          <span className="prm-ride-meta">
            {formatDate(ride.date)}&nbsp;·&nbsp;{formatMiles(ride.distanceMiles)} mi
          </span>
        </div>
      </div>

      {ride.isTrainer ? (
        /* Trainer ride — no condition input needed */
        <div className="prm-trainer-info">
          <span className="prm-trainer-badge">Trainer Ride</span>
          <p className="prm-trainer-note">
            Tire and brake wear not counted. Drivetrain wear counted at 60%.
          </p>
        </div>
      ) : (
        <>
          {/* Condition pills */}
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

          {/* Maintenance warnings — only shown when a condition is selected */}
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
    </div>
  );
}

// ── PostRideModal ────────────────────────────────────────────────────────────

export default function PostRideModal({ rides, onClose }) {
  const [conditions, setConditions] = useState({});
  // maintenanceStatus keyed by gearId: null (loading) | object (loaded) | false (failed)
  const [maintenanceStatus, setMaintenanceStatus] = useState({});
  const [saving, setSaving] = useState(false);

  // Pre-load maintenance status for every unique configured bike in the rides list
  useEffect(() => {
    const uniqueGearIds = [...new Set(rides.map(r => r.gearId).filter(Boolean))];
    for (const gearId of uniqueGearIds) {
      setMaintenanceStatus(prev => ({ ...prev, [gearId]: null }));
      api.getMaintenanceStatus(gearId)
        .then(status => setMaintenanceStatus(prev => ({ ...prev, [gearId]: status })))
        .catch(() => setMaintenanceStatus(prev => ({ ...prev, [gearId]: false })));
    }
  }, [rides]);

  function setCondition(activityId, conditionId) {
    setConditions(prev => ({ ...prev, [activityId]: conditionId }));
  }

  async function handleSave() {
    // Trainer rides are always included (no condition selection needed).
    // Regular rides are only included when the user selected a condition.
    const payload = rides
      .filter(r => r.isTrainer || conditions[r.id])
      .map(r => r.isTrainer
        ? { activityId: r.id, isTrainer: true, distanceMiles: r.distanceMiles, gearId: r.gearId }
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

  // Enable "All done" if any ride has a condition set, or if any ride is a trainer
  // (trainer rides are always saved — no condition input required).
  const anyConditionSet = rides.some(r => r.isTrainer || conditions[r.id]);

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
