import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api } from '../api';
import './GarageScreen.css';

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function formatMiles(n) {
  return Math.round(n).toLocaleString();
}

// ── WheelsetCard ─────────────────────────────────────────────────────────────

function WheelsetCard({ wheelset, bikes, onRefresh }) {
  // 'front' | 'rear' | null — which install form is open
  const [activeInstall,   setActiveInstall]   = useState(null);
  const [installBikeId,   setInstallBikeId]   = useState('');
  const [installing,      setInstalling]       = useState(false);
  const [uninstallingPos, setUninstallingPos]  = useState(null);

  const [editing,   setEditing]   = useState(false);
  const [editName,  setEditName]  = useState(wheelset.name);
  const [editNotes, setEditNotes] = useState(wheelset.notes || '');
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [editError, setEditError] = useState(null);

  const frontBike = bikes.find(b => b.id === wheelset.installedFrontOnBikeId);
  const rearBike  = bikes.find(b => b.id === wheelset.installedRearOnBikeId);

  function openInstallForm(position) {
    setInstallBikeId(bikes[0]?.id || '');
    setActiveInstall(position);
  }

  async function handleInstall(position) {
    if (!installBikeId) return;
    setInstalling(true);
    try {
      await api.installWheelset({
        bikeId:          installBikeId,
        frontWheelsetId: position === 'front' ? wheelset.id : undefined,
        rearWheelsetId:  position === 'rear'  ? wheelset.id : undefined,
      });
      setActiveInstall(null);
      onRefresh();
    } catch (err) {
      console.error('[Garage] install failed:', err.message);
    } finally {
      setInstalling(false);
    }
  }

  async function handleUninstall(position) {
    setUninstallingPos(position);
    try {
      const bikeId = position === 'front' ? wheelset.installedFrontOnBikeId : wheelset.installedRearOnBikeId;
      await api.uninstallWheelset({ bikeId, position });
      onRefresh();
    } catch (err) {
      console.error('[Garage] uninstall failed:', err.message);
    } finally {
      setUninstallingPos(null);
    }
  }

  async function handleSaveEdit() {
    if (!editName.trim()) { setEditError('Name is required'); return; }
    setSaving(true);
    setEditError(null);
    try {
      await api.updateWheelset(wheelset.id, { name: editName.trim(), notes: editNotes.trim() || null });
      setEditing(false);
      onRefresh();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${wheelset.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteWheelset(wheelset.id);
      onRefresh();
    } catch (err) {
      alert(err.message);
      setDeleting(false);
    }
  }

  const neitherInstalled = !wheelset.installedFrontOnBikeId && !wheelset.installedRearOnBikeId;

  return (
    <div className="garage-wheelset-card">
      {/* Header */}
      <div className="garage-wheelset-header">
        <div>
          <div className="garage-wheelset-name">{wheelset.name}</div>
          {wheelset.notes && <div className="garage-wheelset-notes">{wheelset.notes}</div>}
        </div>
        <div className="garage-wheelset-header-actions">
          <button className="garage-icon-btn" onClick={() => { setEditing(v => !v); setEditError(null); }} aria-label="Edit">
            <EditIcon />
          </button>
          <button className="garage-icon-btn garage-icon-btn--danger" onClick={handleDelete} disabled={deleting} aria-label="Delete">
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Miles */}
      <div className="garage-miles-strip">
        <div className="garage-miles-stat">
          <span className="garage-miles-label">Front Miles</span>
          <span className="garage-miles-value">{formatMiles(wheelset.frontMiles)}</span>
        </div>
        <div className="garage-miles-stat">
          <span className="garage-miles-label">Rear Miles</span>
          <span className="garage-miles-value">{formatMiles(wheelset.rearMiles)}</span>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="garage-edit-form">
          <input
            className="garage-edit-input"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="Wheelset name"
          />
          <input
            className="garage-edit-input"
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            placeholder="Notes (optional)"
          />
          {editError && <span className="garage-edit-error">{editError}</span>}
          <div className="garage-edit-actions">
            <button className="btn-pill btn-pill-gold garage-confirm-btn" onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="garage-cancel-link" onClick={() => { setEditing(false); setEditName(wheelset.name); setEditNotes(wheelset.notes || ''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Installation status */}
      <div className="garage-status-row">
        {/* Front position */}
        {wheelset.installedFrontOnBikeId ? (
          <div className="garage-status-line">
            <span className="garage-status-text">
              Front on <strong>{frontBike?.name || wheelset.installedFrontOnBikeId}</strong>
            </span>
            <button
              className="garage-uninstall-btn"
              onClick={() => handleUninstall('front')}
              disabled={uninstallingPos === 'front'}
            >
              {uninstallingPos === 'front' ? '…' : 'Remove Front'}
            </button>
          </div>
        ) : activeInstall !== 'front' && bikes.length > 0 && (
          <button className="garage-install-btn" onClick={() => openInstallForm('front')}>
            + Install as Front
          </button>
        )}

        {/* Inline front install form */}
        {activeInstall === 'front' && (
          <div className="garage-install-form">
            <div className="garage-install-row">
              <span className="garage-install-label">Bike</span>
              <select
                className="garage-install-select"
                value={installBikeId}
                onChange={e => setInstallBikeId(e.target.value)}
              >
                {bikes.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="garage-install-actions">
              <button
                className="btn-pill btn-pill-gold garage-confirm-btn"
                onClick={() => handleInstall('front')}
                disabled={installing || !installBikeId}
              >
                {installing ? 'Installing…' : 'Confirm as Front'}
              </button>
              <button className="garage-cancel-link" onClick={() => setActiveInstall(null)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Rear position */}
        {wheelset.installedRearOnBikeId ? (
          <div className="garage-status-line">
            <span className="garage-status-text">
              Rear on <strong>{rearBike?.name || wheelset.installedRearOnBikeId}</strong>
            </span>
            <button
              className="garage-uninstall-btn"
              onClick={() => handleUninstall('rear')}
              disabled={uninstallingPos === 'rear'}
            >
              {uninstallingPos === 'rear' ? '…' : 'Remove Rear'}
            </button>
          </div>
        ) : activeInstall !== 'rear' && bikes.length > 0 && (
          <button className="garage-install-btn" onClick={() => openInstallForm('rear')}>
            + Install as Rear
          </button>
        )}

        {/* Inline rear install form */}
        {activeInstall === 'rear' && (
          <div className="garage-install-form">
            <div className="garage-install-row">
              <span className="garage-install-label">Bike</span>
              <select
                className="garage-install-select"
                value={installBikeId}
                onChange={e => setInstallBikeId(e.target.value)}
              >
                {bikes.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="garage-install-actions">
              <button
                className="btn-pill btn-pill-gold garage-confirm-btn"
                onClick={() => handleInstall('rear')}
                disabled={installing || !installBikeId}
              >
                {installing ? 'Installing…' : 'Confirm as Rear'}
              </button>
              <button className="garage-cancel-link" onClick={() => setActiveInstall(null)}>Cancel</button>
            </div>
          </div>
        )}

        {neitherInstalled && activeInstall === null && (
          <span className="garage-in-garage">In Garage</span>
        )}
      </div>
    </div>
  );
}

// ── AddWheelsetForm ───────────────────────────────────────────────────────────

function AddWheelsetForm({ onAdd, onCancel }) {
  const [name,   setName]   = useState('');
  const [notes,  setNotes]  = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  async function handleSubmit() {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const created = await api.createWheelset({ name: name.trim(), notes: notes.trim() || null });
      onAdd(created);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="garage-add-form">
      <span className="garage-add-form-title">New Wheelset</span>
      <input
        className="garage-edit-input"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Name (e.g. Zipp 404s, Training Wheels)"
        autoFocus
      />
      <input
        className="garage-edit-input"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
      />
      {error && <span className="garage-add-error">{error}</span>}
      <div className="garage-edit-actions">
        <button className="btn-pill btn-pill-gold garage-confirm-btn" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Adding…' : 'Add Wheelset'}
        </button>
        <button className="garage-cancel-link" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── GarageScreen ─────────────────────────────────────────────────────────────

export default function GarageScreen({ onLogout }) {
  const [wheelsets,    setWheelsets]    = useState([]);
  const [bikes,        setBikes]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showAddForm,  setShowAddForm]  = useState(false);

  async function loadData() {
    try {
      const [ws, bk] = await Promise.all([
        api.getWheelsets(),
        api.getBikes().catch(() => []),
      ]);
      setWheelsets(ws);
      setBikes(bk);
    } catch (err) {
      console.error('[Garage] load failed:', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function handleAdd(created) {
    setWheelsets(prev => [...prev, created]);
    setShowAddForm(false);
  }

  return (
    <div className="screen garage-screen">
      <AppHeader onLogout={onLogout} />

      <h1 className="garage-heading">Garage</h1>

      <div className="garage-body">
        {loading ? (
          <p className="garage-empty">Loading…</p>
        ) : wheelsets.length === 0 && !showAddForm ? (
          <p className="garage-empty">No wheelsets yet — add one below.</p>
        ) : (
          wheelsets.map(ws => (
            <WheelsetCard
              key={ws.id}
              wheelset={ws}
              bikes={bikes}
              onRefresh={loadData}
            />
          ))
        )}

        <div className="garage-add-section">
          {showAddForm ? (
            <AddWheelsetForm onAdd={handleAdd} onCancel={() => setShowAddForm(false)} />
          ) : (
            <button
              className="btn-pill btn-pill-outline"
              onClick={() => setShowAddForm(true)}
            >
              + Add Wheelset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
