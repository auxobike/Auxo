import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShopHeader from '../components/ShopHeader';
import { api } from '../api';
import '../styles/shop-theme.css';
import './ShopDashboardScreen.css';

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  );
}

export default function ShopDashboardScreen({ user, onLogout }) {
  const navigate = useNavigate();
  const [shopName, setShopName] = useState(null);

  useEffect(() => {
    api.getShopProfile()
      .then(({ shop }) => setShopName(shop.name || null))
      .catch(() => {});
  }, []);

  return (
    <div className="screen shop-screen">
      <ShopHeader onLogout={onLogout} />

      <main className="shop-dashboard-body">
        <div className="shop-dashboard-greeting">
          <h1 className="shop-dashboard-heading">{shopName || 'Your Shop'}</h1>
          <p className="shop-text-70">Welcome back{user?.email ? `, ${user.email}` : ''}</p>
        </div>

        <div className="shop-stats-row">
          <div className="shop-card shop-stat-card">
            <CalendarIcon />
            <span className="shop-stat-value">0</span>
            <span className="shop-stat-label">Bookings Today</span>
          </div>
          <div className="shop-card shop-stat-card">
            <CalendarIcon />
            <span className="shop-stat-value">0</span>
            <span className="shop-stat-label">Pending Bookings</span>
          </div>
        </div>

        <div className="shop-quick-actions">
          <span className="shop-input-label">Quick Actions</span>

          <button
            type="button"
            className="shop-btn-outline shop-quick-action-btn"
            disabled
            title="Coming soon"
          >
            View Messages
          </button>

          <button
            type="button"
            className="shop-btn-save shop-quick-action-btn"
            onClick={() => navigate('/shop/profile')}
          >
            Update Profile
          </button>

          <button
            type="button"
            className="shop-btn-outline shop-quick-action-btn"
            disabled
            title="Coming soon"
          >
            See Reviews
          </button>
        </div>
      </main>
    </div>
  );
}
