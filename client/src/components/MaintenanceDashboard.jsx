import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import BikeSetup from './BikeSetup';
import MaintenanceItem from './MaintenanceItem';

const SUMMARY_LABEL = {
  ok:        { text: 'All good',    cls: 'status-ok' },
  due_soon:  { text: 'Due soon',    cls: 'status-due-soon' },
  due:       { text: 'Service due', cls: 'status-due' },
  overdue:   { text: 'Overdue',     cls: 'status-overdue' },
};

function BikeCard({ bike }) {
  const [view,        setView]        = useState('loading'); // loading | setup | dashboard | error
  const [statusData,  setStatusData]  = useState(null);
  const [openSections,setOpenSections]= useState({});

  const loadStatus = useCallback(async () => {
    setView('loading');
    try {
      const data = await api.getMaintenanceStatus(bike.id);
      setStatusData(data);
      // Default: open sections that have due/overdue items
      const defaultOpen = {};
      data.sections.forEach(s => {
        const hasUrgent = s.items.some(i => ['due', 'overdue', 'due_soon'].includes(i.status.status));
        defaultOpen[s.id] = hasUrgent;
      });
      setOpenSections(defaultOpen);
      setView('dashboard');
    } catch (err) {
      if (err.message.includes('400')) {
        setView('setup');
      } else {
        setView('error');
      }
    }
  }, [bike.id]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  function toggleSection(id) {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  }

  if (view === 'loading') {
    return (
      <div className="bike-card loading-card">
        <div className="bike-card-header">
          <h2>{bike.name}</h2>
        </div>
        <p className="loading-text">Loading maintenance data…</p>
      </div>
    );
  }

  if (view === 'setup') {
    return (
      <div className="bike-card setup-card">
        <div className="bike-card-header">
          <h2>{bike.name}</h2>
        </div>
        <BikeSetup bike={bike} onSaved={loadStatus} />
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div className="bike-card error-card">
        <div className="bike-card-header">
          <h2>{bike.name}</h2>
        </div>
        <p>Failed to load maintenance data.</p>
        <button onClick={loadStatus}>Retry</button>
      </div>
    );
  }

  const { summary, sections, currentMileage, currentRideCount, bikeLabel } = statusData;
  const sumBadge = SUMMARY_LABEL[summary.overall] || SUMMARY_LABEL.ok;

  return (
    <div className={`bike-card ${sumBadge.cls}`}>
      <div className="bike-card-header">
        <div className="bike-title">
          <h2>{bike.name}</h2>
          <span className="bike-type-label">{bikeLabel}</span>
        </div>
        <div className="bike-stats">
          <span>{currentMileage.toLocaleString()} mi total</span>
          <span>{currentRideCount} rides tracked</span>
        </div>
        <span className={`badge ${sumBadge.cls}`}>{sumBadge.text}</span>
      </div>

      {summary.urgent > 0 && (
        <div className="urgent-banner">
          {summary.overdue > 0 && <span>{summary.counts.overdue} overdue</span>}
          {summary.counts.due > 0 && <span>{summary.counts.due} due now</span>}
          {summary.counts.due_soon > 0 && <span>{summary.counts.due_soon} coming up</span>}
        </div>
      )}

      <div className="sections">
        {sections.map(section => {
          const sectionUrgent = section.items.filter(i =>
            ['due', 'overdue'].includes(i.status.status)
          ).length;
          const sectionSoon = section.items.filter(i =>
            i.status.status === 'due_soon'
          ).length;
          const isOpen = openSections[section.id] ?? false;

          return (
            <div key={section.id} className={`section ${isOpen ? 'open' : ''}`}>
              <button
                className="section-header"
                onClick={() => toggleSection(section.id)}
              >
                <span className="section-label">{section.label}</span>
                <span className="section-badges">
                  {sectionUrgent > 0 && <span className="badge status-due">{sectionUrgent} due</span>}
                  {sectionSoon   > 0 && <span className="badge status-due-soon">{sectionSoon} soon</span>}
                </span>
                <span className="chevron">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="section-items">
                  {section.items.map(item => (
                    <MaintenanceItem
                      key={item.id}
                      bikeId={bike.id}
                      item={item}
                      onLogged={loadStatus}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MaintenanceDashboard() {
  const [bikes,   setBikes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  function fetchBikes() {
    setLoading(true);
    setError(null);
    api.getBikes()
      .then(data => {
        console.log('[MaintenanceDashboard] fetched bikes:', data);
        setBikes(data);
      })
      .catch(err => {
        console.error('[MaintenanceDashboard] failed to fetch bikes:', err.message);
        setError(err.message || 'Could not load bikes from Strava.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchBikes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p className="loading-text">Loading your bikes…</p>;
  if (error) return (
    <div className="bikes-fetch-error">
      <p className="error">{error}</p>
      <button className="btn-pill btn-pill-outline" onClick={fetchBikes}>Retry</button>
    </div>
  );
  if (bikes.length === 0) return (
    <div className="no-bikes">
      <p>No bikes found on your Strava account.</p>
      <p>Add a bike in your <a href="https://www.strava.com/settings/gear" target="_blank" rel="noreferrer">Strava gear settings</a>, then come back.</p>
    </div>
  );

  return (
    <div className="maintenance-dashboard">
      {bikes.map(bike => (
        <BikeCard key={bike.id} bike={bike} />
      ))}
    </div>
  );
}
