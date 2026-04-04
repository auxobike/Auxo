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
import BikeInspector        from './screens/BikeInspector';
import AddServiceLogScreen  from './screens/AddServiceLogScreen';
import BookServiceScreen    from './screens/BookServiceScreen';
import AdminShopsScreen    from './screens/AdminShopsScreen';
import ProfileScreen       from './screens/ProfileScreen';

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
  const [bikes,              setBikes]              = useState([]);
  const [hasConfiguredBikes, setHasConfiguredBikes] = useState(false);
  const [loading,            setLoading]            = useState(true);

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
            return Promise.all([
              api.getBikes().then(setBikes).catch(() => {}),
              api.getConfiguredBikes()
                .then(({ hasConfigured }) => setHasConfiguredBikes(hasConfigured))
                .catch(() => {}),
            ]);
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
        background:     '#2D2613',
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
                hasConfiguredBikes={hasConfiguredBikes}
              />
            </RequireStrava>
          }
        />
        <Route
          path="/add-bike"
          element={
            <RequireStrava session={session}>
              <AddBikeScreen bikes={bikes} onLogout={handleLogout} />
            </RequireStrava>
          }
        />
        <Route
          path="/maintenance"
          element={
            <RequireStrava session={session}>
              <MaintenanceDashboard onLogout={handleLogout} />
            </RequireStrava>
          }
        />
        <Route
          path="/maintenance/:bikeId"
          element={
            <RequireStrava session={session}>
              <BikeInspector onLogout={handleLogout} />
            </RequireStrava>
          }
        />
        <Route
          path="/add-service-log"
          element={
            <RequireStrava session={session}>
              <AddServiceLogScreen onLogout={handleLogout} />
            </RequireStrava>
          }
        />

        <Route
          path="/book-service"
          element={
            <RequireStrava session={session}>
              <BookServiceScreen onLogout={handleLogout} />
            </RequireStrava>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireStrava session={session}>
              <ProfileScreen
                athlete={session.athlete}
                user={session.user}
                onLogout={handleLogout}
              />
            </RequireStrava>
          }
        />

        {/* ── Admin — password-protected within the component, no Strava required ── */}
        <Route path="/admin/shops" element={<AdminShopsScreen />} />

        {/* Strava OAuth callback — handled server-side, but this route prevents
            the catch-all below from matching and re-triggering the OAuth flow
            if React Router sees the URL before the server redirect completes. */}
        <Route path="/auth/strava/callback" element={null} />

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
