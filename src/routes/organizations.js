const { Router } = require('express');
const organizationsController = require('../controllers/organizationsController');

const router = Router();

router.get('/organizations', organizationsController.list);

module.exports = router;
