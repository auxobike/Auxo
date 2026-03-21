import { useState } from 'react';
import { api } from '../api';

const BIKE_TYPES = [
  { value: 'road',   label: 'Road Bike' },
  { value: 'mtb',    label: 'Mountain Bike' },
  { value: 'gravel', label: 'Gravel Bike' },
];

const PAD_TYPES = [
  { value: 'resin', label: 'Resin pads' },
  { value: 'metal', label: 'Metal pads' },
];

const BRAKE_TYPES = [
  { value: 'hydraulic',   label: 'Hydraulic disc' },
  { value: 'mechanical',  label: 'Mechanical disc / cable' },
  { value: 'rim',         label: 'Rim brakes' },
];

export default function BikeSetup({ bike, onSaved }) {
  const [bikeType,   setBikeType]   = useState('road');
  const [padType,    setPadType]    = useState('resin');
  const [brakeType,  setBrakeType]  = useState('hydraulic');
  const [isTubeless, setIsTubeless] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.configureBike(bike.id, { bikeType, padType, brakeType, isTubeless });
      onSaved();
    } catch {
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bike-setup">
      <h3>Set up {bike.name}</h3>
      <p className="setup-sub">Tell us about this bike so we can show the right maintenance schedule.</p>

      <form onSubmit={handleSave}>
        <label>
          Bike type
          <select value={bikeType} onChange={e => setBikeType(e.target.value)}>
            {BIKE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>

        <label>
          Brake pad type
          <select value={padType} onChange={e => setPadType(e.target.value)}>
            {PAD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>

        <label>
          Brake system
          <select value={brakeType} onChange={e => setBrakeType(e.target.value)}>
            {BRAKE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isTubeless}
            onChange={e => setIsTubeless(e.target.checked)}
          />
          Tubeless tires (track sealant)
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save & continue'}
        </button>
      </form>
    </div>
  );
}
