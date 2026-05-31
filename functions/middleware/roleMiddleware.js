const allowRoles = (...roles) => (req, res, next) => {
  const effectiveRole = req.user?.role === 'gate' ? 'port' : req.user?.role;

  if (!req.user || (!roles.includes(req.user.role) && !roles.includes(effectiveRole))) {
    return res.status(403).json({ success: false, message: 'Forbidden: insufficient role access' });
  }
  next();
};

module.exports = { allowRoles };
