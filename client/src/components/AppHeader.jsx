import { useNavigate } from 'react-router-dom';

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function AppHeader({ onMenuOpen }) {
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <button
        className="header-logo-btn"
        onClick={() => navigate('/dashboard')}
        aria-label="Auxo home"
      >
        <img src="/logo.svg" alt="Auxo" className="header-logo" />
      </button>

      <div className="header-icons">
        <button className="icon-btn" aria-label="Notifications">
          <BellIcon />
        </button>
        <button className="icon-btn" aria-label="Menu" onClick={onMenuOpen}>
          <MenuIcon />
        </button>
      </div>
    </header>
  );
}
