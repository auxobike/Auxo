import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import './AuthForms.css';
import './StravaLinkScreen.css';

function StravaLogo() {
  return (
    <svg className="strava-logo-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.037-9.96l2.57 5.116h3.065L10.351 0l-5.15 10.172h3.065" />
    </svg>
  );
}

export default function StravaLinkScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

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
          <StravaLogo />
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

        <form className="auth-form" onSubmit={handleEnable} noValidate>
          <div className="input-group">
            <label className="input-label" htmlFor="strava-email">Your Email</label>
            <input
              id="strava-email"
              type="email"
              className="input-field"
              placeholder="Confirm your email to continue"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-pill btn-pill-gold auth-submit strava-btn">
            <StravaLogo />
            Enable Strava
          </button>
        </form>

        <button
          className="auth-skip-btn"
          onClick={() => navigate('/dashboard')}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
