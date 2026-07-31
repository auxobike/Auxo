const express = require('express');
const pool    = require('../db');
const { findShopByUserId } = require('../utils/shopStore');

const router = express.Router();

// Any logged-in account (rider or shop) — unlike requireAuth, this doesn't
// depend on a Strava token, since messaging isn't Strava data and shop
// accounts never have Strava tokens at all.
function requireUser(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Riders have no dedicated "name" column — fall back to their Strava first/last
// name when linked, otherwise the part of their email before '@'.
function riderDisplayName(email, stravaTokens) {
  const athlete = stravaTokens?.athlete;
  const name = [athlete?.firstname, athlete?.lastname].filter(Boolean).join(' ').trim();
  return name || email.split('@')[0];
}

function mapMessageRow(m) {
  return {
    id:         m.id,
    senderId:   m.sender_id,
    senderType: m.sender_type,
    body:       m.body,
    createdAt:  m.created_at,
    readAt:     m.read_at,
  };
}

// Loads a conversation and verifies the session user is one of its two
// participants — the rider, or the shop account tied to it.
async function resolveParticipant(req, conversationId) {
  const { rows } = await pool.query('SELECT * FROM conversations WHERE id = $1', [conversationId]);
  const conversation = rows[0];
  if (!conversation) return { error: { status: 404, message: 'Conversation not found.' } };

  const isShop = req.session.user?.accountType === 'shop';
  if (isShop) {
    const shop = await findShopByUserId(req.session.userId);
    if (!shop || shop.id !== conversation.shop_id) {
      return { error: { status: 403, message: 'Not a participant in this conversation.' } };
    }
    return { conversation, role: 'shop', shop };
  }

  if (conversation.rider_id !== req.session.userId) {
    return { error: { status: 403, message: 'Not a participant in this conversation.' } };
  }
  return { conversation, role: 'rider' };
}

// GET /api/messages/conversations
router.get('/conversations', requireUser, async (req, res) => {
  const isShop = req.session.user?.accountType === 'shop';

  try {
    if (isShop) {
      const shop = await findShopByUserId(req.session.userId);
      if (!shop) return res.status(403).json({ error: 'Shop not found for this account.' });

      const { rows } = await pool.query(`
        SELECT
          c.id,
          c.rider_id        AS "riderId",
          c.last_message_at AS "lastMessageAt",
          u.email            AS "riderEmail",
          u.strava_tokens    AS "riderStravaTokens",
          lm.body            AS "lastMessageBody",
          lm.sender_type     AS "lastMessageSenderType",
          COALESCE(uc.count, 0)::int AS "unreadCount"
        FROM conversations c
        JOIN users u ON u.id = c.rider_id
        LEFT JOIN LATERAL (
          SELECT body, sender_type FROM messages m
          WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1
        ) lm ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS count FROM messages m
          WHERE m.conversation_id = c.id AND m.sender_type = 'rider' AND m.read_at IS NULL
        ) uc ON true
        WHERE c.shop_id = $1
        ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
      `, [shop.id]);

      return res.json({
        conversations: rows.map(r => ({
          id:                   r.id,
          riderId:               r.riderId,
          riderName:             riderDisplayName(r.riderEmail, r.riderStravaTokens),
          lastMessageAt:         r.lastMessageAt,
          lastMessageBody:       r.lastMessageBody,
          lastMessageSenderType: r.lastMessageSenderType,
          unreadCount:           r.unreadCount,
        })),
      });
    }

    const { rows } = await pool.query(`
      SELECT
        c.id,
        c.shop_id          AS "shopId",
        c.last_message_at  AS "lastMessageAt",
        s.name              AS "shopName",
        lm.body             AS "lastMessageBody",
        lm.sender_type      AS "lastMessageSenderType",
        COALESCE(uc.count, 0)::int AS "unreadCount"
      FROM conversations c
      JOIN shops s ON s.id = c.shop_id
      LEFT JOIN LATERAL (
        SELECT body, sender_type FROM messages m
        WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1
      ) lm ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS count FROM messages m
        WHERE m.conversation_id = c.id AND m.sender_type = 'shop' AND m.read_at IS NULL
      ) uc ON true
      WHERE c.rider_id = $1
      ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
    `, [req.session.userId]);

    res.json({
      conversations: rows.map(r => ({
        id:                   r.id,
        shopId:                r.shopId,
        shopName:              r.shopName,
        lastMessageAt:         r.lastMessageAt,
        lastMessageBody:       r.lastMessageBody,
        lastMessageSenderType: r.lastMessageSenderType,
        unreadCount:           r.unreadCount,
      })),
    });
  } catch (err) {
    console.error('[messages] GET conversations error:', err.message);
    res.status(500).json({ error: 'Failed to load conversations.' });
  }
});

// GET /api/messages/conversations/:id
router.get('/conversations/:id', requireUser, async (req, res) => {
  try {
    const result = await resolveParticipant(req, req.params.id);
    if (result.error) return res.status(result.error.status).json({ error: result.error.message });
    const { conversation } = result;

    const [messagesResult, shopResult, riderResult] = await Promise.all([
      pool.query('SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC', [conversation.id]),
      pool.query('SELECT name FROM shops WHERE id = $1', [conversation.shop_id]),
      pool.query('SELECT email, strava_tokens FROM users WHERE id = $1', [conversation.rider_id]),
    ]);

    const shopRow  = shopResult.rows[0];
    const riderRow = riderResult.rows[0];

    res.json({
      conversation: {
        id:        conversation.id,
        riderId:   conversation.rider_id,
        shopId:    conversation.shop_id,
        shopName:  shopRow?.name ?? null,
        riderName: riderRow ? riderDisplayName(riderRow.email, riderRow.strava_tokens) : null,
      },
      messages: messagesResult.rows.map(mapMessageRow),
    });
  } catch (err) {
    console.error('[messages] GET conversation error:', err.message);
    res.status(500).json({ error: 'Failed to load conversation.' });
  }
});

// POST /api/messages/conversations — rider starts a conversation with a shop.
// Reuses an existing thread with that shop instead of creating a duplicate.
router.post('/conversations', requireUser, async (req, res) => {
  if (req.session.user?.accountType === 'shop') {
    return res.status(403).json({ error: 'Shop accounts cannot start a conversation.' });
  }

  const { shopId, body } = req.body;
  if (!shopId || !body?.trim()) {
    return res.status(400).json({ error: 'shopId and body are required.' });
  }

  try {
    const { rows: shopRows } = await pool.query('SELECT id FROM shops WHERE id = $1', [shopId]);
    if (!shopRows[0]) return res.status(404).json({ error: 'Shop not found.' });

    const { rows: existingRows } = await pool.query(
      'SELECT id FROM conversations WHERE rider_id = $1 AND shop_id = $2',
      [req.session.userId, shopId],
    );

    let conversationId = existingRows[0]?.id;
    if (!conversationId) {
      const { rows: createdRows } = await pool.query(
        'INSERT INTO conversations (rider_id, shop_id) VALUES ($1, $2) RETURNING id',
        [req.session.userId, shopId],
      );
      conversationId = createdRows[0].id;
    }

    const { rows: messageRows } = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, sender_type, body)
       VALUES ($1, $2, 'rider', $3)
       RETURNING *`,
      [conversationId, req.session.userId, body.trim()],
    );
    await pool.query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [conversationId]);

    res.status(201).json({ conversationId, message: mapMessageRow(messageRows[0]) });
  } catch (err) {
    console.error('[messages] POST conversations error:', err.message);
    res.status(500).json({ error: 'Failed to start conversation.' });
  }
});

// POST /api/messages/conversations/:id — send a message in an existing conversation.
router.post('/conversations/:id', requireUser, async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'body is required.' });

  try {
    const result = await resolveParticipant(req, req.params.id);
    if (result.error) return res.status(result.error.status).json({ error: result.error.message });
    const { conversation, role } = result;

    const { rows } = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, sender_type, body)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [conversation.id, req.session.userId, role, body.trim()],
    );
    await pool.query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [conversation.id]);

    res.status(201).json({ message: mapMessageRow(rows[0]) });
  } catch (err) {
    console.error('[messages] POST conversation message error:', err.message);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// PUT /api/messages/conversations/:id/read — mark the OTHER party's messages as read.
router.put('/conversations/:id/read', requireUser, async (req, res) => {
  try {
    const result = await resolveParticipant(req, req.params.id);
    if (result.error) return res.status(result.error.status).json({ error: result.error.message });
    const { conversation, role } = result;

    const otherType = role === 'shop' ? 'rider' : 'shop';
    await pool.query(
      `UPDATE messages SET read_at = NOW()
       WHERE conversation_id = $1 AND sender_type = $2 AND read_at IS NULL`,
      [conversation.id, otherType],
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[messages] PUT read error:', err.message);
    res.status(500).json({ error: 'Failed to mark messages as read.' });
  }
});

module.exports = router;
