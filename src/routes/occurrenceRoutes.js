const { Router } = require('express');
const occurrencesController = require('../controllers/occurrencesController');
const auth = require('../middlewares/auth');
const optionalAuth = require('../middlewares/optionalAuth');

const router = Router();

router.get('/occurrences/nearby', occurrencesController.nearby);
router.get('/occurrences', occurrencesController.list);
router.get('/occurrences/:id', optionalAuth, occurrencesController.getById);
router.post('/occurrences', auth, occurrencesController.create);
router.patch('/occurrences/:id/status', auth, occurrencesController.updateStatus);
router.delete('/occurrences/:id', auth, occurrencesController.remove);

module.exports = router;
