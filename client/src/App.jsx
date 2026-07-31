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
import ProfileScreen             from './screens/ProfileScreen';
import ServiceIntervalsScreen   from './screens/ServiceIntervalsScreen';
import EditBikeSettingsScreen   from './screens/EditBikeSettingsScreen';
import LearnScreen              from './screens/LearnScreen';
import LearnArticleScreen       from './screens/LearnArticleScreen';
import GarageScreen             from './screens/GarageScreen';
import ShopDashboardScreen      from './screens/ShopDashboardScreen';
import ShopProfileScreen        from './screens/ShopProfileScreen';
import ShopRegisterScreen       from './screens/ShopRegisterScreen';
import ShopMessagesScreen       from './screens/ShopMessagesScreen';

import './styles/design-system.css';

// Redirect logged-in users away from public screens
function RequireGuest({ session, configuredBikeIds, children }) {
  if (session.user?.accountType === 'shop') return <Navigate to="/shop/dashboard" replace />;
  if (session.user && session.stravaLinked) return <Navigate to="/dashboard" replace />;
  if (session.user && configuredBikeIds.length > 0) return <Navigate to="/dashboard" replace />;
  if (session.user) return <Navigate to="/link-strava" replace />;
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

// Require a shop account
function RequireShop({ session, children }) {
  if (!session.user) return <Navigate to="/" replace />;
  if (session.user.accountType !== 'shop') return <Navigate to="/dashboard" replace />;
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
  const [configuredBikeIds,  setConfiguredBikeIds]  = useState([]);
  const [summary,            setSummary]            = useState(null);
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
          const fetches = [
            api.getConfiguredBikes()
              .then(({ hasConfigured, configuredBikeIds: ids }) => {
                setHasConfiguredBikes(hasConfigured);
                setConfiguredBikeIds(ids ?? []);
              })
              .catch(() => {}),
          ];
          if (data.stravaLinked) {
            fetches.push(api.getBikes().then(setBikes).catch(() => {}));
            fetches.push(api.getSummary().then(setSummary).catch(() => {}));
          }
          return Promise.all(fetches);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Called by SignInScreen after a successful email/password login.
  // Also re-fetches dashboard data so hasConfiguredBikes and summary are
  // immediately correct — the mount-time useEffect only runs when the user
  // was already authenticated on page load.
  function handleLogin(user, stravaLinked, athlete) {
    setSession(prev => ({ ...prev, user, stravaLinked, athlete: athlete ?? prev.athlete }));
    if (stravaLinked) {
      api.getConfiguredBikes()
        .then(({ hasConfigured, configuredBikeIds: ids }) => {
          setHasConfiguredBikes(hasConfigured);
          setConfiguredBikeIds(ids ?? []);
        })
        .catch(() => {});
      api.getSummary().then(setSummary).catch(() => {});
      api.getBikes().then(setBikes).catch(() => {});
    }
  }

  async function handleRefreshSummary() {
    setSummary(null);
    try {
      const s = await api.getSummary();
      setSummary(s);
    } catch { /* ignore */ }
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
            <RequireGuest session={session} configuredBikeIds={configuredBikeIds}>
              <LoginScreen />
            </RequireGuest>
          }
        />
        <Route
          path="/sign-in"
          element={
            <RequireGuest session={session} configuredBikeIds={configuredBikeIds}>
              <SignInScreen onLogin={handleLogin} />
            </RequireGuest>
          }
        />
        <Route
          path="/create-account"
          element={
            <RequireGuest session={session} configuredBikeIds={configuredBikeIds}>
              <CreateAccountScreen />
            </RequireGuest>
          }
        />
        <Route
          path="/shop/register"
          element={
            <RequireGuest session={session} configuredBikeIds={configuredBikeIds}>
              <ShopRegisterScreen onLogin={handleLogin} />
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
                summary={summary}
                onRefreshSummary={handleRefreshSummary}
              />
            </RequireStrava>
          }
        />
        <Route
          path="/add-bike"
          element={
            <RequireAuth session={session}>
              <AddBikeScreen bikes={bikes} onLogout={handleLogout} stravaLinked={session.stravaLinked} />
            </RequireAuth>
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
            <RequireAuth session={session}>
              <BikeInspector onLogout={handleLogout} />
            </RequireAuth>
          }
        />
        <Route
          path="/maintenance/:bikeId/intervals"
          element={
            <RequireAuth session={session}>
              <ServiceIntervalsScreen onLogout={handleLogout} />
            </RequireAuth>
          }
        />
        <Route
          path="/maintenance/:bikeId/settings"
          element={
            <RequireAuth session={session}>
              <EditBikeSettingsScreen onLogout={handleLogout} />
            </RequireAuth>
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

        <Route
          path="/learn"
          element={
            <RequireStrava session={session}>
              <LearnScreen onLogout={handleLogout} />
            </RequireStrava>
          }
        />
        <Route
          path="/learn/:articleId"
          element={
            <RequireStrava session={session}>
              <LearnArticleScreen onLogout={handleLogout} />
            </RequireStrava>
          }
        />
        <Route
          path="/garage"
          element={
            <RequireAuth session={session}>
              <GarageScreen onLogout={handleLogout} />
            </RequireAuth>
          }
        />

        {/* ── Auxo Shop — bike shop portal ── */}
        <Route
          path="/shop/dashboard"
          element={
            <RequireShop session={session}>
              <ShopDashboardScreen user={session.user} onLogout={handleLogout} />
            </RequireShop>
          }
        />
        <Route
          path="/shop/profile"
          element={
            <RequireShop session={session}>
              <ShopProfileScreen onLogout={handleLogout} />
            </RequireShop>
          }
        />
        <Route
          path="/shop/messages"
          element={
            <RequireShop session={session}>
              <ShopMessagesScreen onLogout={handleLogout} />
            </RequireShop>
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
              to={
                session.user?.accountType === 'shop' ? '/shop/dashboard' :
                session.stravaLinked ? '/dashboard' :
                (session.user && configuredBikeIds.length > 0) ? '/dashboard' :
                session.user ? '/link-strava' :
                '/'
              }
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
