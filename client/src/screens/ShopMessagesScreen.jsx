import { useEffect, useState } from 'react';
import ShopHeader from '../components/ShopHeader';
import { api } from '../api';
import '../styles/shop-theme.css';
import './ShopMessagesScreen.css';

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

export default function ShopMessagesScreen({ onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');

  const [expandedId,    setExpandedId]    = useState(null);
  const [thread,        setThread]        = useState(null); // { conversation, messages }
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText,     setReplyText]     = useState('');
  const [sending,       setSending]       = useState(false);

  useEffect(() => {
    api.getConversations()
      .then(({ conversations }) => setConversations(conversations))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function toggleConversation(id) {
    if (expandedId === id) {
      setExpandedId(null);
      setThread(null);
      return;
    }
    setExpandedId(id);
    setThread(null);
    setReplyText('');
    setThreadLoading(true);
    try {
      const data = await api.getConversation(id);
      setThread(data);
      await api.markConversationRead(id);
      setConversations(prev => prev.map(c => c.id === id ? { ...c, unreadCount: 0 } : c));
    } catch (err) {
      setError(err.message);
    } finally {
      setThreadLoading(false);
    }
  }

  async function handleReply(e) {
    e.preventDefault();
    if (!replyText.trim() || !expandedId) return;
    setSending(true);
    try {
      const { message } = await api.sendMessage(expandedId, replyText.trim());
      setThread(prev => prev ? { ...prev, messages: [...prev.messages, message] } : prev);
      setConversations(prev => prev.map(c => c.id === expandedId
        ? { ...c, lastMessageBody: message.body, lastMessageAt: message.createdAt, lastMessageSenderType: 'shop' }
        : c,
      ));
      setReplyText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="screen shop-screen">
      <ShopHeader onLogout={onLogout} />

      <main className="shop-messages-body">
        <h1 className="shop-messages-heading">Messages</h1>

        {loading && <p className="shop-text-70">Loading…</p>}
        {error && <p className="shop-profile-msg error">{error}</p>}
        {!loading && conversations.length === 0 && (
          <p className="shop-text-70">No conversations yet.</p>
        )}

        <div className="shop-conversation-list">
          {conversations.map(c => (
            <div key={c.id} className="shop-conversation-item">
              <button
                type="button"
                className="shop-conversation-row"
                onClick={() => toggleConversation(c.id)}
              >
                <div className="shop-conversation-info">
                  <div className="shop-conversation-top">
                    <span className="shop-conversation-name">{c.riderName}</span>
                    <span className="shop-conversation-time">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <p className="shop-conversation-preview">
                    {c.lastMessageSenderType === 'shop' ? 'You: ' : ''}
                    {c.lastMessageBody || 'No messages yet'}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="shop-unread-badge">{c.unreadCount}</span>
                )}
              </button>

              {expandedId === c.id && (
                <div className="shop-thread">
                  {threadLoading && <p className="shop-text-70">Loading thread…</p>}
                  {thread && (
                    <>
                      <div className="shop-thread-messages">
                        {thread.messages.map(m => (
                          <div
                            key={m.id}
                            className={`shop-thread-msg ${m.senderType === 'shop' ? 'shop-thread-msg--shop' : 'shop-thread-msg--rider'}`}
                          >
                            {m.body}
                          </div>
                        ))}
                      </div>
                      <form className="shop-thread-reply" onSubmit={handleReply}>
                        <input
                          type="text"
                          className="shop-input-field"
                          placeholder="Type a reply…"
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="shop-thread-send-btn"
                          disabled={sending || !replyText.trim()}
                        >
                          {sending ? '…' : 'Send'}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
