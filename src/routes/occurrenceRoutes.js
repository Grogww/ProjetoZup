const { Router } = require('express');
const occurrencesController = require('../controllers/occurrencesController');
const mockAuth = require('../middlewares/mockAuth');

const router = Router();

router.get('/occurrences/nearby', occurrencesController.nearby);
router.get('/occurrences', occurrencesController.list);
router.get('/occurrences/:id', occurrencesController.getById);
router.post('/occurrences', mockAuth, occurrencesController.create);
router.patch('/occurrences/:id/status', mockAuth, occurrencesController.updateStatus);
router.delete('/occurrences/:id', mockAuth, occurrencesController.remove);

module.exports = router;
