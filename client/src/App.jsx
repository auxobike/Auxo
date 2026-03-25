import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api } from './api';

import LoginScreen          from './screens/LoginScreen';
import SignInScreen         from './screens/SignInScreen';
import CreateAccountScreen  from './screens/CreateAccountScreen';
import StravaLinkScreen     from './screens/StravaLinkScreen';
import AccountLandingScreen from './screens/AccountLandingScreen';
import AddBikeScreen        from './screens/AddBikeScreen';
import MaintenanceDashboard from './components/MaintenanceDashboard';

import './styles/design-system.css';

// Redirect logged-in + Strava-linked users away from public screens
function RequireGuest({ session, children }) {
  if (session.user && session.stravaLinked) return <Navigate to="/dashboard" replace />;
  return children;
}

// Require a logged-in user (email/password or Strava)
function RequireAuth({ session, children }) {
  if (!session.user && !session.athlete) return <Navigate to="/" replace />;
  return children;
}

// Require Strava to be linked (full access)
function RequireStrava({ session, children }) {
  if (!session.user && !session.athlete) return <Navigate to="/" replace />;
  if (!session.stravaLinked)             return <Navigate to="/link-strava" replace />;
  return children;
}

export default function App() {
  const [session, setSession] = useState({
    user:         null,  // email/password user record
    athlete:      null,  // Strava athlete object
    stravaLinked: false,
  });
  const [bikes,   setBikes]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMe()
      .then(data => {
        if (data.authenticated) {
          setSession({
            user:         data.user,
            athlete:      data.athlete,
            stravaLinked: data.stravaLinked,
          });
          if (data.stravaLinked) {
            return api.getBikes().then(setBikes).catch(() => {});
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Called by SignInScreen after a successful email/password login
  function handleLogin(user, stravaLinked) {
    setSession(prev => ({ ...prev, user, stravaLinked }));
  }

  const handleLogout = async () => {
    await api.logout();
    setSession({ user: null, athlete: null, stravaLinked: false });
    setBikes([]);
  };

  if (loading) {
    return (
      <div style={{
        minHeight:      '100dvh',
        background:     '#2a2800',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontFamily:     "'Bebas Neue', sans-serif",
        fontSize:       '2rem',
        letterSpacing:  '0.1em',
        color:          'rgba(255,255,255,0.4)',
      }}>
        AUXO
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Guest / public ── */}
        <Route
          path="/"
          element={
            <RequireGuest session={session}>
              <LoginScreen />
            </RequireGuest>
          }
        />
        <Route
          path="/sign-in"
          element={
            <RequireGuest session={session}>
              <SignInScreen onLogin={handleLogin} />
            </RequireGuest>
          }
        />
        <Route
          path="/create-account"
          element={
            <RequireGuest session={session}>
              <CreateAccountScreen />
            </RequireGuest>
          }
        />

        {/* ── Strava link — needs email login, not yet Strava-linked ── */}
        <Route
          path="/link-strava"
          element={
            <RequireAuth session={session}>
              <StravaLinkScreen />
            </RequireAuth>
          }
        />

        {/* ── Fully authenticated routes ── */}
        <Route
          path="/dashboard"
          element={
            <RequireStrava session={session}>
              <AccountLandingScreen
                athlete={session.athlete}
                user={session.user}
                onLogout={handleLogout}
              />
            </RequireStrava>
          }
        />
        <Route
          path="/add-bike"
          element={
            <RequireStrava session={session}>
              <AddBikeScreen bikes={bikes} />
            </RequireStrava>
          }
        />
        <Route
          path="/maintenance"
          element={
            <RequireStrava session={session}>
              <MaintenanceDashboard />
            </RequireStrava>
          }
        />

        {/* Fallback */}
        <Route
          path="*"
          element={
            <Navigate
              to={session.stravaLinked ? '/dashboard' : session.user ? '/link-strava' : '/'}
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
