const { Router } = require('express');

const router = Router();

router.get('/auth', (req, res) => {
  res.json({ status: 'endpoint auth' });
});

module.exports = router;
