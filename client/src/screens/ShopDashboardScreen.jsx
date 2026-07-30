import { useNavigate } from 'react-router-dom';
import ShopHeader from '../components/ShopHeader';
import '../styles/shop-theme.css';
import './ShopDashboardScreen.css';

export default function ShopDashboardScreen({ user, onLogout }) {
  const navigate = useNavigate();

  return (
    <div className="screen shop-screen">
      <ShopHeader onLogout={onLogout} />

      <main className="shop-dashboard-body">
        <h1 className="shop-dashboard-heading">Shop Dashboard</h1>
        <p className="shop-text-70">Welcome, {user?.email}. Auxo Shop is coming soon.</p>

        <button className="shop-btn-outline" onClick={() => navigate('/shop/profile')}>
          Edit Shop Profile
        </button>
      </main>
    </div>
  );
}
