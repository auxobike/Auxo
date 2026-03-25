import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import './AuthForms.css';

export default function SignInScreen({ onLogin }) {
  const navigate = useNavigate();
  const [form,       setForm]       = useState({ email: '', password: '' });
  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await api.login(form.email, form.password);
      onLogin(data.user, data.stravaLinked);
      if (!data.stravaLinked) {
        navigate('/link-strava');
      } else {
        const { hasConfigured } = await api.getConfiguredBikes();
        navigate(hasConfigured ? '/maintenance' : '/add-bike');
      }
    } catch (err) {
      setError(err.message || 'Sign in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen auth-screen">
      <div className="auth-topbar">
        <img src="/logo.svg" alt="Auxo" className="auth-logo" />
        <button className="auth-back-btn" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <div className="auth-body">
        <h1 className="display-heading auth-heading">SIGN IN</h1>
        <p className="text-muted auth-sub">Good to have you back</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="input-group">
            <label className="input-label" htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              name="email"
              type="email"
              className="input-field"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="signin-password">Password</label>
            <input
              id="signin-password"
              name="password"
              type="password"
              className="input-field"
              placeholder="Your password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn-pill btn-pill-gold auth-submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account?{' '}
          <button className="auth-link-btn" onClick={() => navigate('/create-account')}>
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}
