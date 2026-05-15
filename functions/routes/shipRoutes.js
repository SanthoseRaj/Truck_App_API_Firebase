const express = require('express');
const {
  createShip,
  getShips,
  getShipById,
  updateShip,
  deleteShip,
} = require('../controllers/shipController');
const { protect } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

const router = express.Router();
const shipReaders = ['owner', 'admin', 'yard', 'gate', 'port', 'clearence', 'dubai'];
const shipManagers = ['owner', 'admin'];

router.use(protect);

/**
 * @swagger
 * /api/ships:
 *   post:
 *     summary: Create ship
 *     tags: [Ships]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ShipInput'
 *     responses:
 *       201:
 *         description: Ship created
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate ship number
 */
router.post('/', allowRoles(...shipManagers), createShip);

/**
 * @swagger
 * /api/ships:
 *   get:
 *     summary: List all ships
 *     tags: [Ships]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of ships
 */
router.get('/', allowRoles(...shipReaders), getShips);

/**
 * @swagger
 * /api/ships/{id}:
 *   get:
 *     summary: Get ship details
 *     tags: [Ships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ship details
 *       404:
 *         description: Ship not found
 */
router.get('/:id', allowRoles(...shipReaders), getShipById);

/**
 * @swagger
 * /api/ships/{id}:
 *   put:
 *     summary: Update ship
 *     tags: [Ships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ShipInput'
 *     responses:
 *       200:
 *         description: Ship updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Ship not found
 *       409:
 *         description: Duplicate ship number
 */
router.put('/:id', allowRoles(...shipManagers), updateShip);
router.patch('/:id', allowRoles(...shipManagers), updateShip);

/**
 * @swagger
 * /api/ships/{id}:
 *   delete:
 *     summary: Delete ship
 *     tags: [Ships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ship deleted
 *       404:
 *         description: Ship not found
 */
router.delete('/:id', allowRoles(...shipManagers), deleteShip);

module.exports = router;
