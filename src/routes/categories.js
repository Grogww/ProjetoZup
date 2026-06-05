const { Router } = require('express');
const categoriesController = require('../controllers/categoriesController');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');

const router = Router();

router.get('/categories', categoriesController.list);
router.get('/categories/:id', categoriesController.getById);
router.post('/categories', auth, requireRole('admin'), categoriesController.create);
router.patch('/categories/:id', auth, requireRole('admin'), categoriesController.update);
router.delete('/categories/:id', auth, requireRole('admin'), categoriesController.remove);

module.exports = router;
