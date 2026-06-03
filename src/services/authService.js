const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const usersModel = require('../models/usersModel');
const emailService = require('./emailService');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
const ACCESS_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const RESET_TOKEN_BYTES = Number(process.env.RESET_TOKEN_BYTES) || 32;
const RESET_TOKEN_EXPIRES_MINUTES =
  Number(process.env.RESET_TOKEN_EXPIRES_MINUTES) || 30;

const hashResetToken = (rawToken) =>
  crypto.createHash('sha256').update(rawToken).digest('hex');

const sanitize = (user) => {
  if (!user) return null;
  const {
    password_hash,
    refresh_token,
    reset_token,
    reset_token_expires_at,
    ...publicFields
  } = user;
  return publicFields;
};

const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      type: 'access',
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );

const signRefreshToken = (user) =>
  jwt.sign(
    { sub: user.id, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );

const buildSession = async (user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await usersModel.updateRefreshToken(user.id, refreshToken);

  return {
    user: sanitize(user),
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: ACCESS_EXPIRES_IN,
  };
};

const register = async ({ name, email, password, neighborhood_id }) => {
  const existing = await usersModel.findByEmail(email);
  if (existing) {
    const err = new Error('Email already registered');
    err.code = 'EMAIL_ALREADY_REGISTERED';
    throw err;
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await usersModel.create({
    name,
    email,
    password_hash,
    neighborhood_id,
  });

  return sanitize(user);
};

const login = async (email, password) => {
  const user = await usersModel.findByEmail(email);
  if (!user || !user.is_active) {
    const err = new Error('Invalid credentials');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const err = new Error('Invalid credentials');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  return buildSession(user);
};

const refresh = async (refreshToken) => {
  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
  } catch (err) {
    const e = new Error('Invalid or expired refresh token');
    e.code = 'INVALID_REFRESH_TOKEN';
    throw e;
  }

  if (payload.type !== 'refresh') {
    const err = new Error('Invalid token type');
    err.code = 'INVALID_REFRESH_TOKEN';
    throw err;
  }

  const user = await usersModel.findById(payload.sub);
  if (!user || !user.is_active) {
    const err = new Error('User not found or inactive');
    err.code = 'INVALID_REFRESH_TOKEN';
    throw err;
  }

  if (user.refresh_token !== refreshToken) {
    const err = new Error('Refresh token revoked');
    err.code = 'INVALID_REFRESH_TOKEN';
    throw err;
  }

  return buildSession(user);
};

const forgotPassword = async (email) => {
  const user = await usersModel.findByEmail(email);
  if (!user || !user.is_active) {
    return;
  }

  const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
  const hashedToken = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000);

  await usersModel.setResetToken(user.id, hashedToken, expiresAt);

  try {
    await emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token: rawToken,
      expiresInMinutes: RESET_TOKEN_EXPIRES_MINUTES,
    });
  } catch (err) {
    console.error('Failed to send password reset email:', err);
  }
};

const resetPassword = async (rawToken, newPassword) => {
  const hashedToken = hashResetToken(rawToken);
  const user = await usersModel.findByValidResetToken(hashedToken);

  if (!user) {
    const err = new Error('Invalid or expired reset token');
    err.code = 'INVALID_RESET_TOKEN';
    throw err;
  }

  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const updated = await usersModel.applyPasswordReset(user.id, password_hash);

  return sanitize(updated);
};

module.exports = { register, login, refresh, forgotPassword, resetPassword };
