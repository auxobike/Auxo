import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api } from '../api';
import './AddServiceLogScreen.css';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AddServiceLogScreen({ onLogout }) {
  const navigate = useNavigate();

  const [bikes,           setBikes]           = useState([]);
  const [bikesLoading,    setBikesLoading]    = useState(true);
  const [selectedBikeId,  setSelectedBikeId]  = useState('');
  const [sections,        setSections]        = useState([]);
  const [statusLoading,   setStatusLoading]   = useState(false);
  const [statusError,     setStatusError]     = useState('');
  const [selectedItemId,  setSelectedItemId]  = useState('');
  const [serviceDate,     setServiceDate]     = useState(todayISO());
  const [saving,          setSaving]          = useState(false);
  const [saveError,       setSaveError]       = useState('');

  // Load bike list once
  useEffect(() => {
    api.getBikes()
      .then(data => {
        setBikes(data);
        if (data.length > 0) setSelectedBikeId(data[0].id);
      })
      .catch(err => console.error('[AddServiceLog] getBikes:', err.message))
      .finally(() => setBikesLoading(false));
  }, []);

  // Load ALL maintenance items whenever selected bike changes.
  // Uses /items (not /status) so no config filtering strips out items.
  useEffect(() => {
    if (!selectedBikeId) { setSections([]); return; }
    setStatusLoading(true);
    setStatusError('');
    setSelectedItemId('');
    api.getMaintenanceItems(selectedBikeId)
      .then(data => setSections(data.sections || []))
      .catch(err => {
        setSections([]);
        setStatusError(err.message?.includes('not configured')
          ? "This bike hasn't been set up yet. Add it via the bike setup flow first."
          : 'Could not load service items. Please try again.');
      })
      .finally(() => setStatusLoading(false));
  }, [selectedBikeId]);

  const canSubmit = selectedBikeId && selectedItemId && !saving;

  async function submit(mode) {
    if (!canSubmit) return;
    setSaving(true);
    setSaveError('');
    try {
      await api.logService(selectedBikeId, selectedItemId, { date: serviceDate });
      if (mode === 'complete') {
        navigate(`/maintenance/${selectedBikeId}`);
      } else {
        // Log Another — reset item + date, keep bike
        setSelectedItemId('');
        setServiceDate(todayISO());
      }
    } catch (err) {
      setSaveError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen service-log-screen">
      <AppHeader onLogout={onLogout} />

      <div className="service-log-body">
        <div className="service-log-heading">
          <p className="service-log-heading-sub">Add a</p>
          <h1 className="service-log-heading-main">Service Log</h1>
        </div>

        {/* Bike selector */}
        <div className="input-group">
          <label className="input-label" htmlFor="log-bike">Choose a bike</label>
          {bikesLoading ? (
            <p className="service-log-loading">Loading your bikes…</p>
          ) : (
            <select
              id="log-bike"
              className="input-field"
              value={selectedBikeId}
              onChange={e => setSelectedBikeId(e.target.value)}
              disabled={saving}
            >
              {bikes.length === 0 && (
                <option value="">No bikes found</option>
              )}
              {bikes.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Gold-bordered service card */}
        <div className="service-log-card">
          <div className="input-group">
            <label className="input-label" htmlFor="log-service-type">Choose a service type</label>
            {statusLoading ? (
              <p className="service-log-loading">Loading service items…</p>
            ) : statusError ? (
              <p className="service-log-status-error">{statusError}</p>
            ) : (
              <select
                id="log-service-type"
                className="input-field"
                value={selectedItemId}
                onChange={e => setSelectedItemId(e.target.value)}
                disabled={saving || sections.length === 0}
              >
                <option value="" disabled>Select a service type…</option>
                {sections.map(section => (
                  <optgroup key={section.id} label={section.label}>
                    {section.items.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.label} — {item.action}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="log-date">Date of service</label>
            <input
              id="log-date"
              type="date"
              className="input-field service-log-date"
              value={serviceDate}
              max={todayISO()}
              onChange={e => setServiceDate(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="service-log-footer">
        {saveError && <p className="service-log-save-error">{saveError}</p>}
        <button
          className="btn-pill btn-pill-gold"
          onClick={() => submit('complete')}
          disabled={!canSubmit}
        >
          {saving ? 'Saving…' : 'Log Complete'}
        </button>
        <button
          className="btn-pill btn-pill-outline"
          onClick={() => submit('another')}
          disabled={!canSubmit}
        >
          Log Another
        </button>
      </div>
    </div>
  );
}
