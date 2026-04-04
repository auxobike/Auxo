import { useState, useEffect, useRef } from 'react';
import './AdminShopsScreen.css';

const BASE_URL        = import.meta.env.VITE_API_URL || '';
const MAPS_API_KEY    = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const ADMIN_MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#1e1c14' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#8a8068' }] },
  { featureType: 'road',  elementType: 'geometry', stylers: [{ color: '#2e2a1c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d0c08' }] },
  { featureType: 'poi',   stylers: [{ visibility: 'off' }] },
];

function loadMapsAPI() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) { resolve(); return; }
    const existing = document.getElementById('gmaps-script');
    if (existing) {
      existing.addEventListener('load',  resolve);
      existing.addEventListener('error', reject);
      return;
    }
    const script    = document.createElement('script');
    script.id       = 'gmaps-script';
    script.src      = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places`;
    script.async    = true;
    script.onload   = resolve;
    script.onerror  = reject;
    document.head.appendChild(script);
  });
}

async function adminFetch(method, path, key, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: { 'x-admin-key': key },
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  return fetch(`${BASE_URL}${path}`, opts);
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
      const res = await adminFetch('GET', '/api/admin/shops/verify', password);
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

  const [placeId,    setPlaceId]    = useState('');
  const [shopName,   setShopName]   = useState('');
  const [boostLevel, setBoostLevel] = useState('partner');
  const [addError,   setAddError]   = useState('');
  const [adding,     setAdding]     = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [removing,   setRemoving]   = useState(new Set());

  // ── Find Place ID ──
  const findMapDivRef = useRef(null);
  const findMapRef    = useRef(null);
  const findSvcRef    = useRef(null);
  const findMarkersRef = useRef([]);

  const [findQuery,    setFindQuery]    = useState('');
  const [findMapsOk,   setFindMapsOk]  = useState(false);
  const [findSearching, setFindSearching] = useState(false);
  const [findResults,  setFindResults]  = useState([]);
  const [findShowMap,  setFindShowMap]  = useState(false);
  const [pickedPlace,  setPickedPlace]  = useState(null);  // { name, placeId }
  const [copied,       setCopied]       = useState(false);

  useEffect(() => {
    loadMapsAPI().then(() => setFindMapsOk(true)).catch(() => {});
  }, []);

  // Create / update the find map whenever the section becomes visible
  useEffect(() => {
    if (!findShowMap || !findMapsOk || !findMapDivRef.current) return;
    if (!findMapRef.current) {
      findMapRef.current = new window.google.maps.Map(findMapDivRef.current, {
        zoom: 13, disableDefaultUI: true, zoomControl: true,
        styles: ADMIN_MAP_STYLE,
      });
    }
  }, [findShowMap, findMapsOk]);

  function handleFindSearch(e) {
    e.preventDefault();
    if (!findQuery.trim() || !findMapsOk) return;
    setFindSearching(true);
    setFindResults([]);
    setPickedPlace(null);

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: findQuery }, (results, status) => {
      if (status !== 'OK' || !results[0]) { setFindSearching(false); return; }
      const center = {
        lat: results[0].geometry.location.lat(),
        lng: results[0].geometry.location.lng(),
      };
      setFindShowMap(true);

      // Let React render the map div, then position + search
      setTimeout(() => {
        if (!findMapRef.current) return;
        findMapRef.current.setCenter(center);
        findMapRef.current.setZoom(13);

        // Clear old markers
        findMarkersRef.current.forEach(m => m.setMap(null));
        findMarkersRef.current = [];

        findSvcRef.current = new window.google.maps.places.PlacesService(findMapRef.current);
        findSvcRef.current.nearbySearch(
          { location: center, radius: 8000, type: 'bicycle_store' },
          (places, searchStatus) => {
            setFindSearching(false);
            if (searchStatus !== window.google.maps.places.PlacesServiceStatus.OK) return;
            setFindResults(places || []);

            places?.forEach(place => {
              const marker = new window.google.maps.Marker({
                position: place.geometry.location,
                map:      findMapRef.current,
                title:    place.name,
                icon: {
                  path:        window.google.maps.SymbolPath.CIRCLE,
                  scale:       11,
                  fillColor:   '#c9960c',
                  fillOpacity: 1,
                  strokeColor: '#2D2613',
                  strokeWeight: 2,
                },
              });
              marker.addListener('click', () =>
                setPickedPlace({ name: place.name, placeId: place.place_id }),
              );
              findMarkersRef.current.push(marker);
            });
          },
        );
      }, 50);
    });
  }

  function handleUsePlace(place) {
    setPlaceId(place.placeId || place.place_id);
    setShopName(place.name);
    setPickedPlace({ name: place.name, placeId: place.placeId || place.place_id });
    document.querySelector('.admin-add-section')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleCopy(id) {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    fetch(`${BASE_URL}/api/shops/featured`, { credentials: 'include' })
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
      const res  = await adminFetch('POST', '/api/admin/shops/featured', apiKey, {
        googlePlaceId: placeId.trim(),
        name:          shopName.trim(),
        boostLevel,
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
      const res  = await adminFetch('POST', '/api/admin/shops/featured', apiKey, {
        action: 'remove',
        googlePlaceId,
      });
      if (res.ok) {
        const data = await res.json();
        setShops(data.shops);
      }
    } catch {
      // silently fail — list stays as-is
    } finally {
      setRemoving(prev => {
        const s = new Set(prev);
        s.delete(googlePlaceId);
        return s;
      });
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

        {/* ── Find Place ID ── */}
        <section className="admin-section">
          <h2 className="admin-section-title">Find Place ID</h2>
          <p className="admin-muted">Search a location to find nearby bike shops on the map. Click a marker or row to reveal its Place ID, then fill it into the form below.</p>

          <form className="admin-find-form" onSubmit={handleFindSearch}>
            <input
              type="text"
              className="admin-input"
              placeholder="City, address or zip code"
              value={findQuery}
              onChange={e => setFindQuery(e.target.value)}
            />
            <button type="submit" className="admin-btn admin-btn--gold" disabled={findSearching || !findMapsOk}>
              {findSearching ? 'Searching…' : 'Search'}
            </button>
          </form>

          {findShowMap && (
            <div className="admin-find-map-wrap">
              <div ref={findMapDivRef} className="admin-find-map" />
            </div>
          )}

          {findResults.length > 0 && (
            <div className="admin-find-results">
              {findResults.map(place => (
                <div
                  key={place.place_id}
                  className={`admin-find-row${pickedPlace?.placeId === place.place_id ? ' admin-find-row--active' : ''}`}
                  onClick={() => setPickedPlace({ name: place.name, placeId: place.place_id })}
                >
                  <span className="admin-find-name">{place.name}</span>
                  <span className="admin-find-id">{place.place_id}</span>
                </div>
              ))}
            </div>
          )}

          {pickedPlace && (
            <div className="admin-picked">
              <div className="admin-picked-name">{pickedPlace.name}</div>
              <div className="admin-picked-id-row">
                <code className="admin-picked-id">{pickedPlace.placeId}</code>
                <button
                  className="admin-btn admin-btn--copy"
                  onClick={() => handleCopy(pickedPlace.placeId)}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  className="admin-btn admin-btn--gold"
                  onClick={() => handleUsePlace(pickedPlace)}
                >
                  Fill Form
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Add shop ── */}
        <section className="admin-section admin-add-section">
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
            {addSuccess && <p className="admin-success">Shop added.</p>}
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
