import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api } from '../api';
import './ProfileScreen.css';

const WARN_OPTIONS = [5, 10, 15, 20];

export default function ProfileScreen({ athlete, user, onLogout }) {
  const navigate = useNavigate();

  // ── Change password ──
  const [pwForm, setPwForm]     = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg]       = useState(null); // { type: 'success'|'error', text }
  const [pwSaving, setPwSaving] = useState(false);

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    setPwSaving(true);
    try {
      await api.changePassword(pwForm.current, pwForm.next, pwForm.confirm);
      setPwMsg({ type: 'success', text: 'Password updated.' });
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message });
    } finally {
      setPwSaving(false);
    }
  }

  // ── Notification preference ──
  const [warnThreshold, setWarnThreshold] = useState(
    user?.preferences?.warnThreshold ?? 10,
  );
  const [prefMsg, setPrefMsg]     = useState(null);
  const [prefSaving, setPrefSaving] = useState(false);

  async function handleSavePrefs() {
    setPrefMsg(null);
    setPrefSaving(true);
    try {
      await api.updatePreferences({ warnThreshold });
      setPrefMsg({ type: 'success', text: 'Saved.' });
    } catch (err) {
      setPrefMsg({ type: 'error', text: err.message });
    } finally {
      setPrefSaving(false);
    }
  }

  // ── Delete account ──
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [delMsg, setDelMsg]           = useState(null);

  async function handleDeleteAccount() {
    setDeleting(true);
    setDelMsg(null);
    try {
      await api.deleteAccount();
      await onLogout();
      navigate('/', { replace: true });
    } catch (err) {
      setDelMsg({ type: 'error', text: err.message });
      setDeleting(false);
      setShowConfirm(false);
    }
  }

  const fullName = [athlete?.firstname, athlete?.lastname].filter(Boolean).join(' ');
  const measurementLabel = athlete?.measurement_preference === 'feet'
    ? 'Imperial (miles, feet)'
    : athlete?.measurement_preference === 'meters'
    ? 'Metric (km, meters)'
    : '—';

  return (
    <div className="screen profile-screen">
      <AppHeader onLogout={onLogout} />

      <main className="profile-body">
        <h1 className="profile-heading">Profile</h1>

        {/* ── Strava ── */}
        <section className="profile-section">
          <span className="profile-section-title">Strava</span>

          <div className="profile-athlete">
            {athlete?.profile_medium || athlete?.profile ? (
              <img
                src={athlete.profile_medium || athlete.profile}
                alt="Strava profile"
                className="profile-avatar"
              />
            ) : (
              <div className="profile-avatar-placeholder">
                {athlete?.firstname?.[0] || '?'}
              </div>
            )}
            <div className="profile-athlete-info">
              <span className="profile-athlete-name">{fullName || 'Athlete'}</span>
              {athlete?.username && (
                <span className="profile-athlete-username">@{athlete.username}</span>
              )}
            </div>
          </div>

          <button
            className="btn-pill btn-pill-outline"
            onClick={api.connectStrava}
          >
            Re-link Strava
          </button>
        </section>

        {/* ── Account (email/password users only) ── */}
        {user && (
          <section className="profile-section">
            <span className="profile-section-title">Account</span>

            <div className="profile-info-row">
              <span className="profile-info-label">Email</span>
              <span className="profile-info-value">{user.email}</span>
            </div>

            <form onSubmit={handleChangePassword} style={{ display: 'contents' }}>
              <div className="profile-field">
                <label htmlFor="pw-current">Current password</label>
                <input
                  id="pw-current"
                  type="password"
                  autoComplete="current-password"
                  value={pwForm.current}
                  onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
              <div className="profile-field">
                <label htmlFor="pw-new">New password</label>
                <input
                  id="pw-new"
                  type="password"
                  autoComplete="new-password"
                  value={pwForm.next}
                  onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                  placeholder="Min. 8 characters"
                />
              </div>
              <div className="profile-field">
                <label htmlFor="pw-confirm">Confirm new password</label>
                <input
                  id="pw-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="Repeat new password"
                />
              </div>
              {pwMsg && (
                <p className={`profile-msg ${pwMsg.type}`}>{pwMsg.text}</p>
              )}
              <button
                type="submit"
                className="btn-pill btn-pill-gold"
                disabled={pwSaving || !pwForm.current || !pwForm.next || !pwForm.confirm}
              >
                {pwSaving ? 'Saving…' : 'Change Password'}
              </button>
            </form>
          </section>
        )}

        {/* ── Notification preferences ── */}
        <section className="profile-section">
          <span className="profile-section-title">Notifications</span>

          <div className="profile-pref-row">
            <span className="profile-pref-label">
              Warn me when maintenance is within this % of its interval
            </span>
            <select
              className="profile-pref-select"
              value={warnThreshold}
              onChange={e => {
                setWarnThreshold(Number(e.target.value));
                setPrefMsg(null);
              }}
            >
              {WARN_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}%</option>
              ))}
            </select>
          </div>

          {prefMsg && (
            <p className={`profile-msg ${prefMsg.type}`}>{prefMsg.text}</p>
          )}
          <button
            className="btn-pill btn-pill-gold"
            onClick={handleSavePrefs}
            disabled={prefSaving}
          >
            {prefSaving ? 'Saving…' : 'Save Preferences'}
          </button>
        </section>

        {/* ── Measurement preference ── */}
        <section className="profile-section">
          <span className="profile-section-title">Measurement</span>
          <div className="profile-info-row">
            <span className="profile-info-label">Active preference</span>
            <span className="profile-info-value">{measurementLabel}</span>
          </div>
          <p className="profile-note">
            Measurement preference is set in your Strava account settings and
            reflected here automatically.
          </p>
        </section>

        {/* ── Danger zone ── */}
        <section className="profile-section">
          <span className="profile-section-title">Danger Zone</span>

          {!showConfirm ? (
            <button
              className="profile-danger-btn"
              onClick={() => setShowConfirm(true)}
            >
              Delete Account
            </button>
          ) : (
            <div className="profile-confirm-row">
              <p className="profile-confirm-text">
                This will permanently delete your account and all maintenance data.
                This cannot be undone.
              </p>
              {delMsg && (
                <p className={`profile-msg ${delMsg.type}`}>{delMsg.text}</p>
              )}
              <div className="profile-confirm-actions">
                <button
                  className="profile-confirm-cancel"
                  onClick={() => setShowConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className="profile-confirm-delete"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
