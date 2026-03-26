import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import './AccountLandingScreen.css';

export default function AccountLandingScreen({ athlete, hasConfiguredBikes, onLogout }) {
  const ACTIONS = [
    { id: 'service-log', label: 'Add Service Log',    path: '/add-service-log' },
    { id: 'quiver',      label: 'Review Your Quiver', path: hasConfiguredBikes ? '/maintenance' : '/add-bike' },
    { id: 'book-service',label: 'Book Service',       path: '/book-service' },
    { id: 'profile',     label: 'Update Profile',     path: '/profile' },
  ];
  const navigate = useNavigate();
  const firstname = athlete?.firstname || 'Rider';

  return (
    <div className="screen landing-screen">
      <AppHeader onLogout={onLogout} />

      <main className="landing-body">
        {/* Greeting */}
        <div className="landing-greeting">
          <p className="landing-welcome-sub text-muted">Welcome back</p>
          <h1 className="landing-yo">
            Yo,&nbsp;{firstname}!
          </h1>
        </div>

        {/* Action buttons */}
        <div className="action-buttons">
          {ACTIONS.map(action => (
            <button
              key={action.id}
              className="btn-pill btn-pill-gold action-btn"
              onClick={() => navigate(action.path)}
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Quick stats strip */}
        <div className="landing-stats">
          <div className="stat-pill">
            <span className="stat-label">Bikes</span>
            <span className="stat-value text-accent">—</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-pill">
            <span className="stat-label">Items due</span>
            <span className="stat-value text-accent">—</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-pill">
            <span className="stat-label">Last ride</span>
            <span className="stat-value text-accent">—</span>
          </div>
        </div>
      </main>
    </div>
  );
}
