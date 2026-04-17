const { Router } = require('express');

const router = Router();

router.get('/occurrences', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = router;
