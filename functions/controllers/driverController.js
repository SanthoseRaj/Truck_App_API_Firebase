const {
  listDrivers,
  getDriverById,
  createDriver: createDriverRecord,
  updateDriver: updateDriverRecord,
  deleteDriver: deleteDriverRecord,
  getDuplicateDriverMessage,
} = require('../services/driverService');

const createDriver = async (req, res, next) => {
  try {
    const result = await createDriverRecord(req.body);
    if (result.error) return res.status(result.statusCode).json({ success: false, message: result.error });

    return res.status(201).json({ success: true, data: result.driver });
  } catch (error) {
    const duplicateMessage = getDuplicateDriverMessage(error);
    if (duplicateMessage) return res.status(409).json({ success: false, message: duplicateMessage });
    next(error);
  }
};

const getDrivers = async (req, res, next) => {
  try {
    const result = await listDrivers(req.query);
    if (result.error) return res.status(400).json({ success: false, message: result.error });

    return res.json({ success: true, data: result.drivers });
  } catch (error) {
    next(error);
  }
};

const getDriver = async (req, res, next) => {
  try {
    const driver = await getDriverById(req.params.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    return res.json({ success: true, data: driver });
  } catch (error) {
    next(error);
  }
};

const updateDriver = async (req, res, next) => {
  try {
    const result = await updateDriverRecord(req.params.id, req.body);
    if (result.notFound) return res.status(404).json({ success: false, message: 'Driver not found' });
    if (result.error) return res.status(result.statusCode).json({ success: false, message: result.error });

    return res.json({ success: true, data: result.driver });
  } catch (error) {
    const duplicateMessage = getDuplicateDriverMessage(error);
    if (duplicateMessage) return res.status(409).json({ success: false, message: duplicateMessage });
    next(error);
  }
};

const deleteDriver = async (req, res, next) => {
  try {
    const deleted = await deleteDriverRecord(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Driver not found' });

    return res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDriver,
  getDrivers,
  getDriver,
  updateDriver,
  deleteDriver,
};
