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

// Marker fill colors by boost level
const MARKER_COLOR = {
  partner:  '#c9960c', // gold
  featured: '#128D93', // teal
  organic:  '#c9960c', // gold (default)
};

// Promisified wrapper around PlacesService.getDetails
function fetchPlaceDetails(service, placeId) {
  return new Promise((resolve, reject) => {
    service.getDetails(
      { placeId, fields: ['place_id', 'name', 'geometry', 'rating', 'user_ratings_total', 'vicinity'] },
      (result, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) resolve(result);
        else reject(new Error(status));
      },
    );
  });
}

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

function ShopCard({ place, boostLevel, isSelected, service, onPin }) {
  const [details, setDetails] = useState(null);

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

  const cardClass = [
    'book-card',
    boostLevel === 'partner'  && 'book-card--partner',
    boostLevel === 'featured' && 'book-card--featured',
    isSelected                && 'book-card--selected',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClass} id={`shop-${place.place_id}`}>
      <div className="book-card-header">
        <h2 className="book-card-name">{place.name}</h2>
        <div className="book-card-header-right">
          {boostLevel && (
            <span className={`book-badge book-badge--${boostLevel}`}>
              {boostLevel === 'partner' ? 'Partner' : 'Featured'}
            </span>
          )}
          <button className="book-pin-btn" onClick={() => onPin(place.place_id)} aria-label="Show on map">
            <PinIcon />
          </button>
        </div>
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
            <a href={website} target="_blank" rel="noreferrer" className="book-card-link">
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

      {phone && (
        <button
          className="btn-pill book-contact-btn"
          onClick={() => { window.location.href = `tel:${phone}`; }}
        >
          Contact
        </button>
      )}
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BookServiceScreen({ onLogout }) {
  const mapDivRef       = useRef(null);
  const mapRef          = useRef(null);
  const markersRef      = useRef({});
  const serviceRef      = useRef(null);
  const featuredListRef = useRef([]); // raw list from API, used inside effects

  // phase: 'locating' | 'manual' | 'searching' | 'ready' | 'error'
  const [phase,         setPhase]         = useState('locating');
  const [mapsLoaded,    setMapsLoaded]    = useState(false);
  const [manualQuery,   setManualQuery]   = useState('');
  const [pendingCenter, setPendingCenter] = useState(null);
  const [shops,         setShops]         = useState([]);
  const [selectedPin,   setSelectedPin]   = useState(null);
  const [featuredMap,   setFeaturedMap]   = useState({}); // placeId -> boostLevel
  const [mapMoved,      setMapMoved]      = useState(false);

  // Fetch featured shops list (fire-and-forget — OK if it fails)
  useEffect(() => {
    api.getFeaturedShops()
      .then(list => {
        featuredListRef.current = list;           // store for use in pendingCenter effect
        const map = {};
        list.forEach(s => { map[s.googlePlaceId] = s.boostLevel; });
        setFeaturedMap(map);
      })
      .catch(() => {});
  }, []);

  // Load Maps API on mount
  useEffect(() => {
    loadMapsAPI()
      .then(() => {
        console.log('[BookService] Maps API loaded');
        setMapsLoaded(true);
      })
      .catch(err => {
        console.error('[BookService] Maps API load failed:', err);
        setPhase('error');
      });
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

    setMapMoved(false); // reset whenever a new search kicks off

    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(mapDivRef.current, {
        center:           pendingCenter,
        zoom:             13,
        disableDefaultUI: true,
        zoomControl:      true,
        styles:           DARK_MAP_STYLE,
      });
      // Show "Search This Area" when user pans or zooms
      mapRef.current.addListener('dragend',      () => setMapMoved(true));
      mapRef.current.addListener('zoom_changed', () => setMapMoved(true));
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

    // Capture ref values so the async callbacks below use a consistent snapshot
    const service    = serviceRef.current;
    const featured   = featuredListRef.current;   // [{ googlePlaceId, boostLevel, name }]
    const featMap    = featuredMap;               // placeId -> boostLevel (from state closure)

    console.log('[BookService] running nearbySearch at', pendingCenter);

    service.nearbySearch(
      { location: pendingCenter, radius: 16000, type: 'bicycle_store', keyword: 'bicycle repair shop' },
      async (results, status) => {
        console.log('[BookService] nearbySearch status:', status, '| results:', results?.length ?? 0);

        // Start from whatever the nearby search returned (may be empty)
        const nearbyResults = (status === window.google.maps.places.PlacesServiceStatus.OK && results)
          ? results
          : [];

        // Filter out non-featured shops with irrelevant names
        const EXCLUDE = /electric|e-bike|ebike|scooter|moped/i;
        const filtered = nearbyResults.filter(p =>
          featMap[p.place_id] || !EXCLUDE.test(p.name),
        );

        // Fetch full details for any featured shop not already in the results
        const nearbyIds      = new Set(filtered.map(p => p.place_id));
        const missingFeatured = featured.filter(s => !nearbyIds.has(s.googlePlaceId));

        console.log('[BookService] featured shops missing from nearby:', missingFeatured.map(s => s.googlePlaceId));

        const fetchedDetails = await Promise.all(
          missingFeatured.map(s =>
            fetchPlaceDetails(service, s.googlePlaceId).catch(err => {
              console.warn('[BookService] getDetails failed for', s.googlePlaceId, err.message);
              return null;
            }),
          ),
        );

        const allResults = [...filtered, ...fetchedDetails.filter(Boolean)];

        if (!allResults.length) { setPhase('ready'); return; }

        // Score by rating; featured shops always sort to the top
        const score   = p => (p.rating || 0) + (p.user_ratings_total > 10 ? 0.1 : 0);
        const byScore = (a, b) => score(b) - score(a);
        const boosted = allResults.filter(p =>  featMap[p.place_id]).sort(byScore);
        const organic = allResults.filter(p => !featMap[p.place_id]).sort(byScore);
        const ordered = [...boosted, ...organic];

        ordered.forEach((place, idx) => {
          const boost      = featMap[place.place_id];
          const fillColor  = MARKER_COLOR[boost] || MARKER_COLOR.organic;
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
              path:         window.google.maps.SymbolPath.CIRCLE,
              scale:        14,
              fillColor,
              fillOpacity:  1,
              strokeColor:  '#2D2613',
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

        setShops(ordered);
        setPhase('ready');
      },
    );
  }, [pendingCenter, mapsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleManualSearch(e) {
    e.preventDefault();
    console.log('[BookService] search tapped — query:', manualQuery, '| mapsLoaded:', mapsLoaded, '| phase:', phase);

    if (!manualQuery.trim()) {
      console.log('[BookService] empty query, returning');
      return;
    }
    if (!mapsLoaded) {
      console.log('[BookService] Maps API not loaded yet, returning');
      return;
    }

    const geocoder = new window.google.maps.Geocoder();
    console.log('[BookService] geocoding:', manualQuery);
    geocoder.geocode({ address: manualQuery }, (results, status) => {
      console.log('[BookService] geocode status:', status, '| results:', results?.length ?? 0);
      if (status === 'OK' && results[0]) {
        const loc = results[0].geometry.location;
        const center = { lat: loc.lat(), lng: loc.lng() };
        console.log('[BookService] geocode success — center:', center);
        setPhase('searching');
        setPendingCenter(center);
      } else {
        console.error('[BookService] geocode failed — status:', status);
        setPhase('manual');
      }
    });
  }

  function handleSearchThisArea() {
    if (!mapRef.current) return;
    const c = mapRef.current.getCenter();
    setMapMoved(false);
    setPhase('searching');
    setPendingCenter({ lat: c.lat(), lng: c.lng() });
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
            {mapMoved && phase === 'ready' && (
              <button className="book-search-area-btn" onClick={handleSearchThisArea}>
                Search This Area
              </button>
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
            {shops.map(place => (
              <ShopCard
                key={place.place_id}
                place={place}
                boostLevel={featuredMap[place.place_id] || null}
                isSelected={selectedPin === place.place_id}
                service={serviceRef.current}
                onPin={highlightPin}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
