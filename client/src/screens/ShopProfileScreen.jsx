import { useEffect, useState } from 'react';
import ShopHeader from '../components/ShopHeader';
import { api } from '../api';
import '../styles/shop-theme.css';
import './ShopProfileScreen.css';

// Placeholder until real review data is wired up (not part of the shops
// table yet — see server/routes/shop.js).
const PLACEHOLDER_RATING = 4.5;

function StarRating({ rating }) {
  return (
    <div className="shop-star-rating" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => {
        const type = rating >= i ? 'full' : rating >= i - 0.5 ? 'half' : 'empty';
        return <span key={i} className={`shop-star shop-star--${type}`}>★</span>;
      })}
    </div>
  );
}

const EMPTY_FORM = {
  name: '', address: '', city: '', state: '', zip: '',
  phoneFront: '', phoneService: '', website: '', bookingMode: 'call',
};

export default function ShopProfileScreen({ onLogout }) {
  const [form,    setForm]    = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState(null);

  useEffect(() => {
    api.getShopProfile()
      .then(({ shop }) => {
        setForm({
          name:         shop.name ?? '',
          address:      shop.address ?? '',
          city:         shop.city ?? '',
          state:        shop.state ?? '',
          zip:          shop.zip ?? '',
          phoneFront:   shop.phoneFront ?? '',
          phoneService: shop.phoneService ?? '',
          website:      shop.website ?? '',
          bookingMode:  shop.bookingMode ?? 'call',
        });
      })
      .catch(err => setMsg({ type: 'error', text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setMsg(null);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.updateShopProfile(form);
      setMsg({ type: 'success', text: 'Profile saved.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="screen shop-screen">
        <ShopHeader onLogout={onLogout} />
        <p className="shop-profile-loading">Loading…</p>
      </div>
    );
  }

  return (
    <div className="screen shop-screen">
      <ShopHeader onLogout={onLogout} />

      <main className="shop-profile-body">
        <h1 className="shop-profile-heading">Shop Profile</h1>

        <div className="shop-profile-rating-row">
          <StarRating rating={PLACEHOLDER_RATING} />
          <span className="shop-profile-rating-num">{PLACEHOLDER_RATING.toFixed(1)}</span>
          <button
            type="button"
            className="shop-btn-outline shop-see-reviews-btn"
            disabled
            title="Coming soon"
          >
            See Reviews
          </button>
        </div>

        <form className="shop-profile-form" onSubmit={handleSave} noValidate>
          <div className="shop-input-group">
            <label className="shop-input-label" htmlFor="shop-name">Shop Name</label>
            <input
              id="shop-name"
              name="name"
              className="shop-input-field"
              value={form.name}
              onChange={handleChange}
            />
          </div>

          <div className="shop-input-group">
            <label className="shop-input-label" htmlFor="shop-address">Street Address</label>
            <input
              id="shop-address"
              name="address"
              className="shop-input-field"
              value={form.address}
              onChange={handleChange}
            />
          </div>

          <div className="shop-input-row">
            <div className="shop-input-group">
              <label className="shop-input-label" htmlFor="shop-city">City</label>
              <input
                id="shop-city"
                name="city"
                className="shop-input-field"
                value={form.city}
                onChange={handleChange}
              />
            </div>
            <div className="shop-input-group shop-input-group--narrow">
              <label className="shop-input-label" htmlFor="shop-state">State</label>
              <input
                id="shop-state"
                name="state"
                className="shop-input-field"
                value={form.state}
                onChange={handleChange}
              />
            </div>
            <div className="shop-input-group shop-input-group--narrow">
              <label className="shop-input-label" htmlFor="shop-zip">Zip</label>
              <input
                id="shop-zip"
                name="zip"
                className="shop-input-field"
                value={form.zip}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="shop-input-group">
            <label className="shop-input-label" htmlFor="shop-phone-front">Phone Number — Front Desk</label>
            <input
              id="shop-phone-front"
              name="phoneFront"
              type="tel"
              className="shop-input-field"
              value={form.phoneFront}
              onChange={handleChange}
            />
          </div>

          <div className="shop-input-group">
            <label className="shop-input-label" htmlFor="shop-phone-service">Phone Number — Service</label>
            <input
              id="shop-phone-service"
              name="phoneService"
              type="tel"
              className="shop-input-field"
              value={form.phoneService}
              onChange={handleChange}
            />
          </div>

          <div className="shop-input-group">
            <label className="shop-input-label" htmlFor="shop-website">Website</label>
            <input
              id="shop-website"
              name="website"
              type="url"
              className="shop-input-field"
              placeholder="https://"
              value={form.website}
              onChange={handleChange}
            />
          </div>

          <div className="shop-input-group">
            <span className="shop-input-label">Booking</span>
            <label className="shop-radio-row">
              <input
                type="radio"
                name="bookingMode"
                value="auxo"
                checked={form.bookingMode === 'auxo'}
                onChange={handleChange}
              />
              AUXO Booking activated
            </label>
            <label className="shop-radio-row">
              <input
                type="radio"
                name="bookingMode"
                value="call"
                checked={form.bookingMode === 'call'}
                onChange={handleChange}
              />
              Call to Book
            </label>
          </div>

          {msg && <p className={`shop-profile-msg ${msg.type}`}>{msg.text}</p>}

          <button type="submit" className="shop-btn-save" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </main>
    </div>
  );
}
