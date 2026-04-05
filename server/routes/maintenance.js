const express = require('express');
const axios   = require('axios');

const requireAuth             = require('../middleware/requireAuth');
const RULES                   = require('../data/maintenanceRules');
const { getItemStatus, getBikeSummary } = require('../utils/maintenanceCalculator');
const { getBikeData, setBikeConfig, logService, getServiceHistory, getConfiguredBikeIds, deleteBikeData } = require('../utils/store');
const { findById }            = require('../utils/userStore');

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

const METERS_PER_MILE = 1609.34;

// Fetch current mileage, ride count, and ride hours for a bike from Strava.
// Returns approximations based on the 200 most recent activities.
async function fetchStravaState(bikeId, accessToken) {
  if (!accessToken) {
    throw new Error('No Strava access token in session — user may need to re-link Strava');
  }

  let gearRes, actRes;
  try {
    [gearRes, actRes] = await Promise.all([
      axios.get(`https://www.strava.com/api/v3/gear/${bikeId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      axios.get('https://www.strava.com/api/v3/athlete/activities', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { per_page: 200 },
      }),
    ]);
  } catch (err) {
    const status  = err.response?.status;
    const detail  = err.response?.data?.message || err.message;
    console.error('[fetchStravaState] Strava API error — bikeId=%s status=%s detail=%s', bikeId, status, detail);
    throw new Error(`Strava API error (${status ?? 'network'}): ${detail}`);
  }

  const gear = gearRes.data;
  const bikeActivities = actRes.data.filter(a => a.gear_id === bikeId);

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
    // OEM / unknown pad type means pad material is unknown — show all brake pad items.
    if (item.padType && effectivePadType && effectivePadType !== 'oem' && effectivePadType !== 'unknown' && item.padType !== effectivePadType) return false;
    if (item.brakeType && effectiveBrakeType && item.brakeType !== effectiveBrakeType) return false;
    if (item.tubelessOnly && !bikeData.isTubeless) return false;
    // Rear shock items are only shown for full suspension bikes.
    if (item.suspensionType && bikeData.suspensionType && item.suspensionType !== bikeData.suspensionType) return false;
    // Wire/housing replacement is irrelevant for electronic shifting.
    if (item.mechShiftingOnly && bikeData.shiftingType === 'electronic') return false;
    // Some items are restricted to a specific bike type (e.g. suspension = MTB only).
    if (item.bikeType && item.bikeType !== bikeData.bikeType) return false;
    return true;
  });
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
    const [stravaState, currentUser] = await Promise.all([
      fetchStravaState(bikeId, req.session.access_token),
      req.session.userId ? findById(req.session.userId) : null,
    ]);

    const warnFraction = ((currentUser?.preferences?.warnThreshold ?? 10) / 100);

    const bikeState = {
      currentMileage:   stravaState.currentMileage,
      currentRideCount: stravaState.currentRideCount,
      rideHours:        stravaState.rideHours,
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

    const sections = rules.sections.map(section => ({
      id:    section.id,
      label: section.label,
      items: filterItems(section.items, bikeData).map(item => {
        const existingLog = bikeData.serviceLogs?.[item.id] || null;
        const serviceLog  = existingLog || (baselineItemIds.has(item.id) ? baselineLog : null);
        return {
          ...item,
          serviceLog,
          status: getItemStatus(item, serviceLog, bikeState, {
            warnFraction,
            customInterval: bikeData.customIntervals?.[item.id] ?? null,
          }),
        };
      }),
    })).filter(s => s.items.length > 0);

    const summary = getBikeSummary(sections);

    res.json({
      bikeId,
      bikeType:         bikeData.bikeType,
      bikeLabel:        rules.label,
      gear:             stravaState.gear,
      currentMileage:   Math.round(stravaState.currentMileage),
      currentRideCount: stravaState.currentRideCount,
      chainReplacements: bikeData.chainReplacements || 0,
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
    const { bikeType, brakeType, rimMaterial, padType, isTubeless, suspensionType, shiftingType } = bikeData;
    res.json({ bikeType, brakeType, rimMaterial, padType, isTubeless, suspensionType, shiftingType });
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

// POST /api/maintenance/log/:bikeId/:itemId
// Mark a maintenance item as done. Snapshots current Strava mileage/ride count.
router.post('/log/:bikeId/:itemId', requireAuth, async (req, res) => {
  const { bikeId, itemId } = req.params;
  const { notes, userInterval } = req.body;

  try {
    const [stravaState, bikeData] = await Promise.all([
      fetchStravaState(bikeId, req.session.access_token),
      getBikeData(bikeId),
    ]);

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

    const log = await logService(bikeId, itemId, entry);
    res.json({ success: true, log });
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
        if (item.padType && effectivePadType && effectivePadType !== 'oem' && effectivePadType !== 'unknown' && item.padType !== effectivePadType) return false;
        if (item.brakeType && effectiveBrakeType && item.brakeType !== effectiveBrakeType) return false;
        if (item.suspensionType && bikeData.suspensionType && item.suspensionType !== bikeData.suspensionType) return false;
        if (item.mechShiftingOnly && bikeData.shiftingType === 'electronic') return false;
        if (item.bikeType && item.bikeType !== bikeData.bikeType) return false;
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
    const [bikeIds, currentUser] = await Promise.all([
      getConfiguredBikeIds(),
      req.session.userId ? findById(req.session.userId) : null,
    ]);
    const bikeCount    = bikeIds.length;
    const warnFraction = ((currentUser?.preferences?.warnThreshold ?? 10) / 100);

    // Fetch maintenance status for each configured bike in parallel.
    // We need a Strava token — if the session has one, use it; otherwise skip counts.
    let itemsDue = 0;
    if (req.session.access_token && bikeCount > 0) {
      const results = await Promise.allSettled(
        bikeIds.map(async bikeId => {
          const [bikeData, stravaState] = await Promise.all([
            getBikeData(bikeId),
            fetchStravaState(bikeId, req.session.access_token),
          ]);
          if (!bikeData?.bikeType) return 0;
          const rules = RULES[bikeData.bikeType];
          if (!rules) return 0;

          const bikeState = {
            currentMileage:    stravaState.currentMileage,
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
            for (const item of filterItems(section.items, bikeData)) {
              const existingLog = bikeData.serviceLogs?.[item.id] || null;
              const serviceLog  = existingLog || (baselineItemIds.has(item.id) ? baselineLog : null);
              const { status } = getItemStatus(item, serviceLog, bikeState, {
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

    // Last ride — fetch only the most recent activity
    let lastRide = null;
    if (req.session.access_token) {
      try {
        const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'MountainBikeRide', 'GravelRide']);
        const actRes = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
          headers: { Authorization: `Bearer ${req.session.access_token}` },
          params: { per_page: 10 },
        });
        const latest = actRes.data.find(
          a => RIDE_TYPES.has(a.sport_type) && !a.sport_type.includes('EBike'),
        );
        if (latest?.start_date_local) {
          lastRide = latest.start_date_local.split('T')[0]; // YYYY-MM-DD
        }
      } catch (e) {
        console.error('[summary] last ride fetch error:', e.message);
      }
    }

    res.json({ bikeCount, itemsDue, lastRide });
  } catch (err) {
    console.error('[summary] error:', err.message);
    res.status(500).json({ error: 'Failed to load summary' });
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
