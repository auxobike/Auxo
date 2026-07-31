import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api } from '../api';
import './MessagesScreen.css';

function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins   = Math.floor(diffMs / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function MessagesScreen({ onLogout }) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');

  useEffect(() => {
    api.getConversations()
      .then(({ conversations }) => setConversations(conversations))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="screen msgs-screen">
      <AppHeader onLogout={onLogout} />

      <div className="msgs-body">
        <h1 className="msgs-heading">Messages</h1>

        {loading && <p className="msgs-status">Loading…</p>}
        {error && <p className="msgs-status msgs-status--error">{error}</p>}
        {!loading && !error && conversations.length === 0 && (
          <div className="msgs-empty">
            <p className="msgs-status">
              No conversations yet. Message a shop from Book a Service to get started.
            </p>
            <button
              type="button"
              className="btn-pill btn-pill-gold msgs-empty-btn"
              onClick={() => navigate('/book-service')}
            >
              Find a Shop
            </button>
          </div>
        )}

        <div className="msgs-list">
          {conversations.map(c => (
            <button
              key={c.id}
              type="button"
              className="msgs-row"
              onClick={() => navigate(`/messages/${c.id}`)}
            >
              <div className="msgs-row-info">
                <div className="msgs-row-top">
                  <span className="msgs-row-name">{c.shopName}</span>
                  <span className="msgs-row-time">{timeAgo(c.lastMessageAt)}</span>
                </div>
                <p className="msgs-row-preview">
                  {c.lastMessageSenderType === 'rider' ? 'You: ' : ''}
                  {c.lastMessageBody || 'No messages yet'}
                </p>
              </div>
              {c.unreadCount > 0 && (
                <span className="msgs-unread-badge">{c.unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
