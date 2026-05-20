const { Router } = require('express');
const authController = require('../controllers/authController');

const router = Router();

router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/refresh', authController.refresh);

module.exports = router;
