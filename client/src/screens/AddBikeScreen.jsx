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

const MILEAGE_LABELS = {
  brake_pads:     'Brake pad mileage',
  brake_set:      'Brake set mileage',
  chain:          'Chain mileage',
  chain_ring:     'Chain ring mileage',
  cassette:       'Cassette mileage',
  tires:          'Tire mileage',
  bottom_bracket: 'Bottom Bracket mileage',
  drivetrain:     'Drive train mileage',
  fork:           'Fork mileage',
  head_set:       'Head set mileage',
  suspension:     'Suspension mileage',
  wheel_set:      'Wheel set mileage',
};

// ── MTB service interval sub-section ────────────────────────────────────────
function IntervalSubField({ label, fieldId, state, onChange }) {
  return (
    <div className="interval-sub-field">
      <p className="interval-sub-title">{label}</p>
      <div className="interval-input-row">
        <input
          id={`${fieldId}-value`}
          type="number"
          min="1"
          inputMode="numeric"
          placeholder="30"
          className="input-field interval-number-input"
          value={state.value}
          onChange={e => onChange({ ...state, value: e.target.value })}
        />
        <select
          id={`${fieldId}-unit`}
          className="interval-unit-select"
          value={state.unit}
          onChange={e => onChange({ ...state, unit: e.target.value })}
        >
          <option value="Hours">Hours</option>
          <option value="Months">Months</option>
        </select>
      </div>
    </div>
  );
}

