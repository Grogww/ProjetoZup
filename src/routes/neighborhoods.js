const { Router } = require('express');
const neighborhoodsController = require('../controllers/neighborhoodsController');

const router = Router();

router.get('/neighborhoods', neighborhoodsController.list);
router.get('/neighborhoods/:id', neighborhoodsController.getById);

module.exports = router;
