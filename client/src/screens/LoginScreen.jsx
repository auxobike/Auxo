import { useNavigate } from 'react-router-dom';
import './LoginScreen.css';

export default function LoginScreen() {
  const navigate = useNavigate();

  return (
    <div className="screen login-screen">
      <div id="api-url" style={{ display: 'none' }}>{import.meta.env.VITE_API_URL}</div>
      {/* Background grain overlay */}
      <div className="login-bg-texture" aria-hidden="true" />

      <div className="login-content">
        {/* Logo block */}
        <div className="login-logo-block">
          <img src="/splash-page-logo.svg" alt="Auxo" className="splash-logo" />
          <p className="login-tagline">Service Tracking for Bike Folks</p>
        </div>

        {/* CTA buttons */}
        <div className="login-actions">
          <button
            className="btn-pill btn-pill-gold"
            onClick={() => navigate('/sign-in')}
          >
            Sign In
          </button>
          <button
            className="btn-pill btn-pill-outline"
            onClick={() => navigate('/create-account')}
          >
            Sign Up
          </button>
        </div>

        <p className="login-fine-print">
          By continuing you agree to our{' '}
          <a href="#terms" className="text-accent">Terms</a> &amp;{' '}
          <a href="#privacy" className="text-accent">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
