const express = require('express');
const axios   = require('axios');

const requireAuth             = require('../middleware/requireAuth');
const RULES                   = require('../data/maintenanceRules');
const { getItemStatus, getBikeSummary } = require('../utils/maintenanceCalculator');
const { getBikeData, setBikeConfig, logService, getServiceHistory, getConfiguredBikeIds, deleteBikeData, getConditionAdjustment } = require('../utils/store');
const { findById }            = require('../utils/userStore');
const pool                    = require('../db');

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

const METERS_PER_MILE = 1609.34;

// Returns a Strava-state-shaped object for bikes without a Strava connection,
// using the mileage the user entered manually at setup time.
function getManualState(bikeData) {
  return {
    gear:             { name: bikeData.bikeName || 'My Bike' },
    currentMileage:   bikeData.manualMileage || 0,
    currentRideCount: 0,
    rideHours:        0,
  };
}

// Fetch current mileage, ride count, and ride hours for a bike from Strava.
//
// prefetchedActivities — optional array already fetched by the caller.
//   When provided, only the gear endpoint is called; the activities list is
//   reused as-is, eliminating redundant Strava calls when processing multiple
//   bikes (e.g. in the summary endpoint).
async function fetchStravaState(bikeId, accessToken, prefetchedActivities = null) {
  if (!accessToken) {
    throw new Error('No Strava access token in session — user may need to re-link Strava');
  }

  let gear, activities;
  try {
    if (prefetchedActivities !== null) {
      // Activities already in hand — only fetch gear details.
      const gearRes = await axios.get(`https://www.strava.com/api/v3/gear/${bikeId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      gear       = gearRes.data;
      activities = prefetchedActivities;
    } else {
      // Single-bike path: fetch gear and activities in parallel.
      const [gearRes, actRes] = await Promise.all([
        axios.get(`https://www.strava.com/api/v3/gear/${bikeId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        axios.get('https://www.strava.com/api/v3/athlete/activities', {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { per_page: 200 },
        }),
      ]);
      gear       = gearRes.data;
      activities = actRes.data;
    }
  } catch (err) {
    const status  = err.response?.status;
    const detail  = err.response?.data?.message || err.message;
    console.error('[fetchStravaState] Strava API error — bikeId=%s status=%s detail=%s', bikeId, status, detail);
    throw new Error(`Strava API error (${status ?? 'network'}): ${detail}`);
  }

  const bikeActivities = activities.filter(a => a.gear_id === bikeId);

  return {
    gear,
    currentMileage:   (gear.distance || 0) / METERS_PER_MILE,
    currentRideCount: bikeActivities.length,
    rideHours:        bikeActivities.reduce((s, a) => s + (a.moving_time || 0), 0) / 3600,
  };
}

// Map user-selected replaced components to maintenance item IDs.
// Items in this map will receive a baseline service log (treated as recently serviced)
// when the bike is first configured, so the maintenance calculator starts from zero.
const COMPONENT_ITEM_MAP = {
  bottom_bracket: [],
  brake_pads:     ['brake_resin_clean', 'brake_resin_check', 'brake_resin_inspect', 'brake_resin_replace',
                   'brake_metal_clean', 'brake_metal_check', 'brake_metal_inspect', 'brake_metal_replace'],
  brake_set:      ['brake_resin_clean', 'brake_resin_check', 'brake_resin_inspect', 'brake_resin_replace',
                   'brake_metal_clean', 'brake_metal_check', 'brake_metal_inspect', 'brake_metal_replace',
                   'rim_brakes_replace', 'hydraulics_bleed', 'mech_brakes_replace'],
  chain:          ['chain_clean', 'chain_check', 'chain_replace'],
  chain_ring:     ['chainring_check', 'chainring_replace'],
  cassette:       ['cassette_replace'],
  drivetrain:     ['chain_clean', 'chain_check', 'chain_replace', 'wire_housing_replace',
                   'cassette_replace', 'chainring_check', 'chainring_replace'],
  fork:           ['fork_pressure', 'fork_lower_service', 'fork_full_service'],
  head_set:       [],
  tires:          ['tires_check', 'sealant_add'],
  suspension:     ['fork_pressure', 'fork_lower_service', 'fork_full_service',
                   'rear_shock_pressure', 'rear_shock_air_service', 'rear_shock_full_service'],
  wheel_set:      ['tires_check'],
};

