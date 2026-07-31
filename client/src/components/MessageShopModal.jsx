import { useState } from 'react';
import { api } from '../api';
import './MessageShopModal.css';

export default function MessageShopModal({ shopId, shopName, onClose }) {
  const [body,    setBody]    = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  async function handleSend(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.startConversation(shopId, body.trim());
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="msm-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="msm-sheet" onClick={e => e.stopPropagation()}>
        {sent ? (
          <div className="msm-confirm">
            <h2 className="msm-heading">Message Sent</h2>
            <p className="msm-confirm-text">
              Your message to <strong>{shopName}</strong> is on its way. They'll reply through Auxo.
            </p>
            <button className="btn-pill btn-pill-gold msm-done-btn" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="msm-header">
              <h2 className="msm-heading">Message {shopName}</h2>
              <p className="msm-subheading">Send a quick note — they'll get back to you here in Auxo.</p>
            </div>

            <form className="msm-form" onSubmit={handleSend}>
              <textarea
                className="msm-textarea"
                placeholder={`Hi ${shopName}, I'd like to ask about...`}
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={5}
                autoFocus
              />
              {error && <p className="msm-error">{error}</p>}

              <div className="msm-footer">
                <button
                  type="submit"
                  className="btn-pill btn-pill-gold msm-send-btn"
                  disabled={sending || !body.trim()}
                >
                  {sending ? 'Sending…' : 'Send'}
                </button>
                <button type="button" className="msm-cancel-btn" onClick={onClose}>
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
