const jwt = require('jsonwebtoken');
const mockAuth = require('./mockAuth');

const auth = (req, res, next) => {
  if (process.env.USE_MOCK_AUTH === 'true') {
    return mockAuth(req, res, next);
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }

  const token = header.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Token not provided' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload.type && payload.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    req.user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = auth;
