import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api } from '../api';
import './ServiceIntervalsScreen.css';

// ── Interval helpers ──────────────────────────────────────────────────────────

// Return the primary unit for a trigger type (what gets stored in customIntervals).
function baseUnit(triggerType) {
  switch (triggerType) {
    case 'miles':              return 'miles';
    case 'rides':              return 'rides';
    case 'days':               return 'days';
    case 'miles_or_days':      return 'miles';
    case 'chain_replacements': return 'chains';
    case 'hours_or_days':      return 'hours';
    case 'hours_user_defined': return 'hours';
    default: return null;
  }
}

// Return the default { value, unit } for a trigger in display units.
function defaultDisplay(trigger) {
  if (!trigger) return null;
  switch (trigger.type) {
    case 'miles': {
      const v = trigger.thenEvery || trigger.every;
      return { value: v, unit: 'miles' };
    }
    case 'rides':
      return { value: trigger.every, unit: 'rides' };
    case 'days':
      return daysToDisplay(trigger.every);
    case 'miles_or_days':
      return { value: trigger.miles, unit: 'miles' };
    case 'chain_replacements':
      return { value: trigger.every, unit: 'chains' };
    case 'hours_or_days':
      return { value: trigger.hours, unit: 'hours' };
    case 'hours_user_defined':
      return { value: trigger.suggestedMin, unit: 'hours' };
    default: return null;
  }
}

// Convert a stored days value to a human-friendly display unit.
function daysToDisplay(days) {
  if (days >= 365 && days % 365 === 0) return { value: days / 365, unit: 'years' };
  if (days >= 30  && days % 30  === 0) return { value: days / 30,  unit: 'months' };
  return { value: days, unit: 'days' };
}

// Convert display { value, unit } → stored { value, unit } (always base unit).
function toStored(displayValue, displayUnit) {
  const n = Number(displayValue);
  if (displayUnit === 'months') return { value: n * 30,  unit: 'days' };
  if (displayUnit === 'years')  return { value: n * 365, unit: 'days' };
  return { value: n, unit: displayUnit };
}

// Format a display { value, unit } into a readable pill string.
function pillText(value, unit) {
  if (value == null) return '—';
  switch (unit) {
    case 'miles':  return `${value} mi`;
    case 'rides':  return `${value} rides`;
    case 'days':   return `${value} days`;
    case 'months': return value === 1 ? '1 month'  : `${value} months`;
    case 'years':  return value === 1 ? '1 year'   : `${value} years`;
    case 'hours':  return `${value} hrs`;
    case 'chains': return `${value} chains`;
    default: return `${value}`;
  }
}