function getBaselineItemIds(replacedComponents) {
  const ids = new Set();
  for (const comp of (replacedComponents || [])) {
    for (const itemId of (COMPONENT_ITEM_MAP[comp] || [])) {
      ids.add(itemId);
    }
  }
  return ids;
}

// Normalize road/gravel pad types to the values used in maintenance rule items.
// MTB values (resin, metal, oem) pass through unchanged.
const PAD_TYPE_NORM = {
  carbon:        'resin',   // carbon rim pads → resin-style intervals
  cork:          'resin',   // cork/rubber compound → resin-style intervals
  wet_weather:   'resin',   // wet-weather pads → resin-style intervals
  hard_compound: 'metal',   // hard compound → metal-style intervals
  semi_metallic: 'metal',   // semi-metallic → metal-style intervals
  oem:           'metal',   // legacy OEM value (now stored as semi_metallic) → metal intervals
  unknown:       'metal',   // "not sure" → conservative metal-style intervals
};

// Normalize road/gravel brake types to the values used in maintenance rule items.
// MTB values (hydraulic, mechanical) pass through unchanged.
const BRAKE_TYPE_NORM = {
  disc:       'hydraulic', // disc (hydraulic actuation assumed) → hydraulic bleed applies
  cantilever: 'rim',       // cantilever → same maintenance items as rim
};

// Apply per-bike config filters to rules items
function filterItems(items, bikeData) {
  const effectivePadType   = PAD_TYPE_NORM[bikeData.padType]   ?? bikeData.padType;
  const effectiveBrakeType = BRAKE_TYPE_NORM[bikeData.brakeType] ?? bikeData.brakeType;

  return items.filter(item => {
    if (item.padType && effectivePadType && item.padType !== effectivePadType) return false;
    if (item.brakeType && effectiveBrakeType && item.brakeType !== effectiveBrakeType) return false;
    if (item.tubelessOnly && !bikeData.isTubeless) return false;
    // Rear shock items are only shown for full suspension bikes.
    if (item.suspensionType && bikeData.suspensionType && item.suspensionType !== bikeData.suspensionType) return false;
    // Wire/housing replacement is irrelevant for electronic shifting.
    if (item.mechShiftingOnly && bikeData.shiftingType === 'electronic') return false;
    // Some items are restricted to a specific bike type (e.g. suspension = MTB only).
    if (item.bikeType && item.bikeType !== bikeData.bikeType) return false;
    // Chain type: wax users see chain_clean_wax, standard (or unset) see chain_clean.
    if (item.chainType) {
      const bikeChainType = bikeData.chainType || 'standard';
      if (item.chainType !== bikeChainType) return false;
    }
    return true;
  });
}

// Trainer rides reduce wear differently per maintenance section:
//   brake_system / tires → 0 % (no outdoor wear)
//   drivetrain            → 60 % (chain/cassette still wear but less)
//   everything else       → 100 % (no reduction)
const TRAINER_SECTION_MULTIPLIERS = { brake_system: 0, tires: 0, drivetrain: 0.6 };

// Compute the effective mileage for a maintenance section, factoring in both
// condition-based adjustments (wet/muddy multipliers) and trainer deductions.
function sectionMileage(sectionId, rawMileage, conditionAdj, trainerMilesTotal) {
  const base = rawMileage + conditionAdj;
  const multiplier = TRAINER_SECTION_MULTIPLIERS[sectionId];
  if (multiplier !== undefined) {
    // trainerMilesTotal is already included in rawMileage (Strava counts every ride).
    // We subtract the "excess" trainer contribution: (1 - multiplier) * trainerMiles.
    return Math.max(0, base - trainerMilesTotal * (1 - multiplier));
  }
  return base;
}

