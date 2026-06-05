const { Router } = require('express');
const analyticsController = require('../controllers/analyticsController');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');

const router = Router();

// Públicos
router.get('/analytics/overview', analyticsController.overview);
router.get('/analytics/by-neighborhood', analyticsController.byNeighborhood);
router.get('/analytics/heatmap', analyticsController.heatmap);
router.get('/analytics/response-time', analyticsController.responseTime);

// Admin
router.get(
  '/analytics/by-organization',
  auth,
  requireRole('admin'),
  analyticsController.byOrganization
);

module.exports = router;
