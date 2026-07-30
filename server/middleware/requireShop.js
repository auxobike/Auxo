// Middleware: ensure the logged-in user is a shop account.
// account_type is captured in session.user at login/registration time, so no
// DB round trip is needed here — mirrors how the rest of the app trusts the
// cached session.user for auth checks.
function requireShop(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.session.user?.accountType !== 'shop') {
    return res.status(403).json({ error: 'Shop account required' });
  }
  next();
}

module.exports = requireShop;