// Returns true when a maintenance item is tagged wheelTracked in the rule set.
function isWheelTrackedItem(bikeType, itemId) {
  const rules = RULES[bikeType];
  if (!rules) return false;
  for (const section of rules.sections) {
    const item = section.items.find(i => i.id === itemId);
    if (item?.wheelTracked) return true;
  }
  return false;
}

// Query the installed wheelsets for a bike and return their positional mileage
// plus any wheelset service logs for wheelTracked items.
async function getWheelData(bikeId, userId) {
  if (!userId) return { wheelMileage: null, wheelsetServiceLogs: {}, wheelsetIds: [] };

  const { rows } = await pool.query(`
    SELECT
      bw.front_wheelset_id, bw.rear_wheelset_id,
      fw.front_miles,
      rw.rear_miles
    FROM bike_wheels bw
    LEFT JOIN wheelsets fw ON fw.id = bw.front_wheelset_id
    LEFT JOIN wheelsets rw ON rw.id = bw.rear_wheelset_id
    WHERE bw.bike_id = $1 AND bw.user_id = $2
  `, [bikeId, userId]);

  if (rows.length === 0) return { wheelMileage: null, wheelsetServiceLogs: {}, wheelsetIds: [] };

  const row        = rows[0];
  const frontMiles = row.front_wheelset_id ? parseFloat(row.front_miles) : null;
  const rearMiles  = row.rear_wheelset_id  ? parseFloat(row.rear_miles)  : null;
  const wheelMileage = (frontMiles !== null && rearMiles !== null)
    ? Math.max(frontMiles, rearMiles)
    : (frontMiles ?? rearMiles);

  const wheelsetIds = [row.front_wheelset_id, row.rear_wheelset_id].filter(Boolean);
  const wheelsetServiceLogs = {};

  if (wheelsetIds.length > 0) {
    const logRows = await pool.query(`
      SELECT item_id, log FROM wheelset_service_logs
      WHERE wheelset_id = ANY($1) AND user_id = $2
    `, [wheelsetIds, userId]);
    for (const r of logRows.rows) {
      const existing = wheelsetServiceLogs[r.item_id];
      // Keep the most recent log when both wheelsets have different records
      if (!existing || (r.log.lastServiceDate || '') > (existing.lastServiceDate || '')) {
        wheelsetServiceLogs[r.item_id] = r.log;
      }
    }
  }

  return { wheelMileage, wheelsetServiceLogs, wheelsetIds };
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/maintenance/status/:bikeId
// Returns full maintenance status for a bike, including per-item due/ok/overdue state.
router.get('/status/:bikeId', requireAuth, async (req, res) => {
  const { bikeId } = req.params;
  const bikeData   = await getBikeData(bikeId);

  if (!bikeData?.bikeType) {
    return res.status(400).json({ error: 'Bike not configured', needsSetup: true });
  }

  const rules = RULES[bikeData.bikeType];
  if (!rules) return res.status(400).json({ error: 'Unknown bike type' });

  try {
    const userId = req.session.userId;
    const [stravaState, currentUser, wheelData] = await Promise.all([
      req.session.access_token
        ? fetchStravaState(bikeId, req.session.access_token)
        : Promise.resolve(getManualState(bikeData)),
      userId ? findById(userId) : null,
      getWheelData(bikeId, userId),
    ]);
    const { wheelMileage, wheelsetServiceLogs } = wheelData;

    // Use stored effectiveMileageAdj if available; fall back to a live DB query
    // for bikes that haven't been synced yet (e.g. first login after deploy).
    const conditionAdj = bikeData.effectiveMileageAdj != null
      ? bikeData.effectiveMileageAdj
      : req.session.userId ? await getConditionAdjustment(req.session.userId, bikeId) : 0;

    const warnFraction      = ((currentUser?.preferences?.warnThreshold ?? 10) / 100);
    const trainerMilesTotal = bikeData.trainerMilesTotal ?? 0;

    // Base bikeState used for non-mileage triggers (ride count, hours, chain replacements).
    // Per-section mileage is injected below for mileage-based triggers.
    const bikeState = {
      currentMileage:    stravaState.currentMileage + conditionAdj,
      currentRideCount:  stravaState.currentRideCount,
      rideHours:         stravaState.rideHours,
      chainReplacements: bikeData.chainReplacements || 0,
    };

    // Build a synthetic "baseline" service log for components the user marked as
    // recently replaced at setup time. Only applied when no real log exists yet.
    const baselineItemIds = getBaselineItemIds(bikeData.replacedComponents);
    const baselineLog = baselineItemIds.size > 0 ? {
      lastServiceDate:       new Date().toISOString().split('T')[0],
      lastServiceMileage:    Math.round(stravaState.currentMileage),
      lastServiceRideCount:  stravaState.currentRideCount,
      lastServiceHours:      Math.round(stravaState.rideHours * 10) / 10,
      lastChainReplacements: bikeData.chainReplacements || 0,
      baseline: true,
    } : null;

    const sections = rules.sections.map(section => {
      // Apply trainer-adjusted mileage per section so tires/brakes don't
      // accumulate wear from indoor trainer rides.
      const secMileage = sectionMileage(section.id, stravaState.currentMileage, conditionAdj, trainerMilesTotal);
      const secBikeState = secMileage !== bikeState.currentMileage
        ? { ...bikeState, currentMileage: secMileage }
        : bikeState;

      return {
        id:    section.id,
        label: section.label,
        items: filterItems(section.items, bikeData).map(item => {
          // wheelTracked items use wheelset miles as the mileage base and read
          // their service log from wheelset_service_logs so history travels with
          // the wheelset when it moves between bikes.
          const isWheelItem = !!item.wheelTracked;
          const itemMileage = (isWheelItem && wheelMileage !== null) ? wheelMileage : secMileage;
          const itemBikeState = itemMileage !== secBikeState.currentMileage
            ? { ...secBikeState, currentMileage: itemMileage }
            : secBikeState;

          const bikeLog    = bikeData.serviceLogs?.[item.id] || null;
          const wheelLog   = isWheelItem ? (wheelsetServiceLogs[item.id] || null) : null;
          const existingLog = wheelLog || bikeLog;
          const serviceLog  = existingLog || (baselineItemIds.has(item.id) ? baselineLog : null);

          return {
            ...item,
            serviceLog,
            wheelMilesBase: (isWheelItem && wheelMileage !== null) ? Math.round(wheelMileage) : null,
            status: getItemStatus(item, serviceLog, itemBikeState, {
              warnFraction,
              customInterval: bikeData.customIntervals?.[item.id] ?? null,
            }),
          };
        }),
      };
    }).filter(s => s.items.length > 0);

    const summary = getBikeSummary(sections);

    res.json({
      bikeId,
      bikeType:           bikeData.bikeType,
      bikeLabel:          rules.label,
      gear:               stravaState.gear,
      rawMileage:         Math.round(stravaState.currentMileage),
      effectiveMileage:   Math.round(stravaState.currentMileage + conditionAdj),
      trainerMilesTotal:  Math.round(trainerMilesTotal),
      currentRideCount:   stravaState.currentRideCount,
      chainReplacements:  bikeData.chainReplacements || 0,
      summary,
      sections,
    });
  } catch (err) {
    console.error('Maintenance status error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch maintenance status' });
  }
});

