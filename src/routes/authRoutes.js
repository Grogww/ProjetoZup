const { Router } = require('express');
const authController = require('../controllers/authController');
const {
  forgotPasswordLimiter,
  resetPasswordLimiter,
} = require('../middlewares/rateLimiters');

const router = Router();

router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/refresh', authController.refresh);
router.post(
  '/auth/forgot-password',
  forgotPasswordLimiter,
  authController.forgotPassword
);
router.post(
  '/auth/reset-password',
  resetPasswordLimiter,
  authController.resetPassword
);

module.exports = router;
