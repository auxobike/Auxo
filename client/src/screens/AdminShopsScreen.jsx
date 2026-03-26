import { useState, useEffect } from 'react';
import './AdminShopsScreen.css';

// Use same origin in prod (proxied in dev via vite config)
const API_BASE = import.meta.env.VITE_API_URL || '';

async function adminFetch(path, key, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'x-admin-key':  key,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return res;
}

// ── Password gate ─────────────────────────────────────────────────────────────

function PasswordGate({ onAuth }) {
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/shops/verify', password);
      if (res.ok) {
        onAuth(password);
      } else {
        setError('Invalid password.');
      }
    } catch {
      setError('Connection error. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-gate">
      <div className="admin-gate-box">
        <h1 className="admin-gate-title">AUXO</h1>
        <p className="admin-gate-sub">Admin Access</p>
        <form onSubmit={handleSubmit} className="admin-gate-form">
          <input
            type="password"
            className="admin-input"
            placeholder="Admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="admin-error">{error}</p>}
          <button type="submit" className="admin-btn admin-btn--gold" disabled={loading}>
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Admin panel ───────────────────────────────────────────────────────────────

function AdminPanel({ apiKey }) {
  const [shops,   setShops]   = useState([]);
  const [loading, setLoading] = useState(true);

  // Add-form state
  const [placeId,    setPlaceId]    = useState('');
  const [shopName,   setShopName]   = useState('');
  const [boostLevel, setBoostLevel] = useState('partner');
  const [addError,   setAddError]   = useState('');
  const [adding,     setAdding]     = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  // Removing state: Set of placeIds currently being removed
  const [removing, setRemoving] = useState(new Set());

  useEffect(() => {
    fetch(`${API_BASE}/api/shops/featured`)
      .then(r => r.json())
      .then(setShops)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setAdding(true);
    setAddError('');
    setAddSuccess(false);
    try {
      const res = await adminFetch('/api/admin/shops/featured', apiKey, {
        method: 'POST',
        body:   JSON.stringify({ googlePlaceId: placeId.trim(), name: shopName.trim(), boostLevel }),
      });
      const data = await res.json();
      if (res.ok) {
        setShops(data.shops);
        setPlaceId('');
        setShopName('');
        setBoostLevel('partner');
        setAddSuccess(true);
        setTimeout(() => setAddSuccess(false), 3000);
      } else {
        setAddError(data.error || 'Failed to add shop.');
      }
    } catch {
      setAddError('Connection error.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(googlePlaceId) {
    setRemoving(prev => new Set(prev).add(googlePlaceId));
    try {
      const res = await adminFetch('/api/admin/shops/featured', apiKey, {
        method: 'POST',
        body:   JSON.stringify({ action: 'remove', googlePlaceId }),
      });
      if (res.ok) {
        const data = await res.json();
        setShops(data.shops);
      }
    } catch {
      // silently fail — UI stays as-is
    } finally {
      setRemoving(prev => { const s = new Set(prev); s.delete(googlePlaceId); return s; });
    }
  }

  return (
    <div className="admin-screen">
      <div className="admin-body">
        <div className="admin-heading">
          <p className="admin-heading-sub">Admin</p>
          <h1 className="admin-heading-main">Featured Shops</h1>
        </div>

        {/* ── Current shops ── */}
        <section className="admin-section">
          <h2 className="admin-section-title">Current List</h2>
          {loading && <p className="admin-muted">Loading…</p>}
          {!loading && shops.length === 0 && (
            <p className="admin-muted">No featured shops yet.</p>
          )}
          {!loading && shops.length > 0 && (
            <div className="admin-shops-list">
              {shops.map(shop => (
                <div key={shop.googlePlaceId} className="admin-shop-row">
                  <div className="admin-shop-info">
                    <span className="admin-shop-name">{shop.name}</span>
                    <span className="admin-shop-id">{shop.googlePlaceId}</span>
                  </div>
                  <span className={`admin-badge admin-badge--${shop.boostLevel}`}>
                    {shop.boostLevel}
                  </span>
                  <button
                    className="admin-btn admin-btn--danger"
                    onClick={() => handleRemove(shop.googlePlaceId)}
                    disabled={removing.has(shop.googlePlaceId)}
                  >
                    {removing.has(shop.googlePlaceId) ? '…' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Add shop form ── */}
        <section className="admin-section">
          <h2 className="admin-section-title">Add Shop</h2>
          <form onSubmit={handleAdd} className="admin-form">
            <div className="admin-field">
              <label className="admin-label">Google Place ID</label>
              <input
                type="text"
                className="admin-input"
                placeholder="ChIJ…"
                value={placeId}
                onChange={e => setPlaceId(e.target.value)}
                required
              />
            </div>
            <div className="admin-field">
              <label className="admin-label">Shop Name</label>
              <input
                type="text"
                className="admin-input"
                placeholder="Trek Store Portland"
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                required
              />
            </div>
            <div className="admin-field">
              <label className="admin-label">Boost Level</label>
              <select
                className="admin-input admin-select"
                value={boostLevel}
                onChange={e => setBoostLevel(e.target.value)}
              >
                <option value="partner">Partner</option>
                <option value="featured">Featured</option>
              </select>
            </div>
            {addError   && <p className="admin-error">{addError}</p>}
            {addSuccess && <p className="admin-success">Shop added successfully.</p>}
            <button type="submit" className="admin-btn admin-btn--gold" disabled={adding}>
              {adding ? 'Adding…' : 'Add Shop'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AdminShopsScreen() {
  const [apiKey, setApiKey] = useState('');

  if (!apiKey) return <PasswordGate onAuth={setApiKey} />;
  return <AdminPanel apiKey={apiKey} />;
}
