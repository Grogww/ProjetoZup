const bcrypt = require('bcrypt');
const usersModel = require('../models/usersModel');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

const sanitize = (user) => {
  if (!user) return null;
  const {
    password_hash,
    refresh_token,
    reset_token,
    reset_token_expires_at,
    cpf,
    ...publicFields
  } = user;
  return publicFields;
};

const getProfile = async (id) => {
  const user = await usersModel.findById(id);
  return sanitize(user);
};

const listUsers = async () => {
  const users = await usersModel.findAll();
  return users.map(sanitize);
};

const getUserById = async (id) => {
  const user = await usersModel.findById(id);
  return sanitize(user);
};

const updateProfile = async (id, patch) => {
  if (patch.email) {
    const existing = await usersModel.findByEmail(patch.email);
    if (existing && existing.id !== id) {
      const err = new Error('Email already registered');
      err.code = 'EMAIL_ALREADY_REGISTERED';
      throw err;
    }
  }

  const modelPatch = { ...patch };
  if (patch.password) {
    modelPatch.password_hash = await bcrypt.hash(patch.password, SALT_ROUNDS);
    delete modelPatch.password;
  }

  const updated = await usersModel.update(id, modelPatch);
  return sanitize(updated);
};

const changeRole = async (id, role) => {
  const existing = await usersModel.findById(id);
  if (!existing) return null;

  const updated = await usersModel.updateRole(id, role);
  return sanitize(updated);
};

module.exports = {
  getProfile,
  listUsers,
  getUserById,
  updateProfile,
  changeRole,
};
