import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api } from '../api';
import './EditBikeSettingsScreen.css';

function Picker({ label, options, value, onChange }) {
  return (
    <div className="ebs-group">
      <span className="ebs-label">{label}</span>
      <div className="ebs-picker">
        {options.map(opt => (
          <button
            key={String(opt.value)}
            type="button"
            className={`ebs-btn${value === opt.value ? ' ebs-btn--selected' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function EditBikeSettingsScreen({ onLogout }) {
  const { bikeId } = useParams();
  const navigate   = useNavigate();

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);
  const [bikeName, setBikeName] = useState('');

  const [bikeType,     setBikeTypeVal]  = useState('');
  const [brakeType,    setBrakeType]    = useState('');
  const [rimMaterial,  setRimMaterial]  = useState('');
  const [padType,      setPadType]      = useState('');
  const [isTubeless,   setIsTubeless]   = useState(null);
  const [chainType,    setChainType]    = useState('');

  useEffect(() => {
    Promise.all([
      api.getBikeConfig(bikeId),
      api.getMaintenanceStatus(bikeId),
    ])
      .then(([config, status]) => {
        setBikeTypeVal(config.bikeType    ?? '');
        setBrakeType(config.brakeType     ?? '');
        setRimMaterial(config.rimMaterial ?? '');
        setPadType(config.padType         ?? '');
        setIsTubeless(config.isTubeless   ?? null);
        setChainType(config.chainType     ?? '');
        setBikeName(status.gear?.name     ?? '');
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [bikeId]);

  const isMtb             = bikeType === 'mtb';
  const isRimOrCantilever = brakeType === 'rim' || brakeType === 'cantilever';

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const config = {};
      if (brakeType)            config.brakeType   = brakeType;
      if (rimMaterial)          config.rimMaterial = rimMaterial;
      if (padType)              config.padType     = padType;
      if (isTubeless !== null)  config.isTubeless  = isTubeless;
      if (chainType)            config.chainType   = chainType;

      if (Object.keys(config).length > 0) {
        await api.configureBike(bikeId, config);
      }
      navigate(`/maintenance/${bikeId}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="screen ebs-screen">
        <AppHeader onLogout={onLogout} />
        <div className="ebs-loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="screen ebs-screen">
      <AppHeader onLogout={onLogout} />

      <div className="ebs-body">
        <div className="ebs-heading-row">
          <h1 className="ebs-heading">Bike Settings</h1>
          {bikeName && <p className="ebs-bike-name">{bikeName}</p>}
        </div>

        <p className="ebs-intro">
          Update your brake and tire configuration. Changes take effect immediately
          on your maintenance schedule.
        </p>

        {/* Brake type */}
        {isMtb ? (
          <Picker
            label="Brake System"
            options={[
              { value: 'hydraulic',  label: 'Hydraulic'  },
              { value: 'mechanical', label: 'Mechanical' },
            ]}
            value={brakeType}
            onChange={setBrakeType}
          />
        ) : (
          <Picker
            label="Brake Type"
            options={[
              { value: 'rim',        label: 'Rim Brakes'        },
              { value: 'disc',       label: 'Disc Brakes'       },
              { value: 'cantilever', label: 'Cantilever Brakes' },
            ]}
            value={brakeType}
            onChange={v => { setBrakeType(v); setRimMaterial(''); setPadType(''); }}
          />
        )}

        {/* Disc pad compound (road/gravel) */}
        {!isMtb && brakeType === 'disc' && (
          <Picker
            label="Pad Compound"
            options={[
              { value: 'resin',         label: 'Resin'         },
              { value: 'metal',         label: 'Metallic'      },
              { value: 'semi_metallic', label: 'Semi-Metallic' },
              { value: 'unknown',       label: 'Not sure'      },
            ]}
            value={padType}
            onChange={setPadType}
          />
        )}

        {/* Rim material (road/gravel rim or cantilever) */}
        {!isMtb && isRimOrCantilever && (
          <Picker
            label="Wheel Rim Material"
            options={[
              { value: 'carbon', label: 'Carbon' },
              { value: 'alloy',  label: 'Alloy'  },
            ]}
            value={rimMaterial}
            onChange={v => {
              setRimMaterial(v);
              setPadType(v === 'carbon' ? 'carbon' : '');
            }}
          />
        )}

        {rimMaterial === 'carbon' && (
          <p className="ebs-note">Carbon-specific pads selected automatically.</p>
        )}

        {/* Alloy rim pad sub-type */}
        {!isMtb && isRimOrCantilever && rimMaterial === 'alloy' && (
          <Picker
            label="Pad Type"
            options={[
              { value: 'cork',          label: 'Cork / Rubber' },
              { value: 'wet_weather',   label: 'Wet Weather'   },
              { value: 'hard_compound', label: 'Hard Compound' },
              { value: 'unknown',       label: 'Not sure'      },
            ]}
            value={padType}
            onChange={setPadType}
          />
        )}

        {/* MTB pad type */}
        {isMtb && (
          <Picker
            label="Brake Pad Type"
            options={[
              { value: 'resin',         label: 'Resin'         },
              { value: 'metal',         label: 'Metallic'      },
              { value: 'semi_metallic', label: 'Semi-Metallic' },
              { value: 'unknown',       label: 'Not sure'      },
            ]}
            value={padType}
            onChange={setPadType}
          />
        )}

        {/* Tire setup */}
        <Picker
          label="Tire Setup"
          options={[
            { value: true,  label: 'Tubeless'   },
            { value: false, label: 'With Tubes' },
          ]}
          value={isTubeless}
          onChange={setIsTubeless}
        />

        {/* Chain lube type */}
        <Picker
          label="Chain Lube Type"
          options={[
            { value: 'standard', label: 'Standard' },
            { value: 'wax',      label: 'Wax'      },
          ]}
          value={chainType}
          onChange={setChainType}
        />

        {error && <p className="ebs-error">{error}</p>}
      </div>

      <div className="ebs-footer">
        <button
          className="btn-pill btn-pill-gold"
          style={{ width: '70%' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="ebs-cancel" onClick={() => navigate(-1)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
