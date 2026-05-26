const express = require('express');
const {
  createTruckEntry,
  getTruckEntries,
  getTruckEntryById,
  cancelTruckEntry,
  markGateReturnEntry,
  markTeamEntry,
  markTeamExit,
} = require('../controllers/truckEntryController');
const { protect } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

const router = express.Router();
const truckEntryReaders = ['owner', 'admin', 'yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'];
const truckEntryCreators = ['owner', 'admin', 'yard', 'gate'];

router.use(protect);

/**
 * @swagger
 * /api/truck-entries:
 *   post:
 *     summary: Create truck entry
 *     tags: [Truck Entries]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TruckEntryInput'
 *     responses:
 *       201:
 *         description: Truck entry created
 *       400:
 *         description: Validation error
 *       404:
 *         description: Ship not found
 *       409:
 *         description: Duplicate active truck entry
 */
router.post('/', allowRoles(...truckEntryCreators), createTruckEntry);

/**
 * @swagger
 * /api/truck-entries:
 *   get:
 *     summary: List all truck entries
 *     tags: [Truck Entries]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of truck entries
 */
router.get('/', allowRoles(...truckEntryReaders), getTruckEntries);

/**
 * @swagger
 * /api/truck-entries/{id}/gate-return-entry:
 *   patch:
 *     summary: Complete a Free Zone return at Gate and create the next trip atomically
 *     tags: [Truck Entries]
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
 *         description: Free Zone return completed and next trip created
 *       400:
 *         description: Validation error or trip not ready for Gate return
 *       403:
 *         description: User is not assigned to Gate
 *       404:
 *         description: Truck entry, truck, ship, or supplier not found
 *       409:
 *         description: Duplicate active truck entry
 */
router.patch('/:id/gate-return-entry', allowRoles('gate'), markGateReturnEntry);

/**
 * @swagger
 * /api/truck-entries/{id}/cancel:
 *   patch:
 *     summary: Cancel a truck entry trip without deleting the truck master record
 *     tags: [Truck Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TruckEntryCancelInput'
 *     responses:
 *       200:
 *         description: Truck entry canceled
 *       400:
 *         description: Validation error or already canceled entry
 *       403:
 *         description: Only admin can cancel trips
 *       404:
 *         description: Truck entry not found
 */
router.patch('/:id/cancel', cancelTruckEntry);

/**
 * @swagger
 * /api/truck-entries/{id}/entry:
 *   patch:
 *     summary: Mark entry for the current allowed workflow stop
 *     tags: [Truck Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TruckEntryTeamUpdateInput'
 *     responses:
 *       200:
 *         description: Truck entry updated
 *       400:
 *         description: Validation error or completed entry
 *       403:
 *         description: User is not assigned to this workflow step
 *       404:
 *         description: Truck entry not found
 */
router.patch('/:id/entry', allowRoles(...truckEntryReaders), markTeamEntry);

/**
 * @swagger
 * /api/truck-entries/{id}/exit:
 *   patch:
 *     summary: Mark exit for the current allowed workflow stop
 *     tags: [Truck Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TruckEntryExitUpdateInput'
 *     responses:
 *       200:
 *         description: Truck exit updated
 *       400:
 *         description: Validation error, incomplete previous stop, or completed workflow
 *       403:
 *         description: User is not assigned to this workflow stop
 *       404:
 *         description: Truck entry not found
 */
router.patch('/:id/exit', allowRoles(...truckEntryReaders), markTeamExit);

/**
 * @swagger
 * /api/truck-entries/{id}:
 *   get:
 *     summary: Get truck entry details
 *     tags: [Truck Entries]
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
 *         description: Truck entry details
 *       404:
 *         description: Truck entry not found
 */
router.get('/:id', allowRoles(...truckEntryReaders), getTruckEntryById);

module.exports = router;
