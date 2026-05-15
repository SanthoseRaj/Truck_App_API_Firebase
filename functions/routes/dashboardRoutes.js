const express = require('express');
const { getSummary, getMap, getRouteTrucks } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

const router = express.Router();
const readers = ['owner', 'admin', 'yard', 'gate', 'port', 'clearence', 'dubai'];

router.use(protect);

/**
 * @swagger
 * /api/dashboard/summary:
 *   get:
 *     summary: Get dashboard summary
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard counts and route stats
 */
router.get('/summary', allowRoles(...readers), getSummary);

/**
 * @swagger
 * /api/dashboard/map:
 *   get:
 *     summary: Get map markers, route lines, and trucks between stops
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Map data
 */
router.get('/map', allowRoles(...readers), getMap);

/**
 * @swagger
 * /api/dashboard/route/{from}/{to}:
 *   get:
 *     summary: Get trucks moving between two stops
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trucks on requested route
 */
router.get('/route/:from/:to', allowRoles(...readers), getRouteTrucks);

module.exports = router;
