const { Router } = require('express');
const subcategoriesController = require('../controllers/subcategoriesController');

const router = Router();

router.get('/subcategories', subcategoriesController.list);
router.get('/subcategories/:id', subcategoriesController.getById);
router.post('/subcategories', subcategoriesController.create);
router.delete('/subcategories/:id', subcategoriesController.remove);

module.exports = router;
