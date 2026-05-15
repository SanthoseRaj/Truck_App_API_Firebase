const express = require('express');
const {
  createTruck,
  getTrucks,
  getTruckById,
  getTruckByNumber,
  updateTruck,
  deleteTruck,
} = require('../controllers/truckController');
const { protect } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * /api/trucks:
 *   post:
 *     summary: Create truck or start a new trip for an existing truck number
 *     tags: [Trucks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TruckInput'
 *     responses:
 *       201:
 *         description: Truck created
 *       200:
 *         description: Existing truck updated and trip count incremented
 */
router.post('/', allowRoles('yard', 'admin'), createTruck);

/**
 * @swagger
 * /api/trucks:
 *   get:
 *     summary: List all active trucks
 *     tags: [Trucks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of trucks
 */
router.get('/', allowRoles('owner', 'admin', 'yard', 'gate', 'port', 'clearence', 'dubai'), getTrucks);

/**
 * @swagger
 * /api/trucks/number/{truckNumber}:
 *   get:
 *     summary: Get truck by truck number
 *     tags: [Trucks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: truckNumber
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Truck details
 *       404:
 *         description: Truck not found
 */
router.get('/number/:truckNumber', allowRoles('owner', 'admin', 'yard', 'gate', 'port', 'clearence', 'dubai'), getTruckByNumber);

/**
 * @swagger
 * /api/trucks/{id}:
 *   get:
 *     summary: Get truck details
 *     tags: [Trucks]
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
 *         description: Truck details
 */
router.get('/:id', allowRoles('owner', 'admin', 'yard', 'gate', 'port', 'clearence', 'dubai'), getTruckById);

/**
 * @swagger
 * /api/trucks/{id}:
 *   put:
 *     summary: Update truck details
 *     tags: [Trucks]
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
 *             $ref: '#/components/schemas/TruckUpdateInput'
 *     responses:
 *       200:
 *         description: Truck updated
 */
router.put('/:id', allowRoles('yard', 'admin'), updateTruck);

/**
 * @swagger
 * /api/trucks/{id}:
 *   delete:
 *     summary: Soft delete truck
 *     tags: [Trucks]
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
 *         description: Truck deleted
 */
router.delete('/:id', allowRoles('admin'), deleteTruck);

module.exports = router;
