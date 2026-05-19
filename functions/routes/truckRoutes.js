const express = require('express');
const {
  createTruck,
  getTrucks,
  updateTruck,
  deleteTruck,
} = require('../controllers/truckController');
const { protect } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

const router = express.Router();
const truckReaders = ['owner', 'admin', 'yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'];
const truckManagers = ['owner', 'admin', 'yard', 'gate'];

router.use(protect);

/**
 * @swagger
 * /api/trucks:
 *   get:
 *     summary: List truck master records
 *     tags: [Trucks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         required: false
 *         description: Owner/admin/yard/gate only. Include inactive trucks when true.
 *     responses:
 *       200:
 *         description: List of trucks
 */
router.get('/', allowRoles(...truckReaders), getTrucks);

/**
 * @swagger
 * /api/trucks:
 *   post:
 *     summary: Create truck master record
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
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate head truck number
 */
router.post('/', allowRoles(...truckManagers), createTruck);

/**
 * @swagger
 * /api/trucks/{id}:
 *   patch:
 *     summary: Update truck master record
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
 *       400:
 *         description: Validation error
 *       404:
 *         description: Truck not found
 *       409:
 *         description: Duplicate head truck number
 */
router.patch('/:id', allowRoles(...truckManagers), updateTruck);
router.put('/:id', allowRoles(...truckManagers), updateTruck);

/**
 * @swagger
 * /api/trucks/{id}:
 *   delete:
 *     summary: Delete truck master record
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
 *       404:
 *         description: Truck not found
 */
router.delete('/:id', allowRoles(...truckManagers), deleteTruck);

module.exports = router;
