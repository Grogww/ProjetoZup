const { Router } = require('express');
const usersController = require('../controllers/usersController');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');

const router = Router();

router.get('/users/me', auth, usersController.me);
router.patch('/users/me', auth, usersController.updateMe);

router.get('/users', auth, requireRole('admin'), usersController.list);
router.get('/users/:id', auth, requireRole('admin'), usersController.getById);
router.patch('/users/:id/role', auth, requireRole('admin'), usersController.updateRole);

module.exports = router;
