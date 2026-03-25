import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import './AccountLandingScreen.css';

const ACTIONS = [
  {
    id: 'service-log',
    label: 'Add Service Log',
    icon: '🔧',
    path: '/add-service-log',
    desc: 'Log a maintenance task',
  },
  {
    id: 'quiver',
    label: 'Review Your Quiver',
    icon: '🚲',
    path: '/add-bike',
    desc: 'View all your bikes',
  },
  {
    id: 'book-service',
    label: 'Book Service',
    icon: '📅',
    path: '/book-service',
    desc: 'Find a local shop',
  },
  {
    id: 'profile',
    label: 'Update Profile',
    icon: '👤',
    path: '/profile',
    desc: 'Settings & preferences',
  },
];

export default function AccountLandingScreen({ athlete }) {
  const navigate = useNavigate();
  const firstname = athlete?.firstname || 'Rider';

  return (
    <div className="screen landing-screen">
      <AppHeader />

      <main className="landing-body">
        {/* Greeting */}
        <div className="landing-greeting">
          <p className="landing-welcome-sub text-muted">Welcome back</p>
          <h1 className="landing-yo">
            Yo,&nbsp;{firstname}!
          </h1>
        </div>

        {/* Action grid */}
        <div className="action-grid">
          {ACTIONS.map(action => (
            <button
              key={action.id}
              className="action-card"
              onClick={() => navigate(action.path)}
            >
              <span className="action-icon" aria-hidden="true">{action.icon}</span>
              <span className="action-label">{action.label}</span>
              <span className="action-desc text-muted">{action.desc}</span>
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