// ── MTB component section (Fork or Rear Shock) ──────────────────────────────
function ServiceIntervalSection({
  componentKey,
  title,
  notePart,
  setting,
  onSettingChange,
  lowerLeg,
  onLowerLegChange,
  fullService,
  onFullServiceChange,
}) {
  return (
    <div className="mtb-component-section">
      <h3 className="mtb-section-title">{title}</h3>
      <div className="mtb-section-divider" />

      <p className="mtb-note">
        <em>A note regarding your {notePart}:</em>
      </p>
      <p className="mtb-note-body">
        Manufacturers recommend servicing your {notePart} every{' '}
        <strong>30 hours</strong> of ride time. Would you like to customize your
        service interval? You can change this later if you'd like.
      </p>

      <div className="interval-options">
        <label className="interval-option">
          <input
            type="radio"
            name={`${componentKey}-setting`}
            className="interval-radio"
            value="keep"
            checked={setting === 'keep'}
            onChange={() => onSettingChange('keep')}
          />
          <span className="interval-radio-visual" aria-hidden="true" />
          <span className="interval-option-label">Keep this setting</span>
        </label>

        <label className="interval-option">
          <input
            type="radio"
            name={`${componentKey}-setting`}
            className="interval-radio"
            value="change"
            checked={setting === 'change'}
            onChange={() => onSettingChange('change')}
          />
          <span className="interval-radio-visual" aria-hidden="true" />
          <span className="interval-option-label">Change my interval</span>
        </label>
      </div>

      {setting === 'change' && (
        <div className="interval-sub">
          <IntervalSubField
            label="Lower Leg"
            fieldId={`${componentKey}-lower`}
            state={lowerLeg}
            onChange={onLowerLegChange}
          />
          <IntervalSubField
            label="Full Service"
            fieldId={`${componentKey}-full`}
            state={fullService}
            onChange={onFullServiceChange}
          />
        </div>
      )}
    </div>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function AddBikeScreen({ onLogout }) {
  const navigate = useNavigate();
  // Steps: 1=bike type/brakes, 2=MTB suspension type, 3=components, 4=mileage, 5=MTB notifications
  const [step,               setStep]               = useState(1);
  const [index,              setIndex]              = useState(0);
  const [adding,             setAdding]             = useState(false);
  const [success,            setSuccess]            = useState(false);
  const [addError,           setAddError]           = useState('');
  const [bikes,              setBikes]              = useState([]);
  const [bikesLoading,       setBikesLoading]       = useState(true);
  const [fetchError,         setFetchError]         = useState('');
  const [bikeId,             setBikeId]             = useState('');
  const [padType,            setPadType]            = useState('');
  const [brakeType,          setBrakeType]          = useState('');
  const [rimMaterial,        setRimMaterial]        = useState('');
  const [suspensionType,     setSuspensionType]     = useState('');
  const [shiftingType,       setShiftingType]       = useState('');  // 'mechanical' | 'electronic'
  const [isTubeless,         setIsTubeless]         = useState(null); // null | true | false
  const [replacedComponents, setReplacedComponents] = useState(new Set());
  const [componentMileage,   setComponentMileage]   = useState({});

  // MTB notification settings
  const [forkSetting,      setForkSetting]      = useState('keep');
  const [forkLowerLeg,     setForkLowerLeg]     = useState({ value: '', unit: 'Hours' });
  const [forkFullService,  setForkFullService]  = useState({ value: '', unit: 'Hours' });
  const [shockSetting,     setShockSetting]     = useState('keep');
  const [shockLowerLeg,    setShockLowerLeg]    = useState({ value: '', unit: 'Hours' });
  const [shockFullService, setShockFullService] = useState({ value: '', unit: 'Hours' });

  // Reset brake selections whenever the bike type changes in the carousel
  useEffect(() => {
    setPadType('');
    setBrakeType('');
    setRimMaterial('');
    setSuspensionType('');
    setShiftingType('');
    setIsTubeless(null);
  }, [index]);

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

  const current   = BIKES[index];
  const total     = BIKES.length;
  const isMtb     = current.type === 'mtb';
  console.log('[AddBikeScreen] version: MTB-suspension-update, isMtb:', current?.type === 'mtb');

  // Bike type carousel (step 1)
  function prev() { setIndex(i => (i - 1 + total) % total); }
  function next() { setIndex(i => (i + 1) % total); }

  // Step 4 bike name carousel
  const bikeListIndex = bikes.findIndex(b => b.id === bikeId);
  function prevBike() {
    const i = (bikeListIndex - 1 + bikes.length) % bikes.length;
    setBikeId(bikes[i].id);
  }
  function nextBike() {
    const i = (bikeListIndex + 1) % bikes.length;
    setBikeId(bikes[i].id);
  }
  const selectedBike = bikes.find(b => b.id === bikeId);

  // Touch/swipe support (step 1 only)
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

  function setMileage(id, value) {
    setComponentMileage(prev => ({ ...prev, [id]: value }));
  }

  const checkedComponents = COMPONENTS.filter(c => replacedComponents.has(c.id));

  // Navigation helpers
  // Step 1 → 2 (MTB) or 3 (others)
  function handleStep1Next() {
    setStep(isMtb ? 2 : 3);
  }

  // Step 3 (components) → 4 (mileage) or 5 (MTB notifications) or finish
  function handleStep3Next() {
    if (replacedComponents.size > 0) { setStep(4); return; }
    if (isMtb)                       { setStep(5); return; }
    handleAdd();
  }

  // Step 4 (mileage) → 5 (MTB notifications) or finish
  function handleStep4Next() {
    if (isMtb) { setStep(5); return; }
    handleAdd();
  }

  // Step 5 back → 4 (mileage) or 3 (components)
  function handleStep5Back() {
    setStep(replacedComponents.size > 0 ? 4 : 3);
  }

  async function handleAdd() {
    if (!bikeId) return;
    setAdding(true);
    setAddError('');

    const mileageBaselines = {};
    for (const id of replacedComponents) {
      const val = componentMileage[id];
      if (val !== undefined && val !== '') {
        mileageBaselines[id] = Number(val);
      }
    }

    const isFullSuspension = suspensionType === 'full_suspension';
    const mtbServiceIntervals = isMtb ? {
      fork: forkSetting === 'keep'
        ? { default: true }
        : {
            lowerLeg:    { value: Number(forkLowerLeg.value)    || 0, unit: forkLowerLeg.unit },
            fullService: { value: Number(forkFullService.value) || 0, unit: forkFullService.unit },
          },
      ...(isFullSuspension && {
        rearShock: shockSetting === 'keep'
          ? { default: true }
          : {
              lowerLeg:    { value: Number(shockLowerLeg.value)    || 0, unit: shockLowerLeg.unit },
              fullService: { value: Number(shockFullService.value) || 0, unit: shockFullService.unit },
            },
      }),
    } : undefined;

    try {
      await api.configureBike(bikeId, {
        bikeType:           current.type,
        padType:            padType        || undefined,
        brakeType:          brakeType      || undefined,
        rimMaterial:        rimMaterial    || undefined,
        suspensionType:     suspensionType || undefined,
        shiftingType:       shiftingType   || undefined,
        isTubeless:         isTubeless !== null ? isTubeless : undefined,
        replacedComponents: [...replacedComponents],
        mileageBaselines,
        ...(mtbServiceIntervals && { mtbServiceIntervals }),
      });
      setSuccess(true);
      setTimeout(() => navigate(`/maintenance/${bikeId}/intervals`), 1500);
    } catch (err) {
      setAddError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="screen add-bike-screen">
      <AppHeader onLogout={onLogout} />

      {/* ── Step 1: Bike type + bike selector ── */}
      {step === 1 && (
        <div className="add-bike-body">
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

          <h2 className="section-heading add-bike-type-label">{current.label}</h2>
          <p className="add-bike-tagline text-muted">{current.tagline}</p>

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
              <div className="bike-image-wrap">
                <img
                  key={current.type}
                  src={current.image}
                  alt={current.label}
                  className="bike-image"
                  draggable={false}
                />
              </div>
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

          {/* ── Shifting type ── */}
          <div className="input-group pad-type-group">
            <span className="input-label">Shifting Type</span>
            <div className="pad-type-picker">
              {[
                { value: 'mechanical', label: 'Analog'      },
                { value: 'electronic', label: 'Electronic' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`pad-type-btn${shiftingType === opt.value ? ' pad-type-btn--selected' : ''}`}
                  onClick={() => setShiftingType(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tire setup ── */}
          <div className="input-group pad-type-group">
            <span className="input-label">Tire Setup</span>
            <div className="pad-type-picker">
              {[
                { value: true,  label: 'Tubeless'    },
                { value: false, label: 'With Tubes'  },
              ].map(opt => (
                <button
                  key={String(opt.value)}
                  type="button"
                  className={`pad-type-btn${isTubeless === opt.value ? ' pad-type-btn--selected' : ''}`}
                  onClick={() => setIsTubeless(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Brake configuration ── */}
          {isMtb ? (
            <>
              {/* MTB: simple pad type + system type */}
              <div className="input-group pad-type-group">
                <span className="input-label">Brake Pad Type</span>
                <div className="pad-type-picker">
                  {[
                    { value: 'resin',         label: 'Resin'         },
                    { value: 'metal',         label: 'Metallic'      },
                    { value: 'semi_metallic', label: 'Semi-Metallic' },
                    { value: 'unknown',       label: 'Not sure'      },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`pad-type-btn${padType === opt.value ? ' pad-type-btn--selected' : ''}`}
                      onClick={() => setPadType(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group pad-type-group">
                <span className="input-label">Brake System Type</span>
                <div className="pad-type-picker">
                  {[
                    { value: 'hydraulic',  label: 'Hydraulic'  },
                    { value: 'mechanical', label: 'Mechanical' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`pad-type-btn${brakeType === opt.value ? ' pad-type-btn--selected' : ''}`}
                      onClick={() => setBrakeType(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Road / Gravel: cascading brake questions */}
              <div className="input-group pad-type-group">
                <span className="input-label">Brake Type</span>
                <div className="pad-type-picker">
                  {[
                    { value: 'rim',        label: 'Rim Brakes'        },
                    { value: 'disc',       label: 'Disc Brakes'       },
                    { value: 'cantilever', label: 'Cantilever Brakes' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`pad-type-btn${brakeType === opt.value ? ' pad-type-btn--selected' : ''}`}
                      onClick={() => {
                        setBrakeType(opt.value);
                        setRimMaterial('');
                        setPadType('');
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Disc: pad compound */}
              {brakeType === 'disc' && (
                <div className="input-group pad-type-group">
                  <span className="input-label">Pad Compound</span>
                  <div className="pad-type-picker">
                    {[
                      { value: 'resin',         label: 'Resin'         },
                      { value: 'metal',         label: 'Metallic'      },
                      { value: 'semi_metallic', label: 'Semi-Metallic' },
                      { value: 'unknown',       label: 'Not sure'      },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`pad-type-btn${padType === opt.value ? ' pad-type-btn--selected' : ''}`}
                        onClick={() => setPadType(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Rim / Cantilever: rim material first */}
              {(brakeType === 'rim' || brakeType === 'cantilever') && (
                <div className="input-group pad-type-group">
                  <span className="input-label">Wheel Rim Material</span>
                  <div className="pad-type-picker">
                    {[
                      { value: 'carbon', label: 'Carbon' },
                      { value: 'alloy',  label: 'Alloy'  },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`pad-type-btn${rimMaterial === opt.value ? ' pad-type-btn--selected' : ''}`}
                        onClick={() => {
                          setRimMaterial(opt.value);
                          if (opt.value === 'carbon') {
                            setPadType('carbon');
                          } else {
                            setPadType('');
                          }
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Carbon rims: auto note */}
              {rimMaterial === 'carbon' && (
                <p className="add-brake-note">
                  Carbon-specific pads selected automatically.
                </p>
              )}

              {/* Alloy rims: pad sub-selection */}
              {rimMaterial === 'alloy' && (
                <div className="input-group pad-type-group">
                  <span className="input-label">Pad Type</span>
                  <div className="pad-type-picker">
                    {[
                      { value: 'cork',          label: 'Cork / Rubber'  },
                      { value: 'wet_weather',   label: 'Wet Weather'    },
                      { value: 'hard_compound', label: 'Hard Compound'  },
                      { value: 'unknown',       label: 'Not sure'       },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`pad-type-btn${padType === opt.value ? ' pad-type-btn--selected' : ''}`}
                        onClick={() => setPadType(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Step 2: MTB suspension type (MTB only) ── */}
      {step === 2 && (
        <div className="add-bike-body">
          <h2 className="section-heading" style={{ marginBottom: 8 }}>
            What type of MTB do you have?
          </h2>
          <p className="add-bike-tagline text-muted" style={{ marginBottom: 24 }}>
            This determines which suspension components we track for you.
          </p>
          <div className="input-group pad-type-group">
            <div className="pad-type-picker">
              {[
                { value: 'hardtail',        label: 'Hardtail' },
                { value: 'full_suspension', label: 'Full Suspension' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`pad-type-btn${suspensionType === opt.value ? ' pad-type-btn--selected' : ''}`}
                  onClick={() => setSuspensionType(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Components checklist ── */}
      {step === 3 && (
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

      {/* ── Step 4: Mileage baselines ── */}
      {step === 4 && (
        <div className="add-bike-body mileage-body">
          <div className="mileage-heading">
            <h2 className="section-heading">Component details</h2>
            <p className="mileage-intro-text">
              We'll need some more information about your new components in order to suggest the right service intervals.
            </p>
          </div>
          <div className="mileage-form">
            {checkedComponents.map(c => (
              <div key={c.id} className="input-group">
                <label className="input-label" htmlFor={`mileage-${c.id}`}>
                  {MILEAGE_LABELS[c.id]}
                </label>
                <input
                  id={`mileage-${c.id}`}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="e.g. 500"
                  className="input-field"
                  value={componentMileage[c.id] ?? ''}
                  onChange={e => setMileage(c.id, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 5: MTB notification settings ── */}
      {step === 5 && (
        <div className="add-bike-body mtb-settings-body">
          {/* Header: bike type + name with carousel */}
          <div className="mtb-step-header">
            <p className="mtb-type-label">{current.label}</p>
            {bikes.length > 0 && (
              <div className="mtb-bike-nav">
                <button
                  className="carousel-arrow"
                  onClick={prevBike}
                  aria-label="Previous bike"
                  disabled={bikes.length <= 1}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <span className="mtb-bike-nav-name">{selectedBike?.name ?? '—'}</span>
                <button
                  className="carousel-arrow"
                  onClick={nextBike}
                  aria-label="Next bike"
                  disabled={bikes.length <= 1}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
            <h2 className="section-heading mtb-settings-title">
              Customize your notification settings
            </h2>
          </div>

          <ServiceIntervalSection
            componentKey="fork"
            title="Fork"
            notePart="fork"
            setting={forkSetting}
            onSettingChange={setForkSetting}
            lowerLeg={forkLowerLeg}
            onLowerLegChange={setForkLowerLeg}
            fullService={forkFullService}
            onFullServiceChange={setForkFullService}
          />

          {suspensionType === 'full_suspension' && (
            <ServiceIntervalSection
              componentKey="rearShock"
              title="Rear Shock"
              notePart="rear shock"
              setting={shockSetting}
              onSettingChange={setShockSetting}
              lowerLeg={shockLowerLeg}
              onLowerLegChange={setShockLowerLeg}
              fullService={shockFullService}
              onFullServiceChange={setShockFullService}
            />
          )}
        </div>
      )}

      {/* ── Sticky bottom CTA ── */}
      <div className="add-bike-footer">
        {success && (
          <p className="add-bike-success">
            ✓ {current.label} added — loading your maintenance schedule…
          </p>
        )}
        {addError && (
          <p className="add-bike-error">{addError}</p>
        )}

        {step === 1 && (
          <>
            <button
              className="btn-pill btn-pill-gold"
              onClick={handleStep1Next}
              disabled={
                !bikeId || bikesLoading ||
                !shiftingType || isTubeless === null ||
                (isMtb
                  ? (!padType || !brakeType)
                  : (!brakeType ||
                     (brakeType === 'disc' && !padType) ||
                     ((brakeType === 'rim' || brakeType === 'cantilever') &&
                      (!rimMaterial || (rimMaterial === 'alloy' && !padType))))
                )
              }
            >
              Next
            </button>
            <button className="auth-skip-btn" onClick={() => navigate(-1)}>
              Cancel
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <button
              className="btn-pill btn-pill-gold"
              onClick={() => setStep(3)}
              disabled={!suspensionType}
            >
              Next
            </button>
            <button className="auth-skip-btn" onClick={() => setStep(1)}>
              Back
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <button
              className="btn-pill btn-pill-gold"
              onClick={handleStep3Next}
              disabled={adding || success}
            >
              Next
            </button>
            <button className="auth-skip-btn" onClick={() => setStep(isMtb ? 2 : 1)}>
              Back
            </button>
          </>
        )}

        {step === 4 && (
          <>
            <button
              className="btn-pill btn-pill-gold"
              onClick={handleStep4Next}
              disabled={adding || success}
            >
              Next
            </button>
            <button className="auth-skip-btn" onClick={() => setStep(3)}>
              Back
            </button>
          </>
        )}

        {step === 5 && (
          <>
            <button
              className="btn-pill btn-pill-gold"
              onClick={handleAdd}
              disabled={adding || success}
            >
              {adding ? 'Adding…' : 'Finish'}
            </button>
            <button className="auth-skip-btn" onClick={handleStep5Back}>
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
