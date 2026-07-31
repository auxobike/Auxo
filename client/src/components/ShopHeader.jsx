import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/shop-theme.css';

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

const NAV_ITEMS = [
  { label: 'Dashboard',    path: '/shop/dashboard' },
  { label: 'Messages',     path: '/shop/messages'  },
  { label: 'Shop Profile', path: '/shop/profile'   },
];

export default function ShopHeader({ onLogout }) {
  const navigate = useNavigate();
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
      <header className="shop-app-header">
        <button
          className="shop-header-logo-btn"
          onClick={() => navigate('/shop/dashboard')}
          aria-label="Auxo Shop home"
        >
          <img src="/logo.svg" alt="Auxo Shop" className="shop-header-logo" />
        </button>

        <div className="shop-header-icons">
          <button
            className="shop-icon-btn"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen(v => !v)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </header>

      {open && (
        <div className="shop-nav-backdrop" onClick={close} aria-hidden="true" />
      )}

      <nav className={`shop-nav-drawer${open ? ' shop-nav-drawer--open' : ''}`} aria-label="Shop navigation">
        <ul className="shop-nav-list">
          {NAV_ITEMS.map(({ label, path }) => (
            <li key={path}>
              <button className="shop-nav-item" onClick={() => handleNav(path)}>
                {label}
              </button>
            </li>
          ))}
        </ul>

        <div className="shop-nav-divider" />

        <button className="shop-nav-item shop-nav-item--logout" onClick={handleLogout}>
          Log Out
        </button>
      </nav>
    </>
  );
}
