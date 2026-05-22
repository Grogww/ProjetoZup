const jwt = require('jsonwebtoken');
const mockAuth = require('./mockAuth');

const optionalAuth = (req, res, next) => {
  if (process.env.USE_MOCK_AUTH === 'true') {
    return mockAuth(req, res, next);
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }

  const token = header.slice(7).trim();
  if (!token) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type && payload.type !== 'access') {
      return next();
    }
    req.user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
  } catch (_err) {
    // Ignora token inválido/expirado: rota é pública, apenas não popula req.user
  }
  return next();
};

module.exports = optionalAuth;