function unitLabel(unit) {
  switch (unit) {
    case 'miles':  return 'mi';
    case 'rides':  return 'rides';
    case 'hours':  return 'hrs';
    case 'chains': return 'chains';
    default: return unit;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function IntervalItem({ item, isExpanded, override, onToggle, onChange, onReset }) {
  const def     = defaultDisplay(item.trigger);
  const current = override ?? def;
  const isCustom = !!override;
  const pill    = current ? pillText(current.value, current.unit) : '—';

  // Is days-based (supports days/months/years unit selector)?
  const isDays = item.trigger?.type === 'days';

  // Edit field state: use current display value, fall back to default
  const editValue = override?.value ?? (def?.value ?? '');
  const editUnit  = override?.unit  ?? (def?.unit  ?? 'days');

  return (
    <div className="intervals-item">
      <div className="intervals-item-main" onClick={onToggle} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onToggle()}>
        <div className="intervals-item-info">
          <span className="intervals-item-label">{item.label}</span>
          <span className="intervals-item-action">{item.action}</span>
        </div>
        <span className={`intervals-pill${isCustom ? ' intervals-pill--custom' : ''}`}>
          {pill}
        </span>
      </div>

      {isExpanded && (
        <div className="intervals-edit">
          <input
            className="intervals-edit-input"
            type="number"
            min="1"
            inputMode="numeric"
            value={editValue}
            onChange={e => onChange(e.target.value, editUnit)}
          />

          {isDays ? (
            <select
              className="intervals-edit-unit"
              value={editUnit}
              onChange={e => onChange(editValue, e.target.value)}
            >
              <option value="days">days</option>
              <option value="months">months</option>
              <option value="years">years</option>
            </select>
          ) : (
            <span className="intervals-unit-label">{unitLabel(editUnit)}</span>
          )}

          {isCustom && (
            <button className="intervals-reset-btn" onClick={onReset}>
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ServiceIntervalsScreen({ onLogout }) {
  const { bikeId } = useParams();
  const navigate   = useNavigate();

  const [sections,   setSections]   = useState([]);
  const [bikeType,   setBikeType]   = useState('');
  const [bikes,      setBikes]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [expanded,   setExpanded]   = useState(new Set());
  // overrides: { [itemId]: { value: string|number, unit: string } } in display units
  const [overrides,  setOverrides]  = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsData, bikesData] = await Promise.all([
        api.getMaintenanceItems(bikeId),
        api.getBikes(),
      ]);
      setSections(itemsData.sections ?? []);
      setBikeType(itemsData.bikeType ?? '');
      setBikes(bikesData);

      // Initialise overrides from existing customIntervals on the bike
      const init = {};
      for (const [id, stored] of Object.entries(itemsData.customIntervals ?? {})) {
        if (stored?.unit === 'days') {
          init[id] = daysToDisplay(stored.value);
        } else {
          init[id] = { value: stored.value, unit: stored.unit };
        }
      }
      setOverrides(init);
    } catch (err) {
      console.error('[ServiceIntervalsScreen] load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [bikeId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Bike carousel nav
  const bikeIdx    = bikes.findIndex(b => b.id === bikeId);
  const prevBike   = bikes.length > 1 ? bikes[(bikeIdx - 1 + bikes.length) % bikes.length] : null;
  const nextBike   = bikes.length > 1 ? bikes[(bikeIdx + 1) % bikes.length]                : null;
  const bikeName   = bikes.find(b => b.id === bikeId)?.name ?? '…';
  const bikeTypeLabel = bikeType === 'mtb' ? 'MTB'
                      : bikeType === 'road' ? 'Road'
                      : bikeType === 'gravel' ? 'Gravel'
                      : bikeType;

  function toggleExpand(itemId) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  }

  function handleChange(itemId, value, unit) {
    setOverrides(prev => ({ ...prev, [itemId]: { value, unit } }));
  }

  function handleReset(itemId) {
    setOverrides(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    // Convert display overrides → stored format, skipping empty/zero values
    const intervals = {};
    for (const [id, display] of Object.entries(overrides)) {
      const stored = toStored(display.value, display.unit);
      if (!isNaN(stored.value) && stored.value > 0) {
        intervals[id] = stored;
      }
    }
    try {
      await api.saveIntervals(bikeId, intervals);
      navigate(`/maintenance/${bikeId}`, { replace: true });
    } catch (err) {
      console.error('[ServiceIntervalsScreen] save error:', err.message);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="screen intervals-screen">
        <AppHeader onLogout={onLogout} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '0.1em' }}>
            Loading…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen intervals-screen">
      <AppHeader onLogout={onLogout} />

      {/* ── Bike nav header ── */}
      <div className="intervals-nav">
        <span className="intervals-bike-type">{bikeTypeLabel}</span>
        <div className="intervals-bike-name-row">
          <button
            className="intervals-nav-arrow"
            onClick={() => navigate(`/maintenance/${prevBike.id}/intervals`)}
            disabled={!prevBike}
            aria-label="Previous bike"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="intervals-bike-name">{bikeName}</span>
          <button
            className="intervals-nav-arrow"
            onClick={() => navigate(`/maintenance/${nextBike.id}/intervals`)}
            disabled={!nextBike}
            aria-label="Next bike"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="intervals-body">
        <h2 className="intervals-heading">Customize your notification settings</h2>
        <p className="intervals-intro">
          The following are our recommendations for service intervals. Please review and
          select any that you would like to customize.
        </p>

        {sections.map(section => (
          <div key={section.id} className="intervals-section">
            <span className="intervals-section-title">{section.label}</span>
            {section.items.map(item => (
              <IntervalItem
                key={item.id}
                item={item}
                isExpanded={expanded.has(item.id)}
                override={overrides[item.id] ?? null}
                onToggle={() => toggleExpand(item.id)}
                onChange={(value, unit) => handleChange(item.id, value, unit)}
                onReset={() => handleReset(item.id)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* ── Sticky footer ── */}
      <div className="intervals-footer">
        <button
          className="btn-pill btn-pill-gold"
          style={{ width: '70%' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'All set'}
        </button>
      </div>
    </div>
  );
}
