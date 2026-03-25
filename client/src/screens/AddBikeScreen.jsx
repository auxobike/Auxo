import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api } from '../api';
import './AddBikeScreen.css';

const BIKES = [
  {
    type:    'road',
    label:   'Road Bike',
    image:   '/bikes/road.png',
    tagline: 'Built for speed on pavement',
  },
  {
    type:    'mtb',
    label:   'Mountain Bike',
    image:   '/bikes/mtb.png',
    tagline: 'Engineered for the trail',
  },
  {
    type:    'gravel',
    label:   'Gravel Bike',
    image:   '/bikes/gravel.png',
    tagline: 'Ready for any surface',
  },
];

const COMPONENTS = [
  { id: 'bottom_bracket', label: 'Bottom Bracket' },
  { id: 'brake_pads',     label: 'Brake pads' },
  { id: 'brake_set',      label: 'Brake set' },
  { id: 'chain',          label: 'Chain' },
  { id: 'chain_ring',     label: 'Chain ring' },
  { id: 'cassette',       label: 'Cassette' },
  { id: 'drivetrain',     label: 'Drive train group set' },
  { id: 'fork',           label: 'Fork' },
  { id: 'head_set',       label: 'Head set' },
  { id: 'tires',          label: 'Tires' },
  { id: 'suspension',     label: 'Suspension system' },
  { id: 'wheel_set',      label: 'Wheel set' },
];

export default function AddBikeScreen() {
  const navigate = useNavigate();
  const [step,               setStep]               = useState(1);
  const [index,              setIndex]              = useState(0);
  const [adding,             setAdding]             = useState(false);
  const [success,            setSuccess]            = useState(false);
  const [addError,           setAddError]           = useState('');
  const [bikes,              setBikes]              = useState([]);
  const [bikesLoading,       setBikesLoading]       = useState(true);
  const [fetchError,         setFetchError]         = useState('');
  const [bikeId,             setBikeId]             = useState('');
  const [replacedComponents, setReplacedComponents] = useState(new Set());

  // Always fetch bikes fresh on mount — don't rely on prop timing from App.jsx
  useEffect(() => {
    api.getBikes()
      .then(data => {
        console.log('[AddBikeScreen] fetched bikes:', data);
        setBikes(data);
        if (data.length > 0) setBikeId(data[0].id);
      })
      .catch(err => {
        console.error('[AddBikeScreen] failed to fetch bikes:', err.message);
        setFetchError('Could not load your bikes from Strava. Please try again.');
      })
      .finally(() => setBikesLoading(false));
  }, []);

  const current = BIKES[index];
  const total   = BIKES.length;

  function prev() { setIndex(i => (i - 1 + total) % total); }
  function next() { setIndex(i => (i + 1) % total); }

  // Touch/swipe support
  const [touchStart, setTouchStart] = useState(null);
  function onTouchStart(e) { setTouchStart(e.touches[0].clientX); }
  function onTouchEnd(e) {
    if (touchStart === null) return;
    const delta = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) { delta > 0 ? next() : prev(); }
    setTouchStart(null);
  }

  function toggleComponent(id) {
    setReplacedComponents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (!bikeId) return;
    setAdding(true);
    setAddError('');
    try {
      await api.configureBike(bikeId, {
        bikeType: current.type,
        replacedComponents: [...replacedComponents],
      });
      setSuccess(true);
      setTimeout(() => navigate('/maintenance'), 1500);
    } catch (err) {
      setAddError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="screen add-bike-screen">
      <AppHeader />

      {step === 1 ? (
        <div className="add-bike-body">
          {/* Bike type indicator dots */}
          <div className="bike-dots" aria-label="Bike type selector">
            {BIKES.map((b, i) => (
              <button
                key={b.type}
                className={`bike-dot ${i === index ? 'active' : ''}`}
                onClick={() => setIndex(i)}
                aria-label={b.label}
              />
            ))}
          </div>

          {/* Bike label */}
          <h2 className="section-heading add-bike-type-label">{current.label}</h2>
          <p className="add-bike-tagline text-muted">{current.tagline}</p>

          {/* Carousel */}
          <div
            className="bike-carousel"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <button className="carousel-arrow carousel-prev" onClick={prev} aria-label="Previous bike">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="carousel-stage">
              {/* Main bike image */}
              <div className="bike-image-wrap">
                <img
                  key={current.type}
                  src={current.image}
                  alt={current.label}
                  className="bike-image"
                  draggable={false}
                />
              </div>

              {/* Floating terrain below */}
              <div className={`terrain-wrap${current.type !== 'mtb' ? ' terrain-wrap--tarmac' : ''}`}>
                <img
                  src={current.type === 'mtb' ? '/bikes/earth-stuff.png' : '/bikes/floating-tarmac.png'}
                  alt=""
                  className="terrain-image"
                  draggable={false}
                  aria-hidden="true"
                />
              </div>
            </div>

            <button className="carousel-arrow carousel-next" onClick={next} aria-label="Next bike">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Bike selector */}
          <div className="input-group bike-picker-group">
            <label className="input-label" htmlFor="bike-select">Select your bike</label>
            {bikesLoading ? (
              <p className="bike-picker-loading">Loading your bikes from Strava…</p>
            ) : bikes.length === 0 ? (
              <p className="bike-picker-empty">
                No bikes found on your Strava account.{' '}
                <a href="https://www.strava.com/settings/gear" target="_blank" rel="noreferrer">
                  Add one in Strava
                </a>
                , then come back.
              </p>
            ) : (
              <select
                id="bike-select"
                className="input-field"
                value={bikeId}
                onChange={e => setBikeId(e.target.value)}
              >
                {bikes.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      ) : (
        <div className="add-bike-body components-body">
          <div className="components-heading">
            <h2 className="section-heading">Replaced any components?</h2>
            <p className="components-subheading text-muted">Check any that apply:</p>
          </div>
          <div className="components-list">
            {COMPONENTS.map(c => (
              <label key={c.id} className="component-item">
                <input
                  type="checkbox"
                  className="component-checkbox"
                  checked={replacedComponents.has(c.id)}
                  onChange={() => toggleComponent(c.id)}
                />
                <span className="component-check-visual" aria-hidden="true" />
                <span className="component-label">{c.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Sticky bottom CTA */}
      <div className="add-bike-footer">
        {success && (
          <p className="add-bike-success">
            ✓ {current.label} added — loading your maintenance schedule…
          </p>
        )}
        {addError && (
          <p className="add-bike-error">{addError}</p>
        )}
        {step === 1 ? (
          <>
            <button
              className="btn-pill btn-pill-gold"
              onClick={() => setStep(2)}
              disabled={!bikeId || bikesLoading}
            >
              Next
            </button>
            <button className="auth-skip-btn" onClick={() => navigate(-1)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              className="btn-pill btn-pill-gold"
              onClick={handleAdd}
              disabled={adding || success}
            >
              {adding ? 'Adding…' : 'Next'}
            </button>
            <button className="auth-skip-btn" onClick={() => setStep(1)}>
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
