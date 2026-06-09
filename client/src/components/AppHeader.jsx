import { useState } from 'react';
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

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
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

const NAV_ITEMS = [
  { label: 'Add Service Log',    path: '/add-service-log' },
  { label: 'Review Your Quiver', path: '/maintenance'     },
  { label: 'Garage',             path: '/garage'          },
  { label: 'Book a Service',     path: '/book-service'    },
  { label: 'Learn',              path: '/learn'           },
];

export default function AppHeader({ onLogout }) {
  const navigate  = useNavigate();
  const [open, setOpen] = useState(false);

  function close() { setOpen(false); }

  function handleNav(path) {
    close();
    navigate(path);
  }

  function handleLogout() {
    close();
    onLogout?.();
  }

  return (
    <>
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
          <button
            className="icon-btn"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen(v => !v)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </header>

      {open && (
        <div className="nav-backdrop" onClick={close} aria-hidden="true" />
      )}

      <nav className={`nav-drawer${open ? ' nav-drawer--open' : ''}`} aria-label="Main navigation">
        <ul className="nav-list">
          {NAV_ITEMS.map(({ label, path }) => (
            <li key={path}>
              <button className="nav-item" onClick={() => handleNav(path)}>
                {label}
              </button>
            </li>
          ))}
        </ul>

        <div className="nav-divider" />

        <button className="nav-item nav-item--logout" onClick={handleLogout}>
          Log Out
        </button>
      </nav>
    </>
  );
}
