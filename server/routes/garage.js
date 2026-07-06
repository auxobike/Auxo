const express     = require('express');
const pool        = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// GET /api/garage/wheelsets
// Wheelsets track only wheel/rim miles — tire mileage and tire maintenance
// live entirely under the tires/bike_tires tables below.
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
// name/notes are always updated; frontMiles/rearMiles are optional and, when
// present, overwrite the stored mileage directly (e.g. to set a starting
// mileage for a wheel that predates being tracked in the app).
router.put('/wheelsets/:id', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;
  const { name, notes, frontMiles, rearMiles } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const setClauses = [`name = $1`, `notes = $2`];
  const values      = [name.trim(), notes?.trim() || null];
  let   i           = 3;

  if (frontMiles !== undefined && frontMiles !== null && frontMiles !== '') {
    const n = Number(frontMiles);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'frontMiles must be a non-negative number' });
    setClauses.push(`front_miles = $${i++}`);
    values.push(n);
  }
  if (rearMiles !== undefined && rearMiles !== null && rearMiles !== '') {
    const n = Number(rearMiles);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'rearMiles must be a non-negative number' });
    setClauses.push(`rear_miles = $${i++}`);
    values.push(n);
  }

  values.push(id, userId);
  try {
    const { rowCount } = await pool.query(`
      UPDATE wheelsets SET ${setClauses.join(', ')}
      WHERE id = $${i++} AND user_id = $${i}
    `, values);
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

// ── Tires ────────────────────────────────────────────────────────────────────
// Unlike wheelsets, a tire occupies exactly one position and tracks a single
// mileage total — no separate front/rear miles on the same record.

// GET /api/garage/tires
router.get('/tires', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  try {
    const { rows } = await pool.query(`
      SELECT
        t.id,
        t.name,
        t.notes,
        t.miles,
        t.position,
        t.created_at,
        front_bt.bike_id AS installed_front_on_bike_id,
        rear_bt.bike_id  AS installed_rear_on_bike_id
      FROM tires t
      LEFT JOIN bike_tires front_bt
        ON front_bt.front_tire_id = t.id AND front_bt.user_id = $1
      LEFT JOIN bike_tires rear_bt
        ON rear_bt.rear_tire_id = t.id AND rear_bt.user_id = $1
      WHERE t.user_id = $1
      ORDER BY t.created_at ASC
    `, [userId]);

    res.json(rows.map(r => ({
      id:                     r.id,
      name:                   r.name,
      notes:                  r.notes,
      miles:                  parseFloat(r.miles),
      position:               r.position,
      createdAt:              r.created_at,
      installedFrontOnBikeId: r.installed_front_on_bike_id || null,
      installedRearOnBikeId:  r.installed_rear_on_bike_id  || null,
    })));
  } catch (err) {
    console.error('[garage/tires GET]', err.message);
    res.status(500).json({ error: 'Failed to fetch tires' });
  }
});

// POST /api/garage/tires
router.post('/tires', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { name, notes, miles, position } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  if (!['front', 'rear'].includes(position)) {
    return res.status(400).json({ error: "position must be 'front' or 'rear'" });
  }

  const startMiles = (miles !== undefined && miles !== null && miles !== '') ? Number(miles) : 0;
  if (!Number.isFinite(startMiles) || startMiles < 0) {
    return res.status(400).json({ error: 'miles must be a non-negative number' });
  }

  try {
    const { rows } = await pool.query(`
      INSERT INTO tires (user_id, name, notes, miles, position)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [userId, name.trim(), notes?.trim() || null, startMiles, position]);
    const r = rows[0];
    res.json({
      id:                     r.id,
      name:                   r.name,
      notes:                  r.notes,
      miles:                  parseFloat(r.miles),
      position:               r.position,
      createdAt:              r.created_at,
      installedFrontOnBikeId: null,
      installedRearOnBikeId:  null,
    });
  } catch (err) {
    console.error('[garage/tires POST]', err.message);
    res.status(500).json({ error: 'Failed to create tire' });
  }
});

// PUT /api/garage/tires/:id — update name/notes/miles
router.put('/tires/:id', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;
  const { name, notes, miles } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const setClauses = [`name = $1`, `notes = $2`];
  const values      = [name.trim(), notes?.trim() || null];
  let   i           = 3;

  if (miles !== undefined && miles !== null && miles !== '') {
    const n = Number(miles);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'miles must be a non-negative number' });
    setClauses.push(`miles = $${i++}`);
    values.push(n);
  }

  values.push(id, userId);
  try {
    const { rowCount } = await pool.query(`
      UPDATE tires SET ${setClauses.join(', ')}
      WHERE id = $${i++} AND user_id = $${i}
    `, values);
    if (rowCount === 0) return res.status(404).json({ error: 'Tire not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[garage/tires PUT]', err.message);
    res.status(500).json({ error: 'Failed to update tire' });
  }
});

// DELETE /api/garage/tires/:id
router.delete('/tires/:id', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT bike_id FROM bike_tires
      WHERE user_id = $1 AND (front_tire_id = $2 OR rear_tire_id = $2)
    `, [userId, id]);
    if (rows.length > 0) {
      return res.status(400).json({ error: 'Tire is currently installed — uninstall it first' });
    }
    const { rowCount } = await pool.query(`
      DELETE FROM tires WHERE id = $1 AND user_id = $2
    `, [id, userId]);
    if (rowCount === 0) return res.status(404).json({ error: 'Tire not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[garage/tires DELETE]', err.message);
    res.status(500).json({ error: 'Failed to delete tire' });
  }
});

// POST /api/garage/tires/install — { bikeId, tireId, position: 'front'|'rear' }
router.post('/tires/install', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { bikeId, tireId, position } = req.body;
  if (!bikeId || !tireId || !['front', 'rear'].includes(position)) {
    return res.status(400).json({ error: 'bikeId, tireId, and position (front|rear) are required' });
  }
  const col = position === 'front' ? 'front_tire_id' : 'rear_tire_id';
  try {
    await pool.query(`
      INSERT INTO bike_tires (bike_id, user_id, ${col})
      VALUES ($1, $2, $3)
      ON CONFLICT (bike_id, user_id) DO UPDATE
        SET ${col} = $3
    `, [bikeId, userId, tireId]);
    res.json({ success: true });
  } catch (err) {
    console.error('[garage/tires install]', err.message);
    res.status(500).json({ error: 'Failed to install tire' });
  }
});

// POST /api/garage/tires/uninstall — { bikeId, position: 'front'|'rear' }
router.post('/tires/uninstall', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { bikeId, position } = req.body;
  if (!bikeId || !['front', 'rear'].includes(position)) {
    return res.status(400).json({ error: 'bikeId and position (front|rear) are required' });
  }
  const col = position === 'front' ? 'front_tire_id' : 'rear_tire_id';
  try {
    await pool.query(
      `UPDATE bike_tires SET ${col} = NULL WHERE bike_id = $1 AND user_id = $2`,
      [bikeId, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[garage/tires uninstall]', err.message);
    res.status(500).json({ error: 'Failed to uninstall tire' });
  }
});

module.exports = router;
