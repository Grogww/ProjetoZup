const { Router } = require('express');
const subcategoriesController = require('../controllers/subcategoriesController');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');

const router = Router();

router.get('/subcategories', subcategoriesController.list);
router.get('/subcategories/:id', subcategoriesController.getById);
router.post('/subcategories', auth, requireRole('admin'), subcategoriesController.create);
router.patch('/subcategories/:id', auth, requireRole('admin'), subcategoriesController.update);
router.delete('/subcategories/:id', auth, requireRole('admin'), subcategoriesController.remove);

module.exports = router;
