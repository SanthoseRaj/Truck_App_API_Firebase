const express = require('express');
const { getPublicDashboardTruckEntries } = require('../controllers/publicDashboardController');

const router = express.Router();

/**
 * @swagger
 * /api/public/dashboard-truck-entries:
 *   get:
 *     summary: Public truck entry dashboard data
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Public map and route counts without sensitive driver or member data
 */
router.get('/dashboard-truck-entries', getPublicDashboardTruckEntries);

module.exports = router;
