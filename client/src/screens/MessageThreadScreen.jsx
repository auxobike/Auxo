import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api } from '../api';
import './MessageThreadScreen.css';

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export default function MessageThreadScreen({ onLogout }) {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const bottomRef = useRef(null);

  const [thread,     setThread]     = useState(null); // { conversation, messages }
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [replyText,  setReplyText]  = useState('');
  const [sending,    setSending]    = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getConversation(conversationId)
      .then(data => {
        setThread(data);
        return api.markConversationRead(conversationId);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages?.length]);

  async function handleReply(e) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const { message } = await api.sendMessage(conversationId, replyText.trim());
      setThread(prev => prev ? { ...prev, messages: [...prev.messages, message] } : prev);
      setReplyText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="screen thread-screen">
        <AppHeader onLogout={onLogout} />
        <p className="thread-status">Loading…</p>
      </div>
    );
  }

  if (error && !thread) {
    return (
      <div className="screen thread-screen">
        <AppHeader onLogout={onLogout} />
        <div className="thread-status thread-status--error">
          <p>{error}</p>
          <button className="btn-pill btn-pill-outline" onClick={() => navigate('/messages')}>
            Back to Messages
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen thread-screen">
      <AppHeader onLogout={onLogout} />

      <div className="thread-header">
        <button className="thread-back" onClick={() => navigate('/messages')} aria-label="Back to Messages">
          <BackIcon />
        </button>
        <h1 className="thread-shop-name">{thread.conversation.shopName}</h1>
      </div>

      <div className="thread-messages">
        {thread.messages.map(m => (
          <div
            key={m.id}
            className={`thread-msg ${m.senderType === 'rider' ? 'thread-msg--rider' : 'thread-msg--shop'}`}
          >
            {m.body}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="thread-inline-error">{error}</p>}

      <form className="thread-reply" onSubmit={handleReply}>
        <input
          type="text"
          className="input-field thread-reply-input"
          placeholder="Type a message…"
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
        />
        <button type="submit" className="thread-send-btn" disabled={sending || !replyText.trim()}>
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
