import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import '../styles/shop-theme.css';
import './ShopRegisterScreen.css';

export default function ShopRegisterScreen({ onLogin }) {
  const navigate = useNavigate();
  const [form,       setForm]       = useState({ inviteCode: '', shopName: '', email: '', password: '', confirm: '' });
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
      const data = await api.registerShop(form.inviteCode, form.shopName, form.email, form.password, form.confirm);
      onLogin?.(data.user, false, null);
      navigate('/shop/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen shop-screen shop-auth-screen">
      <div className="shop-auth-topbar">
        <span className="shop-header-logo-text">AUXO SHOP</span>
        <button className="shop-auth-back-btn" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <div className="shop-auth-body">
        <h1 className="shop-auth-heading">Register Your Shop</h1>
        <p className="shop-text-70 shop-auth-sub">Enter your invite code to get started</p>

        <form className="shop-auth-form" onSubmit={handleSubmit} noValidate>
          <div className="shop-input-group">
            <label className="shop-input-label" htmlFor="invite-code">Invite Code</label>
            <input
              id="invite-code"
              name="inviteCode"
              className="shop-input-field"
              placeholder="Enter your invite code"
              value={form.inviteCode}
              onChange={handleChange}
              required
              autoComplete="off"
            />
          </div>

          <div className="shop-input-group">
            <label className="shop-input-label" htmlFor="shop-name">Shop Name</label>
            <input
              id="shop-name"
              name="shopName"
              className="shop-input-field"
              placeholder="Your shop's name"
              value={form.shopName}
              onChange={handleChange}
              required
              autoComplete="organization"
            />
          </div>

          <div className="shop-input-group">
            <label className="shop-input-label" htmlFor="shop-email">Email</label>
            <input
              id="shop-email"
              name="email"
              type="email"
              className="shop-input-field"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          <div className="shop-input-group">
            <label className="shop-input-label" htmlFor="shop-password">Password</label>
            <input
              id="shop-password"
              name="password"
              type="password"
              className="shop-input-field"
              placeholder="At least 8 characters"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="shop-input-group">
            <label className="shop-input-label" htmlFor="shop-confirm">Confirm Password</label>
            <input
              id="shop-confirm"
              name="confirm"
              type="password"
              className="shop-input-field"
              placeholder="Repeat your password"
              value={form.confirm}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </div>

          {error && <p className="shop-auth-error">{error}</p>}

          <button type="submit" className="shop-btn-save" disabled={submitting}>
            {submitting ? 'Creating shop account…' : 'Create Shop Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
