const { Router } = require('express');
const occurrencesController = require('../controllers/occurrencesController');
const auth = require('../middlewares/auth');
const optionalAuth = require('../middlewares/optionalAuth');
const { uploadOccurrenceMedia } = require('../middlewares/upload');

const router = Router();

router.get('/occurrences/nearby', occurrencesController.nearby);
router.get('/occurrences', occurrencesController.list);
router.get('/occurrences/:id', optionalAuth, occurrencesController.getById);
router.post('/occurrences', auth, occurrencesController.create);
router.patch('/occurrences/:id/status', auth, occurrencesController.updateStatus);
router.patch('/occurrences/:id', auth, occurrencesController.update);
router.delete('/occurrences/:id', auth, occurrencesController.remove);

router.get('/occurrences/:id/media', occurrencesController.listMedia);
router.post(
  '/occurrences/:id/media',
  auth,
  uploadOccurrenceMedia,
  occurrencesController.addMedia
);
router.delete(
  '/occurrences/:id/media/:mediaId',
  auth,
  occurrencesController.removeMedia
);

router.get('/occurrences/:id/reopens', occurrencesController.listReopens);
router.post('/occurrences/:id/reopen', auth, occurrencesController.reopen);

router.get('/occurrences/:id/status-history', occurrencesController.listStatusHistory);

module.exports = router;
