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

  const [editing,     setEditing]     = useState(false);
  const [editName,    setEditName]    = useState(wheelset.name);
  const [editNotes,   setEditNotes]   = useState(wheelset.notes || '');
  const [editFront,   setEditFront]   = useState(String(wheelset.frontMiles));
  const [editRear,    setEditRear]    = useState(String(wheelset.rearMiles));
  const [notesOpen,   setNotesOpen]   = useState(!!wheelset.notes);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [editError,   setEditError]   = useState(null);

  // Single source of truth for the edit form's fields, so save/cancel/reopen
  // can never diverge and leave a stale value behind in one of them.
  function resetEditFields() {
    setEditName(wheelset.name);
    setEditNotes(wheelset.notes || '');
    setEditFront(String(wheelset.frontMiles));
    setEditRear(String(wheelset.rearMiles));
    setNotesOpen(!!wheelset.notes);
    setEditError(null);
  }

  function openEditForm() {
    resetEditFields();
    setEditing(true);
  }

  function closeEditForm() {
    setEditing(false);
    resetEditFields();
  }

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

    const frontMiles = editFront.trim() === '' ? undefined : Number(editFront);
    const rearMiles  = editRear.trim()  === '' ? undefined : Number(editRear);
    if (frontMiles !== undefined && (!Number.isFinite(frontMiles) || frontMiles < 0)) {
      setEditError('Front miles must be a non-negative number'); return;
    }
    if (rearMiles !== undefined && (!Number.isFinite(rearMiles) || rearMiles < 0)) {
      setEditError('Rear miles must be a non-negative number'); return;
    }

    setSaving(true);
    setEditError(null);
    try {
      await api.updateWheelset(wheelset.id, {
        name:  editName.trim(),
        notes: editNotes.trim() || null,
        frontMiles,
        rearMiles,
      });
      closeEditForm();
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
          <button
            className="garage-icon-btn"
            onClick={() => (editing ? closeEditForm() : openEditForm())}
            aria-label="Edit"
          >
            <EditIcon />
          </button>
          <button className="garage-icon-btn garage-icon-btn--danger" onClick={handleDelete} disabled={deleting} aria-label="Delete">
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Miles */}
      {!editing && (
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
      )}

      {/* Edit form */}
      {editing && (
        <div className="garage-edit-form">
          <input
            className="garage-edit-input"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="Wheelset name"
          />

          <div className="garage-edit-field">
            <label className="garage-edit-label">Front Miles</label>
            <input
              className="garage-edit-input"
              type="number"
              inputMode="decimal"
              min="0"
              value={editFront}
              onChange={e => setEditFront(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="garage-edit-field">
            <label className="garage-edit-label">Rear Miles</label>
            <input
              className="garage-edit-input"
              type="number"
              inputMode="decimal"
              min="0"
              value={editRear}
              onChange={e => setEditRear(e.target.value)}
              placeholder="0"
            />
          </div>

          {notesOpen ? (
            <input
              className="garage-edit-input"
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              placeholder="Notes (optional)"
              autoFocus
            />
          ) : (
            <button type="button" className="garage-notes-toggle" onClick={() => setNotesOpen(true)}>
              + Add notes
            </button>
          )}

          {editError && <span className="garage-edit-error">{editError}</span>}

          <div className="garage-edit-actions">
            <button className="btn-pill btn-pill-gold garage-confirm-btn" onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-pill btn-pill-outline garage-cancel-btn" onClick={closeEditForm}>
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

// ── TireCard ─────────────────────────────────────────────────────────────────

function TireCard({ tire, bikes, onRefresh }) {
  // 'front' | 'rear' | null — which install form is open
  const [activeInstall,   setActiveInstall]   = useState(null);
  const [installBikeId,   setInstallBikeId]   = useState('');
  const [installing,      setInstalling]       = useState(false);
  const [uninstallingPos, setUninstallingPos]  = useState(null);

  const [editing,     setEditing]     = useState(false);
  const [editName,    setEditName]    = useState(tire.name);
  const [editNotes,   setEditNotes]   = useState(tire.notes || '');
  const [editMiles,   setEditMiles]   = useState(String(tire.miles));
  const [notesOpen,   setNotesOpen]   = useState(!!tire.notes);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [editError,   setEditError]   = useState(null);

  function resetEditFields() {
    setEditName(tire.name);
    setEditNotes(tire.notes || '');
    setEditMiles(String(tire.miles));
    setNotesOpen(!!tire.notes);
    setEditError(null);
  }

  function openEditForm() {
    resetEditFields();
    setEditing(true);
  }

  function closeEditForm() {
    setEditing(false);
    resetEditFields();
  }

  const frontBike = bikes.find(b => b.id === tire.installedFrontOnBikeId);
  const rearBike  = bikes.find(b => b.id === tire.installedRearOnBikeId);

  function openInstallForm(position) {
    setInstallBikeId(bikes[0]?.id || '');
    setActiveInstall(position);
  }

  async function handleInstall(position) {
    if (!installBikeId) return;
    setInstalling(true);
    try {
      await api.installTire({ bikeId: installBikeId, tireId: tire.id, position });
      setActiveInstall(null);
      onRefresh();
    } catch (err) {
      console.error('[Garage] tire install failed:', err.message);
    } finally {
      setInstalling(false);
    }
  }

  async function handleUninstall(position) {
    setUninstallingPos(position);
    try {
      const bikeId = position === 'front' ? tire.installedFrontOnBikeId : tire.installedRearOnBikeId;
      await api.uninstallTire({ bikeId, position });
      onRefresh();
    } catch (err) {
      console.error('[Garage] tire uninstall failed:', err.message);
    } finally {
      setUninstallingPos(null);
    }
  }

  async function handleSaveEdit() {
    if (!editName.trim()) { setEditError('Name is required'); return; }

    const miles = editMiles.trim() === '' ? undefined : Number(editMiles);
    if (miles !== undefined && (!Number.isFinite(miles) || miles < 0)) {
      setEditError('Miles must be a non-negative number'); return;
    }

    setSaving(true);
    setEditError(null);
    try {
      await api.updateTire(tire.id, {
        name:  editName.trim(),
        notes: editNotes.trim() || null,
        miles,
      });
      closeEditForm();
      onRefresh();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${tire.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteTire(tire.id);
      onRefresh();
    } catch (err) {
      alert(err.message);
      setDeleting(false);
    }
  }

  const neitherInstalled = !tire.installedFrontOnBikeId && !tire.installedRearOnBikeId;
  const positionLabel = tire.position === 'front' ? 'Front' : 'Rear';

  return (
    <div className="garage-wheelset-card">
      {/* Header */}
      <div className="garage-wheelset-header">
        <div>
          <div className="garage-wheelset-name">
            {tire.name}
            <span className={`garage-tire-position-badge garage-tire-position-badge--${tire.position}`}>
              {positionLabel}
            </span>
          </div>
          {tire.notes && <div className="garage-wheelset-notes">{tire.notes}</div>}
        </div>
        <div className="garage-wheelset-header-actions">
          <button
            className="garage-icon-btn"
            onClick={() => (editing ? closeEditForm() : openEditForm())}
            aria-label="Edit"
          >
            <EditIcon />
          </button>
          <button className="garage-icon-btn garage-icon-btn--danger" onClick={handleDelete} disabled={deleting} aria-label="Delete">
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Miles */}
      {!editing && (
        <div className="garage-miles-strip">
          <div className="garage-miles-stat">
            <span className="garage-miles-label">Miles</span>
            <span className="garage-miles-value">{formatMiles(tire.miles)}</span>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="garage-edit-form">
          <input
            className="garage-edit-input"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="Tire name"
          />

          <div className="garage-edit-field">
            <label className="garage-edit-label">Miles</label>
            <input
              className="garage-edit-input"
              type="number"
              inputMode="decimal"
              min="0"
              value={editMiles}
              onChange={e => setEditMiles(e.target.value)}
              placeholder="0"
            />
          </div>

          {notesOpen ? (
            <input
              className="garage-edit-input"
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              placeholder="Notes (optional)"
              autoFocus
            />
          ) : (
            <button type="button" className="garage-notes-toggle" onClick={() => setNotesOpen(true)}>
              + Add notes
            </button>
          )}

          {editError && <span className="garage-edit-error">{editError}</span>}

          <div className="garage-edit-actions">
            <button className="btn-pill btn-pill-gold garage-confirm-btn" onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-pill btn-pill-outline garage-cancel-btn" onClick={closeEditForm}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Installation status */}
      <div className="garage-status-row">
        {/* Front position */}
        {tire.installedFrontOnBikeId ? (
          <div className="garage-status-line">
            <span className="garage-status-text">
              Front on <strong>{frontBike?.name || tire.installedFrontOnBikeId}</strong>
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
        {tire.installedRearOnBikeId ? (
          <div className="garage-status-line">
            <span className="garage-status-text">
              Rear on <strong>{rearBike?.name || tire.installedRearOnBikeId}</strong>
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

// ── AddTireForm ──────────────────────────────────────────────────────────────

function AddTireForm({ onAdd, onCancel }) {
  const [name,     setName]     = useState('');
  const [notes,     setNotes]    = useState('');
  const [position,  setPosition] = useState('front');
  const [miles,     setMiles]    = useState('');
  const [saving,    setSaving]   = useState(false);
  const [error,     setError]    = useState(null);

  async function handleSubmit() {
    if (!name.trim()) { setError('Name is required'); return; }
    const startMiles = miles.trim() === '' ? 0 : Number(miles);
    if (!Number.isFinite(startMiles) || startMiles < 0) {
      setError('Miles must be a non-negative number'); return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await api.createTire({
        name:  name.trim(),
        notes: notes.trim() || null,
        miles: startMiles,
        position,
      });
      onAdd(created);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="garage-add-form">
      <span className="garage-add-form-title">New Tire</span>
      <input
        className="garage-edit-input"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Name (e.g. Continental GP5000)"
        autoFocus
      />

      <div className="garage-edit-field">
        <label className="garage-edit-label">Position</label>
        <select
          className="garage-install-select"
          value={position}
          onChange={e => setPosition(e.target.value)}
        >
          <option value="front">Front</option>
          <option value="rear">Rear</option>
        </select>
      </div>

      <div className="garage-edit-field">
        <label className="garage-edit-label">Starting Miles</label>
        <input
          className="garage-edit-input"
          type="number"
          inputMode="decimal"
          min="0"
          value={miles}
          onChange={e => setMiles(e.target.value)}
          placeholder="0"
        />
      </div>

      <input
        className="garage-edit-input"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
      />
      {error && <span className="garage-add-error">{error}</span>}
      <div className="garage-edit-actions">
        <button className="btn-pill btn-pill-gold garage-confirm-btn" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Adding…' : 'Add Tire'}
        </button>
        <button className="garage-cancel-link" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── GarageScreen ─────────────────────────────────────────────────────────────

export default function GarageScreen({ onLogout }) {
  const [wheelsets,       setWheelsets]       = useState([]);
  const [tires,           setTires]           = useState([]);
  const [bikes,           setBikes]           = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [showAddForm,     setShowAddForm]     = useState(false);
  const [showAddTireForm, setShowAddTireForm] = useState(false);

  async function loadData() {
    try {
      const [ws, ts, bk] = await Promise.all([
        api.getWheelsets(),
        api.getTires(),
        api.getBikes().catch(() => []),
      ]);
      setWheelsets(ws);
      setTires(ts);
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

  function handleAddTire(created) {
    setTires(prev => [...prev, created]);
    setShowAddTireForm(false);
  }

  return (
    <div className="screen garage-screen">
      <AppHeader onLogout={onLogout} />

      <h1 className="garage-heading">Garage</h1>

      <div className="garage-body">
        <h2 className="garage-section-heading">Wheelsets</h2>

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
              className="btn-pill btn-pill-outline garage-add-btn"
              onClick={() => setShowAddForm(true)}
            >
              + Add Wheelset
            </button>
          )}
        </div>

        <h2 className="garage-section-heading">Tires</h2>

        {loading ? (
          <p className="garage-empty">Loading…</p>
        ) : tires.length === 0 && !showAddTireForm ? (
          <p className="garage-empty">No tires yet — add one below.</p>
        ) : (
          tires.map(t => (
            <TireCard
              key={t.id}
              tire={t}
              bikes={bikes}
              onRefresh={loadData}
            />
          ))
        )}

        <div className="garage-add-section">
          {showAddTireForm ? (
            <AddTireForm onAdd={handleAddTire} onCancel={() => setShowAddTireForm(false)} />
          ) : (
            <button
              className="btn-pill btn-pill-outline garage-add-btn"
              onClick={() => setShowAddTireForm(true)}
            >
              + Add Tire
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
