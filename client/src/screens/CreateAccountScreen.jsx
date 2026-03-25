import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import './AuthForms.css';

export default function CreateAccountScreen() {
  const navigate = useNavigate();
  const [form,       setForm]       = useState({ email: '', password: '', confirm: '' });
  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.register(form.email, form.password, form.confirm);
      navigate('/link-strava');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen auth-screen">
      {/* Top bar */}
      <div className="auth-topbar">
        <img src="/logo.svg" alt="Auxo" className="auth-logo" />
        <button className="auth-back-btn" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <div className="auth-body">
        <h1 className="marker-heading auth-heading">Welcome</h1>
        <p className="text-muted auth-sub">Create your Auxo account</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="input-group">
            <label className="input-label" htmlFor="email">Email</label>
            <input
              id="email"
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
            <label className="input-label" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="input-field"
              placeholder="At least 8 characters"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="confirm">Confirm Password</label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              className="input-field"
              placeholder="Repeat your password"
              value={form.confirm}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn-pill btn-pill-gold auth-submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{' '}
          <button className="auth-link-btn" onClick={() => navigate('/')}>Sign in</button>
        </p>
      </div>
    </div>
  );
}
