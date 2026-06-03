const rateLimit = require('express-rate-limit');

const parseBool = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const buildLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });

const FORGOT_PASSWORD_WINDOW_MS =
  Number(process.env.RATE_LIMIT_FORGOT_PASSWORD_WINDOW_MS) || 15 * 60 * 1000;
const FORGOT_PASSWORD_MAX =
  Number(process.env.RATE_LIMIT_FORGOT_PASSWORD_MAX) || 5;

const RESET_PASSWORD_WINDOW_MS =
  Number(process.env.RATE_LIMIT_RESET_PASSWORD_WINDOW_MS) || 15 * 60 * 1000;
const RESET_PASSWORD_MAX =
  Number(process.env.RATE_LIMIT_RESET_PASSWORD_MAX) || 10;

const RATE_LIMITERS_ENABLED = parseBool(process.env.RATE_LIMITERS_ENABLED, true);

const passthrough = (_req, _res, next) => next();

const forgotPasswordLimiter = RATE_LIMITERS_ENABLED
  ? buildLimiter({
      windowMs: FORGOT_PASSWORD_WINDOW_MS,
      max: FORGOT_PASSWORD_MAX,
      message:
        'Too many password reset requests. Please try again later.',
    })
  : passthrough;

const resetPasswordLimiter = RATE_LIMITERS_ENABLED
  ? buildLimiter({
      windowMs: RESET_PASSWORD_WINDOW_MS,
      max: RESET_PASSWORD_MAX,
      message:
        'Too many password reset attempts. Please try again later.',
    })
  : passthrough;

module.exports = {
  forgotPasswordLimiter,
  resetPasswordLimiter,
};
