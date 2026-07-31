import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import '../styles/shop-theme.css';
import './AuthForms.css';

export default function SignInScreen({ onLogin }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isShop = searchParams.get('accountType') === 'shop';
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
      onLogin(data.user, data.stravaLinked, data.athlete);
      if (data.user?.accountType === 'shop') {
        navigate('/shop/dashboard');
      } else if (!data.stravaLinked) {
        navigate('/link-strava');
      } else {
        const { hasConfigured } = await api.getConfiguredBikes();
        navigate(hasConfigured ? '/dashboard' : '/add-bike');
      }
    } catch (err) {
      setError(err.message || 'Sign in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`screen ${isShop ? 'shop-screen shop-auth-screen' : 'auth-screen'}`}>
      <div className={isShop ? 'shop-auth-topbar' : 'auth-topbar'}>
        {isShop ? (
          <img src="/logo.svg" alt="Auxo Shop" className="shop-header-logo" />
        ) : (
          <img src="/logo.svg" alt="Auxo" className="auth-logo" />
        )}
        <button
          className={isShop ? 'shop-auth-back-btn' : 'auth-back-btn'}
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
      </div>

      <div className={isShop ? 'shop-auth-body' : 'auth-body'}>
        <h1 className={isShop ? 'shop-auth-heading' : 'marker-heading auth-heading'}>
          {isShop ? 'Shop Sign In' : 'SIGN IN'}
        </h1>
        <p className={isShop ? 'shop-text-70 shop-auth-sub' : 'text-muted auth-sub'}>
          {isShop ? 'Sign in to manage your shop' : 'Good to have you back'}
        </p>

        <form className={isShop ? 'shop-auth-form' : 'auth-form'} onSubmit={handleSubmit} noValidate>
          <div className={isShop ? 'shop-input-group' : 'input-group'}>
            <label className={isShop ? 'shop-input-label' : 'input-label'} htmlFor="signin-email">
              Email
            </label>
            <input
              id="signin-email"
              name="email"
              type="email"
              className={isShop ? 'shop-input-field' : 'input-field'}
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          <div className={isShop ? 'shop-input-group' : 'input-group'}>
            <label className={isShop ? 'shop-input-label' : 'input-label'} htmlFor="signin-password">
              Password
            </label>
            <input
              id="signin-password"
              name="password"
              type="password"
              className={isShop ? 'shop-input-field' : 'input-field'}
              placeholder="Your password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className={isShop ? 'shop-auth-error' : 'auth-error'}>{error}</p>}

          <button
            type="submit"
            className={isShop ? 'shop-btn-save' : 'btn-pill btn-pill-gold auth-submit'}
            disabled={submitting}
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className={isShop ? 'shop-auth-switch' : 'auth-switch'}>
          Don&apos;t have an account?{' '}
          <button
            className={isShop ? 'shop-auth-link-btn' : 'auth-link-btn'}
            onClick={() => navigate(isShop ? '/shop/register' : '/create-account')}
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}
