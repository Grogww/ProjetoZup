const { Router } = require('express');
const evaluationsController = require('../controllers/evaluationsController');
const auth = require('../middlewares/auth');

const router = Router();

router.get('/occurrences/:id/evaluations', auth, evaluationsController.list);
router.post('/occurrences/:id/upvote', auth, evaluationsController.upvote);
router.post('/occurrences/:id/downvote', auth, evaluationsController.downvote);
router.delete('/occurrences/:id/vote', auth, evaluationsController.removeVote);

module.exports = router;
