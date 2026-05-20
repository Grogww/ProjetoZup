const authService = require('../services/authService');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const register = async (req, res, next) => {
  try {
    const { name, email, password, neighborhood_id } = req.body || {};

    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (name.trim().length > 150) {
      return res.status(400).json({ error: 'name must be at most 150 characters' });
    }
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'email is required and must be valid' });
    }
    if (email.trim().length > 255) {
      return res.status(400).json({ error: 'email must be at most 255 characters' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `password is required and must have at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }
    if (neighborhood_id !== undefined && neighborhood_id !== null) {
      if (!Number.isInteger(neighborhood_id) || neighborhood_id <= 0) {
        return res.status(400).json({ error: 'neighborhood_id must be a positive integer' });
      }
    }

    const user = await authService.register({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      neighborhood_id: neighborhood_id ?? null,
    });

    res.status(201).json(user);
  } catch (err) {
    if (err.code === 'EMAIL_ALREADY_REGISTERED') {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || email.trim().length === 0) {
      return res.status(400).json({ error: 'email is required' });
    }
    if (typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ error: 'password is required' });
    }

    const session = await authService.login(email.trim().toLowerCase(), password);
    res.json(session);
  } catch (err) {
    if (err.code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: err.message });
    }
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refresh_token } = req.body || {};

    if (typeof refresh_token !== 'string' || refresh_token.trim().length === 0) {
      return res.status(400).json({ error: 'refresh_token is required' });
    }

    const session = await authService.refresh(refresh_token);
    res.json(session);
  } catch (err) {
    if (err.code === 'INVALID_REFRESH_TOKEN') {
      return res.status(401).json({ error: err.message });
    }
    next(err);
  }
};

module.exports = { register, login, refresh };
