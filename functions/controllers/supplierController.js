const {
  listSuppliers,
  createSupplier: createSupplierRecord,
  updateSupplier: updateSupplierRecord,
  deleteSupplier: deleteSupplierRecord,
} = require('../services/supplierService');
const { logApiTiming } = require('../utils/apiPerformance');

const getSuppliers = async (req, res, next) => {
  try {
    const timings = {};
    const result = await listSuppliers(req.query, req.user, { timings });
    if (result.error) return res.status(result.statusCode).json({ success: false, message: result.error });

    const payload = { success: true, data: result.suppliers };
    logApiTiming(req, timings, payload);

    return res.json(payload);
  } catch (error) {
    next(error);
  }
};

const createSupplier = async (req, res, next) => {
  try {
    const result = await createSupplierRecord(req.body);
    if (result.error) return res.status(result.statusCode).json({ success: false, message: result.error });

    return res.status(201).json({ success: true, data: result.supplier });
  } catch (error) {
    next(error);
  }
};

const updateSupplier = async (req, res, next) => {
  try {
    const result = await updateSupplierRecord(req.params.id, req.body);
    if (result.notFound) return res.status(404).json({ success: false, message: 'Supplier not found' });
    if (result.error) return res.status(result.statusCode).json({ success: false, message: result.error });

    return res.json({ success: true, data: result.supplier });
  } catch (error) {
    next(error);
  }
};

const deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await deleteSupplierRecord(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });

    return res.json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