// PUT /api/maintenance/bikes/:bikeId/intervals
// Save custom interval overrides for individual maintenance items.
// Body: { intervals: { [itemId]: { value: N, unit: string } } }
// Replaces the entire customIntervals map on the bike record.
router.put('/bikes/:bikeId/intervals', requireAuth, async (req, res) => {
  const { bikeId }    = req.params;
  const { intervals } = req.body;

  if (!intervals || typeof intervals !== 'object') {
    return res.status(400).json({ error: 'intervals object is required' });
  }

  try {
    const updated = await setBikeConfig(bikeId, { customIntervals: intervals });
    res.json({ success: true, customIntervals: updated.customIntervals ?? {} });
  } catch (err) {
    console.error('[intervals] PUT error:', err.message);
    res.status(500).json({ error: 'Failed to save intervals.' });
  }
});

// GET /api/maintenance/bikes/:bikeId/config
// Return the raw stored bikeData so the settings screen can pre-populate.
router.get('/bikes/:bikeId/config', requireAuth, async (req, res) => {
  const { bikeId } = req.params;
  try {
    const bikeData = await getBikeData(bikeId);
    if (!bikeData) return res.json({});
    const { bikeType, brakeType, rimMaterial, padType, isTubeless, suspensionType, shiftingType, chainType } = bikeData;
    res.json({ bikeType, brakeType, rimMaterial, padType, isTubeless, suspensionType, shiftingType, chainType });
  } catch (err) {
    console.error('[maintenance] get config error:', err.message);
    res.status(500).json({ error: 'Failed to load bike config.' });
  }
});

