import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import './AuthForms.css';
import './StravaLinkScreen.css';

export default function StravaLinkScreen() {
  const navigate = useNavigate();

  function handleEnable(e) {
    e.preventDefault();
    api.connectStrava();
  }

  return (
    <div className="screen auth-screen strava-screen">
      <div className="auth-topbar">
        <img src="/logo.svg" alt="Auxo" className="auth-logo" />
        <button className="auth-back-btn" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <div className="auth-body">
        <div className="strava-badge">
          <span>Strava</span>
        </div>

        <h1 className="section-heading auth-heading">
          Link Your<br /><span className="marker-text">Strava</span>
        </h1>

        <p className="text-muted auth-sub strava-desc">
          Connect your Strava account so Auxo can read your ride mileage and automatically
          track when maintenance is due — no manual logging needed.
        </p>

        <ul className="strava-perms">
          <li><span className="perm-dot" />Read your activity data &amp; mileage</li>
          <li><span className="perm-dot" />Access your bike/gear list</li>
          <li><span className="perm-dot" />We never post or modify your data</li>
        </ul>

        <div className="strava-connect-wrap">
          <img
            src="/btn_strava_connect_with_white_x2.svg"
            alt="Connect with Strava"
            className="strava-connect-btn"
            onClick={handleEnable}
          />
        </div>

        <button
          className="auth-skip-btn"
          onClick={() => navigate('/add-bike')}
        >
          Skip for now — enter mileage manually
        </button>
      </div>
    </div>
  );
}
