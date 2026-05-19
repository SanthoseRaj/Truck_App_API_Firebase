const express = require('express');
const {
  createDriver,
  getDrivers,
  getDriver,
  updateDriver,
  deleteDriver,
} = require('../controllers/driverController');
const { protect } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

const router = express.Router();
const driverReaders = ['owner', 'admin', 'yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'];
const driverManagers = ['owner', 'admin', 'yard', 'gate'];

router.use(protect);

/**
 * @swagger
 * /api/drivers:
 *   get:
 *     summary: List drivers
 *     tags: [Drivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by driver name, mobile number, or ID number
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of drivers sorted by driver name
 */
router.get('/', allowRoles(...driverReaders), getDrivers);

/**
 * @swagger
 * /api/drivers:
 *   post:
 *     summary: Create driver
 *     tags: [Drivers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DriverInput'
 *     responses:
 *       201:
 *         description: Driver created
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate mobile number or ID number
 */
router.post('/', allowRoles(...driverManagers), createDriver);

/**
 * @swagger
 * /api/drivers/{id}:
 *   get:
 *     summary: Get driver details
 *     tags: [Drivers]
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
 *         description: Driver details
 *       404:
 *         description: Driver not found
 */
router.get('/:id', allowRoles(...driverReaders), getDriver);

/**
 * @swagger
 * /api/drivers/{id}:
 *   put:
 *     summary: Update driver
 *     tags: [Drivers]
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
 *             $ref: '#/components/schemas/DriverInput'
 *     responses:
 *       200:
 *         description: Driver updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Driver not found
 *       409:
 *         description: Duplicate mobile number or ID number
 */
router.put('/:id', allowRoles(...driverManagers), updateDriver);

/**
 * @swagger
 * /api/drivers/{id}:
 *   delete:
 *     summary: Delete driver
 *     tags: [Drivers]
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
 *         description: Driver deleted
 *       404:
 *         description: Driver not found
 */
router.delete('/:id', allowRoles(...driverManagers), deleteDriver);

module.exports = router;