// DELETE /api/maintenance/bikes/:bikeId
// Remove all maintenance data for a bike.
router.delete('/bikes/:bikeId', requireAuth, async (req, res) => {
  const { bikeId } = req.params;
  try {
    await deleteBikeData([bikeId]);
    res.json({ success: true });
  } catch (err) {
    console.error('[maintenance] delete bike error:', err.message);
    res.status(500).json({ error: 'Failed to remove bike data.' });
  }
});

// PUT /api/maintenance/bikes/:bikeId
// Configure a bike. Accepts any subset of config fields and merges them into
// the existing bike record (JSONB merge). Known fields include: bikeType,
// padType, brakeType, rimMaterial, suspensionType, shiftingType, isTubeless,
// replacedComponents, mileageBaselines, mtbServiceIntervals.
router.put('/bikes/:bikeId', requireAuth, async (req, res) => {
  const { bikeId }  = req.params;
  const { bikeType } = req.body;

  if (bikeType && !RULES[bikeType]) {
    return res.status(400).json({ error: `Invalid bikeType. Must be one of: ${Object.keys(RULES).join(', ')}` });
  }

  const updated = await setBikeConfig(bikeId, req.body);
  res.json(updated);
});

// Items that are automatically reset when a parent item is logged.
// Logging a linked item that doesn't apply to this bike type is harmless —
// filterItems will exclude it from the status display.
const LINKED_ITEMS = {
  brake_resin_replace:    ['brake_resin_clean', 'brake_resin_check', 'brake_resin_inspect'],
  brake_metal_replace:    ['brake_metal_clean', 'brake_metal_check', 'brake_metal_inspect'],
  chain_replace:          ['chain_clean', 'chain_clean_wax', 'chain_check'],
  chainring_replace:      ['chainring_check'],
  tires_check:            ['sealant_add'],
  fork_full_service:      ['fork_pressure', 'fork_lower_service'],
  rear_shock_full_service:['rear_shock_pressure', 'rear_shock_air_service'],
};

