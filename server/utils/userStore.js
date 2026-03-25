const fs   = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/users.json');

function load() {
  try {
    if (!fs.existsSync(DATA_PATH)) return { users: [] };
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return { users: [] };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function findByEmail(email) {
  const { users } = load();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

function findById(id) {
  const { users } = load();
  return users.find(u => u.id === id) || null;
}

function createUser({ email, passwordHash }) {
  const data = load();
  const user = {
    id:           crypto.randomUUID(),
    email:        email.toLowerCase().trim(),
    passwordHash,
    stravaLinked: false,
    stravaId:     null,
    createdAt:    new Date().toISOString(),
  };
  data.users.push(user);
  save(data);
  return user;
}

function updateUser(id, fields) {
  const data = load();
  const idx  = data.users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  data.users[idx] = { ...data.users[idx], ...fields };
  save(data);
  return data.users[idx];
}

// Return a user object safe to expose to the client (no passwordHash)
function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...pub } = user;
  return pub;
}

module.exports = { findByEmail, findById, createUser, updateUser, publicUser };
