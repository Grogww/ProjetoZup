const { Router } = require('express');
const categoriesController = require('../controllers/categoriesController');

const router = Router();

router.get('/categories', categoriesController.list);
router.get('/categories/:id', categoriesController.getById);
router.post('/categories', categoriesController.create);
router.delete('/categories/:id', categoriesController.remove);

module.exports = router;