// POST /api/maintenance/log/:bikeId/:itemId
// Mark a maintenance item as done. Snapshots current Strava mileage/ride count.
// Linked items (see LINKED_ITEMS above) are automatically reset with the same snapshot.
router.post('/log/:bikeId/:itemId', requireAuth, async (req, res) => {
  const { bikeId, itemId } = req.params;
  const { notes, userInterval } = req.body;

  try {
    const bikeData = await getBikeData(bikeId);
    const stravaState = req.session.access_token
      ? await fetchStravaState(bikeId, req.session.access_token)
      : getManualState(bikeData);

    const entry = {
      lastServiceDate:          new Date().toISOString().split('T')[0],
      lastServiceMileage:       Math.round(stravaState.currentMileage),
      lastServiceRideCount:     stravaState.currentRideCount,
      lastServiceHours:         Math.round(stravaState.rideHours * 10) / 10,
      lastChainReplacements:    bikeData?.chainReplacements || 0,
      ...(notes        && { notes }),
      ...(userInterval && { userInterval: Number(userInterval) }),
    };

    // Increment chain replacement counter when the chain is replaced
    if (itemId === 'chain_replace') {
      const newCount = (bikeData?.chainReplacements || 0) + 1;
      await setBikeConfig(bikeId, { chainReplacements: newCount });
    }

    // Log the primary item, then auto-reset any linked items in parallel.
    // Linked items use the same snapshot entry but without notes/userInterval.
    const linkedIds = LINKED_ITEMS[itemId] ?? [];
    const linkedEntry = {
      lastServiceDate:       entry.lastServiceDate,
      lastServiceMileage:    entry.lastServiceMileage,
      lastServiceRideCount:  entry.lastServiceRideCount,
      lastServiceHours:      entry.lastServiceHours,
      lastChainReplacements: entry.lastChainReplacements,
    };

    // Run sequentially — logService does a full read-modify-write of the JSONB
    // row, so parallel calls would race and only the last write would survive.
    const log = await logService(bikeId, itemId, entry);
    for (const id of linkedIds) {
      await logService(bikeId, id, linkedEntry);
    }

    // For wheelTracked items (and their linked items), also write the log to
    // wheelset_service_logs so it travels with the wheelset if it's moved.
    const userId = req.session.userId;
    if (userId && bikeData?.bikeType) {
      const { wheelsetIds } = await getWheelData(bikeId, userId);
      if (wheelsetIds.length > 0) {
        const allLogged = [
          { id: itemId,  e: entry       },
          ...linkedIds.map(id => ({ id, e: linkedEntry })),
        ];
        for (const wheelsetId of wheelsetIds) {
          for (const { id: logItemId, e: logEntry } of allLogged) {
            if (isWheelTrackedItem(bikeData.bikeType, logItemId)) {
              await pool.query(`
                INSERT INTO wheelset_service_logs (wheelset_id, item_id, user_id, log, updated_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (wheelset_id, item_id) DO UPDATE SET log = $4, updated_at = NOW()
              `, [wheelsetId, logItemId, userId, logEntry]);
            }
          }
        }
      }
    }

    res.json({ success: true, log, linkedReset: linkedIds });
  } catch (err) {
    console.error('[log] bikeId=%s itemId=%s error: %s\n%s', bikeId, itemId, err.message, err.stack);
    res.status(500).json({ error: err.message || 'Failed to log service' });
  }
});

// GET /api/maintenance/history/:bikeId/:itemId
router.get('/history/:bikeId/:itemId', requireAuth, async (req, res) => {
  const { bikeId, itemId } = req.params;
  res.json(await getServiceHistory(bikeId, itemId));
});

// GET /api/maintenance/configured
// Returns the IDs of bikes that have been configured with a bikeType (no Strava call needed).
router.get('/configured', requireAuth, async (req, res) => {
  const ids = await getConfiguredBikeIds();
  res.json({ configuredBikeIds: ids, hasConfigured: ids.length > 0 });
});

