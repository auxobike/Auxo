import { useState } from 'react';
import { api } from '../api';

const STATUS_LABEL = {
  ok:        { text: 'OK',        cls: 'status-ok' },
  due_soon:  { text: 'Due soon',  cls: 'status-due-soon' },
  due:       { text: 'Due',       cls: 'status-due' },
  overdue:   { text: 'Overdue',   cls: 'status-overdue' },
};

function formatStatusDetail(status) {
  const s = status;
  const parts = [];

  if (s.milesSince !== undefined && s.threshold !== undefined) {
    parts.push(`${Math.round(s.milesSince)} / ${s.threshold} mi`);
    if (s.remaining > 0) parts.push(`${s.remaining} mi left`);
  }
  if (s.milesThreshold !== undefined) {
    parts.push(`${Math.round(s.milesSince)} / ${s.milesThreshold} mi`);
  }
  if (s.ridesSince !== undefined) {
    parts.push(`${s.ridesSince} / ${s.threshold} rides`);
    if (s.remaining > 0) parts.push(`${s.remaining} ride${s.remaining !== 1 ? 's' : ''} left`);
  }
  if (s.daysSince !== undefined && s.daysSince !== null && s.threshold !== undefined && !s.milesSince) {
    parts.push(`${s.daysSince} / ${s.threshold} days`);
    if (s.remaining > 0) parts.push(`${s.remaining} days left`);
  }
  if (s.daysThreshold !== undefined && s.daysRemaining !== undefined) {
    parts.push(`${s.daysRemaining} days left`);
  }
  if (s.chainsSince !== undefined) {
    parts.push(`${s.chainsSince} / ${s.threshold} chain changes`);
  }
  if (s.hoursSince !== undefined) {
    const label = s.isUserDefined ? `${s.interval}h (custom)` : `${s.hoursThreshold || s.interval}h`;
    parts.push(`${s.hoursSince}h / ${label}`);
  }

  return parts.join(' · ');
}

export default function MaintenanceItem({ bikeId, item, onLogged }) {
  const [logging,      setLogging]      = useState(false);
  const [notes,        setNotes]        = useState('');
  const [userInterval, setUserInterval] = useState(item.serviceLog?.userInterval || '');
  const [showForm,     setShowForm]     = useState(false);
  const [saving,       setSaving]       = useState(false);

  const { status } = item.status;
  const badge = STATUS_LABEL[status] || STATUS_LABEL.ok;
  const detail = formatStatusDetail(item.status);
  const isUserDefined = item.trigger.type === 'hours_user_defined';

  async function handleLog(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.logService(bikeId, item.id, {
        notes: notes || undefined,
        userInterval: userInterval ? Number(userInterval) : undefined,
      });
      setShowForm(false);
      setNotes('');
      onLogged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`maintenance-item ${badge.cls}`}>
      <div className="item-row">
        <div className="item-info">
          <span className="item-label">{item.label}</span>
          <span className="item-action">{item.action}</span>
          {detail && <span className="item-detail">{detail}</span>}
        </div>
        <div className="item-actions">
          <span className={`badge ${badge.cls}`}>{badge.text}</span>
          <button
            className="btn-done"
            onClick={() => setShowForm(v => !v)}
          >
            {showForm ? 'Cancel' : 'Mark done'}
          </button>
        </div>
      </div>

      {showForm && (
        <form className="log-form" onSubmit={handleLog}>
          {isUserDefined && (
            <label>
              Service interval (hours)
              <input
                type="number"
                min={item.trigger.suggestedMin}
                max={item.trigger.suggestedMax}
                placeholder={`${item.trigger.suggestedMin}–${item.trigger.suggestedMax} hrs suggested`}
                value={userInterval}
                onChange={e => setUserInterval(e.target.value)}
              />
            </label>
          )}
          <label>
            Notes (optional)
            <input
              type="text"
              placeholder="e.g. replaced with Shimano L03A"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </label>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </form>
      )}

      {item.serviceLog?.lastServiceDate && (
        <div className="last-service">
          Last: {item.serviceLog.lastServiceDate}
          {item.serviceLog.lastServiceMileage ? ` · ${item.serviceLog.lastServiceMileage} mi` : ''}
          {item.serviceLog.notes ? ` · ${item.serviceLog.notes}` : ''}
        </div>
      )}
    </div>
  );
}
