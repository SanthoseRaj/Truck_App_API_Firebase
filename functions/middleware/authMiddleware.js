const jwt = require('jsonwebtoken');
const User = require('../models/User');

const extractBearerToken = (authHeader = '') => {
  const [scheme, ...tokenParts] = authHeader.trim().split(/\s+/);
  if (!/^Bearer$/i.test(scheme) || tokenParts.length === 0) return null;

  return tokenParts.join(' ').trim().replace(/^"+|"+$/g, '');
};

const protect = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization || '');

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, token missing' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Not authorized, user inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, token invalid' });
  }
};

module.exports = { protect };