// GET /api/maintenance/items/:bikeId
// Returns ALL maintenance items for the bike's configured type — no config filtering,
// no Strava call. Used by the service log form so every item is always selectable.
router.get('/items/:bikeId', requireAuth, async (req, res) => {
  const { bikeId } = req.params;
  const bikeData   = await getBikeData(bikeId);

  if (!bikeData?.bikeType) {
    return res.status(400).json({ error: 'Bike not configured', needsSetup: true });
  }

  const rules = RULES[bikeData.bikeType];
  if (!rules) return res.status(400).json({ error: 'Unknown bike type' });

  const sections = rules.sections.map(section => ({
    id:    section.id,
    label: section.label,
    items: section.items
      .filter(item => {
        // Mirror filterItems logic so the service log dropdown matches the bike's config.
        // tubelessOnly is intentionally omitted — users can still log sealant service.
        const effectivePadType   = PAD_TYPE_NORM[bikeData.padType]    ?? bikeData.padType;
        const effectiveBrakeType = BRAKE_TYPE_NORM[bikeData.brakeType] ?? bikeData.brakeType;
        if (item.padType && effectivePadType && item.padType !== effectivePadType) return false;
        if (item.brakeType && effectiveBrakeType && item.brakeType !== effectiveBrakeType) return false;
        if (item.suspensionType && bikeData.suspensionType && item.suspensionType !== bikeData.suspensionType) return false;
        if (item.mechShiftingOnly && bikeData.shiftingType === 'electronic') return false;
        if (item.bikeType && item.bikeType !== bikeData.bikeType) return false;
        if (item.chainType) {
          const bikeChainType = bikeData.chainType || 'standard';
          if (item.chainType !== bikeChainType) return false;
        }
        return true;
      })
      .map(item => ({
        id:      item.id,
        label:   item.label,
        action:  item.action,
        trigger: item.trigger,
      })),
  })).filter(s => s.items.length > 0);

  res.json({
    bikeId,
    bikeType:        bikeData.bikeType,
    sections,
    customIntervals: bikeData.customIntervals ?? {},
  });
});

