const express = require('express');
const {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} = require('../controllers/supplierController');
const { protect } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

const router = express.Router();
const supplierReaders = ['owner', 'admin', 'yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'];
const supplierManagers = ['owner', 'admin'];

router.use(protect);

router.get('/', allowRoles(...supplierReaders), getSuppliers);
router.post('/', allowRoles(...supplierManagers), createSupplier);
router.put('/:id', allowRoles(...supplierManagers), updateSupplier);
router.patch('/:id', allowRoles(...supplierManagers), updateSupplier);
router.delete('/:id', allowRoles(...supplierManagers), deleteSupplier);

module.exports = router;
