import { useEffect, useRef, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { api } from '../api';
import './BookServiceScreen.css';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const DARK_MAP_STYLE = [
  { elementType: 'geometry',              stylers: [{ color: '#1e1c14' }] },
  { elementType: 'labels.text.stroke',    stylers: [{ color: '#1e1c14' }] },
  { elementType: 'labels.text.fill',      stylers: [{ color: '#8a8068' }] },
  { featureType: 'road',           elementType: 'geometry',        stylers: [{ color: '#2e2a1c' }] },
  { featureType: 'road.arterial',  elementType: 'geometry',        stylers: [{ color: '#3a3520' }] },
  { featureType: 'road',           elementType: 'geometry.stroke', stylers: [{ color: '#1a1710' }] },
  { featureType: 'water',          elementType: 'geometry',        stylers: [{ color: '#0d0c08' }] },
  { featureType: 'poi',            stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',        stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry',        stylers: [{ color: '#4a4530' }] },
];

function loadMapsAPI() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) { resolve(); return; }
    const existing = document.getElementById('gmaps-script');
    if (existing) {
      existing.addEventListener('load', resolve);
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

// ── Sub-components ────────────────────────────────────────────────────────────

function StarRating({ rating }) {
  return (
    <div className="star-rating" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => {
        const type = rating >= i ? 'full' : rating >= i - 0.5 ? 'half' : 'empty';
        return <span key={i} className={`star star--${type}`}>★</span>;
      })}
    </div>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ShopCard({ place, isTop, isSelected, service, onPin, bikes }) {
  const [details,   setDetails]   = useState(null);
  const [bikeId,    setBikeId]    = useState('');
  const [scheduled, setScheduled] = useState(false);

  useEffect(() => {
    if (!service) return;
    service.getDetails(
      {
        placeId: place.place_id,
        fields:  ['website', 'formatted_phone_number', 'formatted_address'],
      },
      (result, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          setDetails(result);
        }
      }
    );
  }, [place.place_id, service]);

  const address = details?.formatted_address || place.vicinity || '';
  const phone   = details?.formatted_phone_number || '';
  const website = details?.website || '';

  let cardClass = 'book-card';
  if (isTop)      cardClass += ' book-card--top';
  if (isSelected) cardClass += ' book-card--selected';

  return (
    <div className={cardClass} id={`shop-${place.place_id}`}>
      <div className="book-card-header">
        <h2 className="book-card-name">{place.name}</h2>
        <button className="book-pin-btn" onClick={() => onPin(place.place_id)} aria-label="Show on map">
          <PinIcon />
        </button>
      </div>

      {place.rating > 0 && (
        <div className="book-card-meta">
          <StarRating rating={place.rating} />
          <span className="book-card-rating-num">{place.rating.toFixed(1)}</span>
          {place.user_ratings_total > 0 && (
            <span className="book-card-review-count">
              ({place.user_ratings_total.toLocaleString()})
            </span>
          )}
        </div>
      )}

      <div className="book-card-details">
        {address && (
          <div className="book-card-detail">
            <span className="book-card-detail-icon">📍</span>
            <span className="book-card-detail-text">{address}</span>
          </div>
        )}
        {website && (
          <div className="book-card-detail">
            <span className="book-card-detail-icon">🌐</span>
            <a
              href={website}
              target="_blank"
              rel="noreferrer"
              className="book-card-link"
            >
              {website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
            </a>
          </div>
        )}
        {phone && (
          <div className="book-card-detail">
            <span className="book-card-detail-icon">📞</span>
            <a href={`tel:${phone}`} className="book-card-link">{phone}</a>
          </div>
        )}
      </div>

      {scheduled ? (
        <div className="book-card-scheduled">
          <CheckIcon />
          Scheduled!
        </div>
      ) : (
        <div className="book-card-actions">
          <select
            className="input-field book-bike-select"
            value={bikeId}
            onChange={e => setBikeId(e.target.value)}
          >
            <option value="">Choose a bike…</option>
            {bikes.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <button
            className="btn-pill btn-pill-gold book-schedule-btn"
            onClick={() => setScheduled(true)}
            disabled={!bikeId}
          >
            Schedule
          </button>
        </div>
      )}
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BookServiceScreen({ onLogout }) {
  const mapDivRef  = useRef(null);
  const mapRef     = useRef(null);
  const markersRef = useRef({});
  const serviceRef = useRef(null);

  // phase: 'locating' | 'manual' | 'searching' | 'ready' | 'error'
  const [phase,         setPhase]         = useState('locating');
  const [mapsLoaded,    setMapsLoaded]    = useState(false);
  const [manualQuery,   setManualQuery]   = useState('');
  const [pendingCenter, setPendingCenter] = useState(null);
  const [shops,         setShops]         = useState([]);
  const [selectedPin,   setSelectedPin]   = useState(null);
  const [bikes,         setBikes]         = useState([]);

  // Load Strava bikes for the dropdown
  useEffect(() => {
    api.getBikes().then(setBikes).catch(() => {});
  }, []);

  // Load Maps API on mount
  useEffect(() => {
    loadMapsAPI()
      .then(() => setMapsLoaded(true))
      .catch(() => setPhase('error'));
  }, []);

  // Request GPS once Maps API is ready
  useEffect(() => {
    if (!mapsLoaded) return;
    if (!navigator.geolocation) { setPhase('manual'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setPhase('searching');
        setPendingCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setPhase('manual'),
      { timeout: 8000 }
    );
  }, [mapsLoaded]);

  // Initialize map + run nearby search whenever a new center is set.
  // Both setPhase('searching') and setPendingCenter are batched, so by the
  // time this effect fires the map div is already in the DOM.
  useEffect(() => {
    if (!pendingCenter || !mapsLoaded || !mapDivRef.current) return;

    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(mapDivRef.current, {
        center:          pendingCenter,
        zoom:            13,
        disableDefaultUI: true,
        zoomControl:     true,
        styles:          DARK_MAP_STYLE,
      });
    } else {
      mapRef.current.setCenter(pendingCenter);
      mapRef.current.setZoom(13);
    }

    // Clear previous markers
    Object.values(markersRef.current).forEach(m => m.setMap(null));
    markersRef.current = {};
    setShops([]);
    setSelectedPin(null);

    serviceRef.current = new window.google.maps.places.PlacesService(mapRef.current);
    serviceRef.current.nearbySearch(
      { location: pendingCenter, radius: 8000, type: 'bicycle_store', keyword: 'bicycle' },
      (results, status) => {
        const ok = status === window.google.maps.places.PlacesServiceStatus.OK;
        const sorted = ok && results?.length
          ? [...results].sort((a, b) => (b.rating || 0) - (a.rating || 0))
          : [];

        sorted.forEach((place, idx) => {
          const marker = new window.google.maps.Marker({
            position: place.geometry.location,
            map:      mapRef.current,
            title:    place.name,
            label: {
              text:       String(idx + 1),
              color:      '#000',
              fontWeight: '700',
              fontSize:   '11px',
            },
            icon: {
              path:        window.google.maps.SymbolPath.CIRCLE,
              scale:       14,
              fillColor:   '#c9960c',
              fillOpacity: 1,
              strokeColor: '#2D2613',
              strokeWeight: 2,
            },
          });
          marker.addListener('click', () => {
            setSelectedPin(place.place_id);
            document.getElementById(`shop-${place.place_id}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          });
          markersRef.current[place.place_id] = marker;
        });

        setShops(sorted);
        setPhase('ready');
      }
    );
  }, [pendingCenter, mapsLoaded]);

  function handleManualSearch(e) {
    e.preventDefault();
    if (!manualQuery.trim() || !mapsLoaded) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: manualQuery }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const loc = results[0].geometry.location;
        setPhase('searching');
        setPendingCenter({ lat: loc.lat(), lng: loc.lng() });
      }
    });
  }

  function highlightPin(placeId) {
    setSelectedPin(placeId);
    const marker = markersRef.current[placeId];
    if (marker && mapRef.current) {
      mapRef.current.panTo(marker.getPosition());
      marker.setAnimation(window.google.maps.Animation.BOUNCE);
      setTimeout(() => marker.setAnimation(null), 1500);
    }
    mapDivRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const showMap = phase === 'searching' || phase === 'ready';

  return (
    <div className="screen book-screen">
      <AppHeader onLogout={onLogout} />

      <div className="book-body">

        {/* ── Heading ── */}
        <div className="book-heading">
          <h1 className="book-heading-main">
            Book a<br />
            <span className="marker-text">SERVICE</span>
          </h1>
          <p className="book-subheading">Search Nearby</p>
        </div>

        {/* ── Location denied — manual entry ── */}
        {phase === 'manual' && (
          <form className="book-location-form" onSubmit={handleManualSearch}>
            <input
              type="text"
              className="input-field"
              placeholder="Enter city or zip code"
              value={manualQuery}
              onChange={e => setManualQuery(e.target.value)}
            />
            <button type="submit" className="btn-pill btn-pill-gold">
              Search
            </button>
          </form>
        )}

        {/* ── Waiting for GPS ── */}
        {phase === 'locating' && (
          <p className="book-status-text">Getting your location…</p>
        )}

        {/* ── Maps API failed ── */}
        {phase === 'error' && (
          <p className="book-status-text book-status-text--error">
            Could not load the map. Please check your connection.
          </p>
        )}

        {/* ── Map ── */}
        {showMap && (
          <div className="book-map-wrap">
            <div ref={mapDivRef} className="book-map" />
            {phase === 'searching' && (
              <div className="book-map-overlay">Finding nearby shops…</div>
            )}
          </div>
        )}

        {/* ── Empty result ── */}
        {phase === 'ready' && shops.length === 0 && (
          <p className="book-status-text">
            No bike shops found nearby. Try a different location.
          </p>
        )}

        {/* ── Shop cards ── */}
        {phase === 'ready' && shops.length > 0 && (
          <div className="book-shops">
            {shops.map((place, idx) => (
              <ShopCard
                key={place.place_id}
                place={place}
                isTop={idx === 0}
                isSelected={selectedPin === place.place_id}
                service={serviceRef.current}
                onPin={highlightPin}
                bikes={bikes}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