// GET /api/maintenance/summary
// Returns bikeCount, itemsDue (due+overdue across all bikes), and lastRide date.
// Used by AccountLandingScreen to populate the quick-stats strip.
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const token = req.session.access_token;

    // Round 1 — DB lookups and the single Strava activities fetch all run in parallel.
    // Activities are fetched once here and reused for every bike, eliminating the
    // N-per-bike duplicate fetches that existed before. lastRide is derived from
    // the same payload — no separate sequential fetch needed.
    const [bikeIds, currentUser, actRes] = await Promise.all([
      getConfiguredBikeIds(),
      req.session.userId ? findById(req.session.userId) : null,
      token
        ? axios.get('https://www.strava.com/api/v3/athlete/activities', {
            headers: { Authorization: `Bearer ${token}` },
            params:  { per_page: 200 },
          }).catch(e => { console.error('[summary] activities fetch error:', e.message); return null; })
        : Promise.resolve(null),
    ]);

    const bikeCount      = bikeIds.length;
    const warnFraction   = (currentUser?.preferences?.warnThreshold ?? 10) / 100;
    const allActivities  = actRes?.data || [];

    // Derive lastRide from the activities we already have — no extra Strava call.
    const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'MountainBikeRide', 'GravelRide']);
    const latestRide = allActivities.find(a => RIDE_TYPES.has(a.sport_type));
    const lastRide   = latestRide?.start_date_local?.split('T')[0] || null;

    // Round 2 — per-bike status counts, all parallel.
    // fetchStravaState receives the pre-fetched activities so it only needs to
    // hit Strava for each bike's gear endpoint (one call per bike, not two).
    // Manual users (no token) use stored manualMileage instead of Strava state.
    let itemsDue = 0;
    if (bikeCount > 0) {
      const results = await Promise.allSettled(
        bikeIds.map(async bikeId => {
          const [bikeData, rawStravaState] = await Promise.all([
            getBikeData(bikeId),
            token
              ? fetchStravaState(bikeId, token, allActivities)
              : Promise.resolve(null),
          ]);
          if (!bikeData?.bikeType) return 0;
          const rules = RULES[bikeData.bikeType];
          if (!rules) return 0;
          const stravaState = rawStravaState ?? getManualState(bikeData);
          // Use stored adj; no live DB query needed for the quick summary view.
          const conditionAdj      = bikeData?.effectiveMileageAdj ?? 0;
          const trainerMilesTotal = bikeData?.trainerMilesTotal   ?? 0;

          const bikeState = {
            currentMileage:    stravaState.currentMileage + conditionAdj,
            currentRideCount:  stravaState.currentRideCount,
            rideHours:         stravaState.rideHours,
            chainReplacements: bikeData.chainReplacements || 0,
          };

          const baselineItemIds = getBaselineItemIds(bikeData.replacedComponents);
          const baselineLog = baselineItemIds.size > 0 ? {
            lastServiceDate:       new Date().toISOString().split('T')[0],
            lastServiceMileage:    Math.round(stravaState.currentMileage),
            lastServiceRideCount:  stravaState.currentRideCount,
            lastServiceHours:      Math.round(stravaState.rideHours * 10) / 10,
            lastChainReplacements: bikeData.chainReplacements || 0,
            baseline: true,
          } : null;

          let count = 0;
          for (const section of rules.sections) {
            const secMileage   = sectionMileage(section.id, stravaState.currentMileage, conditionAdj, trainerMilesTotal);
            const secBikeState = secMileage !== bikeState.currentMileage
              ? { ...bikeState, currentMileage: secMileage }
              : bikeState;
            for (const item of filterItems(section.items, bikeData)) {
              const existingLog = bikeData.serviceLogs?.[item.id] || null;
              const serviceLog  = existingLog || (baselineItemIds.has(item.id) ? baselineLog : null);
              const { status } = getItemStatus(item, serviceLog, secBikeState, {
                warnFraction,
                customInterval: bikeData.customIntervals?.[item.id] ?? null,
              });
              if (status === 'due' || status === 'overdue') count++;
            }
          }
          return count;
        }),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') itemsDue += r.value;
      }
    }

    res.json({ bikeCount, itemsDue, lastRide });
  } catch (err) {
    console.error('[summary] error:', err.message);
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

// POST /api/maintenance/reset/:bikeId
// Mark every maintenance item as serviced right now — a full overhaul reset.
// Snapshots current Strava mileage/ride count and writes a single service log
// entry for all items in one JSONB update (avoids N sequential read-modify-writes).
router.post('/reset/:bikeId', requireAuth, async (req, res) => {
  const { bikeId } = req.params;
  const bikeData   = await getBikeData(bikeId);

  if (!bikeData?.bikeType) {
    return res.status(400).json({ error: 'Bike not configured' });
  }

  const rules = RULES[bikeData.bikeType];
  if (!rules) return res.status(400).json({ error: 'Unknown bike type' });

  try {
    const stravaState = req.session.access_token
      ? await fetchStravaState(bikeId, req.session.access_token)
      : getManualState(bikeData);

    const entry = {
      lastServiceDate:         new Date().toISOString().split('T')[0],
      lastServiceMileage:      Math.round(stravaState.currentMileage),
      lastServiceRideCount:    stravaState.currentRideCount,
      lastServiceHours:        Math.round(stravaState.rideHours * 10) / 10,
      lastChainReplacements:   bikeData.chainReplacements || 0,
    };

    // Build a fresh serviceLogs map covering every item in the rule set.
    const serviceLogs = {};
    for (const section of rules.sections) {
      for (const item of section.items) {
        serviceLogs[item.id] = { ...entry };
      }
    }

    // Single JSONB merge — replaces serviceLogs key, leaves all other config intact.
    await setBikeConfig(bikeId, { serviceLogs });
    res.json({ success: true });
  } catch (err) {
    console.error('[reset] bikeId=%s error: %s', bikeId, err.message);
    res.status(500).json({ error: 'Failed to reset service intervals' });
  }
});

// GET /api/maintenance/rules
// Returns the full rule set (used by the frontend to know available bike types)
router.get('/rules', requireAuth, (req, res) => {
  const summary = Object.entries(RULES).map(([key, val]) => ({
    key,
    label: val.label,
    sections: val.sections.map(s => s.label),
  }));
  res.json(summary);
});

module.exports = router;
