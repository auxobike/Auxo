const fs   = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/maintenance-data.json');

function load() {
  try {
    if (!fs.existsSync(DATA_PATH)) return { bikes: {} };
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return { bikes: {} };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function getBikeData(bikeId) {
  return load().bikes[bikeId] || null;
}

function setBikeConfig(bikeId, config) {
  const data = load();
  data.bikes[bikeId] = { ...(data.bikes[bikeId] || {}), ...config };
  save(data);
  return data.bikes[bikeId];
}

function logService(bikeId, itemId, entry) {
  const data = load();
  const bike = data.bikes[bikeId] = data.bikes[bikeId] || {};
  bike.serviceLogs    = bike.serviceLogs    || {};
  bike.serviceHistory = bike.serviceHistory || {};

  // Current log (latest state)
  bike.serviceLogs[itemId] = { ...(bike.serviceLogs[itemId] || {}), ...entry };

  // Append to history
  bike.serviceHistory[itemId] = bike.serviceHistory[itemId] || [];
  bike.serviceHistory[itemId].push({ ...entry, loggedAt: new Date().toISOString() });

  save(data);
  return bike.serviceLogs[itemId];
}

function getServiceHistory(bikeId, itemId) {
  const bike = getBikeData(bikeId);
  return bike?.serviceHistory?.[itemId] || [];
}

function getConfiguredBikeIds() {
  const data = load();
  return Object.entries(data.bikes)
    .filter(([, bike]) => bike?.bikeType)
    .map(([id]) => id);
}

module.exports = { getBikeData, setBikeConfig, logService, getServiceHistory, getConfiguredBikeIds };
