const express = require('express');
const { markEntry, markExit, moveNext, getTripHistory } = require('../controllers/tripController');
const { protect } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

const router = express.Router();
const operators = ['admin', 'yard', 'gate', 'port', 'clearence', 'dubai'];

router.use(protect);

/**
 * @swagger
 * /api/trips/{truckId}/entry:
 *   post:
 *     summary: Mark entry for truck at current stop
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: truckId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RemarksInput'
 *     responses:
 *       200:
 *         description: Entry marked
 */
router.post('/:truckId/entry', allowRoles(...operators), markEntry);

/**
 * @swagger
 * /api/trips/{truckId}/exit:
 *   post:
 *     summary: Mark exit for truck at current stop
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: truckId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RemarksInput'
 *     responses:
 *       200:
 *         description: Exit marked
 */
router.post('/:truckId/exit', allowRoles(...operators), markExit);

/**
 * @swagger
 * /api/trips/{truckId}/move-next:
 *   post:
 *     summary: Move truck to next route stop
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: truckId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RemarksInput'
 *     responses:
 *       200:
 *         description: Truck moved
 */
router.post('/:truckId/move-next', allowRoles(...operators), moveNext);

/**
 * @swagger
 * /api/trips/{truckId}/history:
 *   get:
 *     summary: Get complete trip and activity history for a truck
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: truckId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trip history
 */
router.get('/:truckId/history', allowRoles('owner', 'admin', 'yard', 'gate', 'port', 'clearence', 'dubai'), getTripHistory);

module.exports = router;
