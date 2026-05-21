const usersService = require('../services/usersService');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const ALLOWED_ROLES = ['citizen', 'agent', 'admin'];

const me = async (req, res, next) => {
  try {
    const user = await usersService.getProfile(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const { name, email, password, avatar_url, neighborhood_id } = req.body || {};
    const patch = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'name must be a non-empty string' });
      }
      if (name.trim().length > 150) {
        return res.status(400).json({ error: 'name must be at most 150 characters' });
      }
      patch.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
        return res.status(400).json({ error: 'email must be valid' });
      }
      if (email.trim().length > 255) {
        return res.status(400).json({ error: 'email must be at most 255 characters' });
      }
      patch.email = email.trim().toLowerCase();
    }

    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({
          error: `password must have at least ${MIN_PASSWORD_LENGTH} characters`,
        });
      }
      patch.password = password;
    }

    if (avatar_url !== undefined) {
      if (avatar_url === null) {
        patch.avatar_url = null;
      } else if (typeof avatar_url !== 'string' || avatar_url.length > 500) {
        return res.status(400).json({ error: 'avatar_url must be a string up to 500 characters' });
      } else {
        patch.avatar_url = avatar_url;
      }
    }

    if (neighborhood_id !== undefined) {
      if (neighborhood_id === null) {
        patch.neighborhood_id = null;
      } else if (!Number.isInteger(neighborhood_id) || neighborhood_id <= 0) {
        return res.status(400).json({ error: 'neighborhood_id must be a positive integer' });
      } else {
        patch.neighborhood_id = neighborhood_id;
      }
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await usersService.updateProfile(req.user.id, patch);
    res.json(updated);
  } catch (err) {
    if (err.code === 'EMAIL_ALREADY_REGISTERED') {
      return res.status(409).json({ error: err.message });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'neighborhood_id does not reference an existing neighborhood' });
    }
    next(err);
  }
};

const list = async (req, res, next) => {
  try {
    const users = await usersService.listUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const user = await usersService.getUserById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

const updateRole = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const { role } = req.body || {};
    if (typeof role !== 'string' || !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        error: `role must be one of: ${ALLOWED_ROLES.join(', ')}`,
      });
    }

    const updated = await usersService.changeRole(id, role);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json(updated);
  } catch (err) {
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Invalid role value' });
    }
    next(err);
  }
};

module.exports = { me, updateMe, list, getById, updateRole };
