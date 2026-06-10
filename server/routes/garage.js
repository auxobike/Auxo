const express     = require('express');
const pool        = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// GET /api/garage/wheelsets
router.get('/wheelsets', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  try {
    const { rows } = await pool.query(`
      SELECT
        w.id,
        w.name,
        w.front_miles,
        w.rear_miles,
        w.notes,
        w.created_at,
        front_bw.bike_id AS installed_front_on_bike_id,
        rear_bw.bike_id  AS installed_rear_on_bike_id
      FROM wheelsets w
      LEFT JOIN bike_wheels front_bw
        ON front_bw.front_wheelset_id = w.id AND front_bw.user_id = $1
      LEFT JOIN bike_wheels rear_bw
        ON rear_bw.rear_wheelset_id = w.id AND rear_bw.user_id = $1
      WHERE w.user_id = $1
      ORDER BY w.created_at ASC
    `, [userId]);

    res.json(rows.map(r => ({
      id:                     r.id,
      name:                   r.name,
      frontMiles:             parseFloat(r.front_miles),
      rearMiles:              parseFloat(r.rear_miles),
      notes:                  r.notes,
      createdAt:              r.created_at,
      installedFrontOnBikeId: r.installed_front_on_bike_id || null,
      installedRearOnBikeId:  r.installed_rear_on_bike_id  || null,
    })));
  } catch (err) {
    console.error('[garage/wheelsets GET]', err.message);
    res.status(500).json({ error: 'Failed to fetch wheelsets' });
  }
});

// POST /api/garage/wheelsets
router.post('/wheelsets', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { name, notes } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO wheelsets (user_id, name, notes)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [userId, name.trim(), notes?.trim() || null]);
    const r = rows[0];
    res.json({
      id: r.id, name: r.name, frontMiles: 0, rearMiles: 0,
      notes: r.notes, createdAt: r.created_at,
      installedFrontOnBikeId: null, installedRearOnBikeId: null,
    });
  } catch (err) {
    console.error('[garage/wheelsets POST]', err.message);
    res.status(500).json({ error: 'Failed to create wheelset' });
  }
});

// PUT /api/garage/wheelsets/:id
router.put('/wheelsets/:id', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;
  const { name, notes } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const { rowCount } = await pool.query(`
      UPDATE wheelsets SET name = $1, notes = $2
      WHERE id = $3 AND user_id = $4
    `, [name.trim(), notes?.trim() || null, id, userId]);
    if (rowCount === 0) return res.status(404).json({ error: 'Wheelset not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[garage/wheelsets PUT]', err.message);
    res.status(500).json({ error: 'Failed to update wheelset' });
  }
});

// DELETE /api/garage/wheelsets/:id
router.delete('/wheelsets/:id', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT bike_id FROM bike_wheels
      WHERE user_id = $1 AND (front_wheelset_id = $2 OR rear_wheelset_id = $2)
    `, [userId, id]);
    if (rows.length > 0) {
      return res.status(400).json({ error: 'Wheelset is currently installed — uninstall it first' });
    }
    const { rowCount } = await pool.query(`
      DELETE FROM wheelsets WHERE id = $1 AND user_id = $2
    `, [id, userId]);
    if (rowCount === 0) return res.status(404).json({ error: 'Wheelset not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[garage/wheelsets DELETE]', err.message);
    res.status(500).json({ error: 'Failed to delete wheelset' });
  }
});

// POST /api/garage/install — { bikeId, frontWheelsetId?, rearWheelsetId? }
router.post('/install', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { bikeId, frontWheelsetId, rearWheelsetId } = req.body;
  if (!bikeId) return res.status(400).json({ error: 'bikeId is required' });
  if (!frontWheelsetId && !rearWheelsetId) {
    return res.status(400).json({ error: 'At least one wheelset ID is required' });
  }
  try {
    if (frontWheelsetId && rearWheelsetId) {
      await pool.query(`
        INSERT INTO bike_wheels (bike_id, user_id, front_wheelset_id, rear_wheelset_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (bike_id, user_id) DO UPDATE
          SET front_wheelset_id = $3, rear_wheelset_id = $4
      `, [bikeId, userId, frontWheelsetId, rearWheelsetId]);
    } else if (frontWheelsetId) {
      await pool.query(`
        INSERT INTO bike_wheels (bike_id, user_id, front_wheelset_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (bike_id, user_id) DO UPDATE
          SET front_wheelset_id = $3
      `, [bikeId, userId, frontWheelsetId]);
    } else {
      await pool.query(`
        INSERT INTO bike_wheels (bike_id, user_id, rear_wheelset_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (bike_id, user_id) DO UPDATE
          SET rear_wheelset_id = $3
      `, [bikeId, userId, rearWheelsetId]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[garage/install]', err.message);
    res.status(500).json({ error: 'Failed to install wheelset' });
  }
});

// POST /api/garage/uninstall — { bikeId, position: 'front'|'rear' }
router.post('/uninstall', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { bikeId, position } = req.body;
  if (!bikeId || !['front', 'rear'].includes(position)) {
    return res.status(400).json({ error: 'bikeId and position (front|rear) are required' });
  }
  const col = position === 'front' ? 'front_wheelset_id' : 'rear_wheelset_id';
  try {
    await pool.query(
      `UPDATE bike_wheels SET ${col} = NULL WHERE bike_id = $1 AND user_id = $2`,
      [bikeId, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[garage/uninstall]', err.message);
    res.status(500).json({ error: 'Failed to uninstall wheelset' });
  }
});

// GET /api/garage/bike/:bikeId — wheels currently installed on a specific bike
// Returns front/rear with name and the miles accumulated in that position.
router.get('/bike/:bikeId', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { bikeId } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT
        bw.front_wheelset_id,
        bw.rear_wheelset_id,
        fw.name        AS front_name,
        fw.front_miles AS front_position_miles,
        rw.name        AS rear_name,
        rw.rear_miles  AS rear_position_miles
      FROM bike_wheels bw
      LEFT JOIN wheelsets fw ON fw.id = bw.front_wheelset_id
      LEFT JOIN wheelsets rw ON rw.id = bw.rear_wheelset_id
      WHERE bw.bike_id = $1 AND bw.user_id = $2
    `, [bikeId, userId]);

    if (rows.length === 0) return res.json({ front: null, rear: null });
    const r = rows[0];
    res.json({
      front: r.front_wheelset_id ? { id: r.front_wheelset_id, name: r.front_name, miles: parseFloat(r.front_position_miles) } : null,
      rear:  r.rear_wheelset_id  ? { id: r.rear_wheelset_id,  name: r.rear_name,  miles: parseFloat(r.rear_position_miles)  } : null,
    });
  } catch (err) {
    console.error('[garage/bike GET]', err.message);
    res.status(500).json({ error: 'Failed to fetch bike wheels' });
  }
});

module.exports = router;
