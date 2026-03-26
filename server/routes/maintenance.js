const express = require('express');
const axios   = require('axios');

const requireAuth             = require('../middleware/requireAuth');
const RULES                   = require('../data/maintenanceRules');
const { getItemStatus, getBikeSummary } = require('../utils/maintenanceCalculator');
const { getBikeData, setBikeConfig, logService, getServiceHistory, getConfiguredBikeIds } = require('../utils/store');

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

const METERS_PER_MILE = 1609.34;

// Fetch current mileage, ride count, and ride hours for a bike from Strava.
// Returns approximations based on the 200 most recent activities.
async function fetchStravaState(bikeId, accessToken) {
  const [gearRes, actRes] = await Promise.all([
    axios.get(`https://www.strava.com/api/v3/gear/${bikeId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { per_page: 200 },
    }),
  ]);

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

// Apply per-bike config filters to rules items
function filterItems(items, bikeData) {
  return items.filter(item => {
    if (item.padType   && bikeData.padType   && item.padType   !== bikeData.padType)   return false;
    if (item.brakeType && bikeData.brakeType && item.brakeType !== bikeData.brakeType) return false;
    if (item.tubelessOnly && !bikeData.isTubeless) return false;
    return true;
  });
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/maintenance/status/:bikeId
// Returns full maintenance status for a bike, including per-item due/ok/overdue state.
router.get('/status/:bikeId', requireAuth, async (req, res) => {
  const { bikeId } = req.params;
  const bikeData   = getBikeData(bikeId);

  if (!bikeData?.bikeType) {
    return res.status(400).json({ error: 'Bike not configured', needsSetup: true });
  }

  const rules = RULES[bikeData.bikeType];
  if (!rules) return res.status(400).json({ error: 'Unknown bike type' });

  try {
    const stravaState = await fetchStravaState(bikeId, req.session.access_token);

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
          status: getItemStatus(item, serviceLog, bikeState),
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

// PUT /api/maintenance/bikes/:bikeId
// Configure a bike: bikeType, padType, brakeType, isTubeless, replacedComponents
router.put('/bikes/:bikeId', requireAuth, (req, res) => {
  const { bikeId } = req.params;
  const { bikeType, padType, brakeType, isTubeless, replacedComponents } = req.body;

  if (bikeType && !RULES[bikeType]) {
    return res.status(400).json({ error: `Invalid bikeType. Must be one of: ${Object.keys(RULES).join(', ')}` });
  }

  const updated = setBikeConfig(bikeId, { bikeType, padType, brakeType, isTubeless, replacedComponents });
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
      Promise.resolve(getBikeData(bikeId)),
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
      setBikeConfig(bikeId, { chainReplacements: newCount });
    }

    const log = logService(bikeId, itemId, entry);
    res.json({ success: true, log });
  } catch (err) {
    console.error('Log service error:', err.message);
    res.status(500).json({ error: 'Failed to log service' });
  }
});

// GET /api/maintenance/history/:bikeId/:itemId
router.get('/history/:bikeId/:itemId', requireAuth, (req, res) => {
  const { bikeId, itemId } = req.params;
  res.json(getServiceHistory(bikeId, itemId));
});

// GET /api/maintenance/configured
// Returns the IDs of bikes that have been configured with a bikeType (no Strava call needed).
router.get('/configured', requireAuth, (req, res) => {
  const ids = getConfiguredBikeIds();
  res.json({ configuredBikeIds: ids, hasConfigured: ids.length > 0 });
});

// GET /api/maintenance/items/:bikeId
// Returns ALL maintenance items for the bike's configured type — no config filtering,
// no Strava call. Used by the service log form so every item is always selectable.
router.get('/items/:bikeId', requireAuth, (req, res) => {
  const { bikeId } = req.params;
  const bikeData   = getBikeData(bikeId);

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
        // Mirror the padType and brakeType checks from filterItems so the service
        // log dropdown shows only the brake variant that matches this bike's config.
        // tubelessOnly is intentionally omitted — users can still log sealant service.
        if (item.padType   && bikeData.padType   && item.padType   !== bikeData.padType)   return false;
        if (item.brakeType && bikeData.brakeType && item.brakeType !== bikeData.brakeType) return false;
        return true;
      })
      .map(item => ({
        id:     item.id,
        label:  item.label,
        action: item.action,
      })),
  })).filter(s => s.items.length > 0);

  res.json({ bikeId, bikeType: bikeData.bikeType, sections });
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
