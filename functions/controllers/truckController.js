const mongoose = require('mongoose');
const Truck = require('../models/Truck');
const TruckEntry = require('../models/TruckEntry');
const { normalizeTruckModel } = require('../utils/truckModel');

const TRUCK_MODEL_ERROR = 'truckModel must be one of 2 Axle, 3 Axle, or 6 Wheel';

const normalizeUpper = (value) => (value || '').trim().toUpperCase();

const serializeTruck = (truck) => ({
  id: truck._id,
  headTruckNumber: truck.headTruckNumber,
  tailTrailerNumber: truck.tailTrailerNumber,
  truckModel: normalizeTruckModel(truck.truckModel) || truck.truckModel,
  isActive: truck.isActive !== false,
  createdAt: truck.createdAt,
  updatedAt: truck.updatedAt,
});

const validateTruckInput = (body, options = {}) => {
  const { requireAll = false } = options;

  if ((requireAll || 'headTruckNumber' in body) && !normalizeUpper(body.headTruckNumber)) {
    return 'Head truck number is required';
  }

  if ((requireAll || 'tailTrailerNumber' in body) && !normalizeUpper(body.tailTrailerNumber)) {
    return 'Tail trailer number is required';
  }

  if (requireAll || 'truckModel' in body) {
    if (!normalizeTruckModel(body.truckModel)) {
      return TRUCK_MODEL_ERROR;
    }
  }

  if ('isActive' in body && typeof body.isActive !== 'boolean') {
    return 'isActive must be a boolean';
  }

  return null;
};

const handleDuplicateHeadTruckNumber = (error, res) => {
  if (
    error.code === 11000 &&
    (
      error.keyPattern?.headTruckNumber ||
      error.keyValue?.headTruckNumber ||
      error.keyPattern?.truckNumber ||
      error.keyValue?.truckNumber
    )
  ) {
    res.status(409).json({ success: false, message: 'Head truck number already exists' });
    return true;
  }

  return false;
};

const createTruck = async (req, res, next) => {
  try {
    const validationError = validateTruckInput(req.body, { requireAll: true });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const headTruckNumber = normalizeUpper(req.body.headTruckNumber);
    const existingTruck = await Truck.findOne({ headTruckNumber });

    if (existingTruck) {
      return res.status(409).json({ success: false, message: 'Head truck number already exists' });
    }

    const truck = await Truck.create({
      headTruckNumber,
      tailTrailerNumber: normalizeUpper(req.body.tailTrailerNumber),
      truckModel: normalizeTruckModel(req.body.truckModel),
      isActive: typeof req.body.isActive === 'boolean' ? req.body.isActive : true,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      message: 'Truck created successfully',
      truck: serializeTruck(truck),
    });
  } catch (error) {
    if (handleDuplicateHeadTruckNumber(error, res)) return;
    next(error);
  }
};

const getTrucks = async (req, res, next) => {
  try {
    const isManager = ['owner', 'admin', 'yard', 'gate'].includes(req.user.role);
    const includeInactive = isManager && req.query.includeInactive === 'true';
    const filter = includeInactive ? {} : { isActive: true };
    const trucks = await Truck.find(filter).sort('headTruckNumber');

    return res.status(200).json({ trucks: trucks.map(serializeTruck) });
  } catch (error) {
    next(error);
  }
};

const updateTruck = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Truck not found' });
    }

    const validationError = validateTruckInput(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const updates = {};

    if ('headTruckNumber' in req.body) {
      updates.headTruckNumber = normalizeUpper(req.body.headTruckNumber);
      const duplicateTruck = await Truck.findOne({
        headTruckNumber: updates.headTruckNumber,
        _id: { $ne: req.params.id },
      });

      if (duplicateTruck) {
        return res.status(409).json({ success: false, message: 'Head truck number already exists' });
      }
    }

    if ('tailTrailerNumber' in req.body) {
      updates.tailTrailerNumber = normalizeUpper(req.body.tailTrailerNumber);
    }
    if ('truckModel' in req.body) updates.truckModel = normalizeTruckModel(req.body.truckModel);
    if ('isActive' in req.body) updates.isActive = req.body.isActive;

    const truck = await Truck.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });

    return res.status(200).json({
      message: 'Truck updated successfully',
      truck: serializeTruck(truck),
    });
  } catch (error) {
    if (handleDuplicateHeadTruckNumber(error, res)) return;
    next(error);
  }
};

const deleteTruck = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Truck not found' });
    }

    const truck = await Truck.findByIdAndDelete(req.params.id);

    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });

    const deletedEntries = await TruckEntry.deleteMany({
      $or: [
        { truckId: truck._id },
        {
          headTruckNumber: truck.headTruckNumber,
          tailTrailerNumber: truck.tailTrailerNumber,
        },
      ],
    });

    return res.status(200).json({
      message: 'Truck deleted successfully',
      truck: serializeTruck(truck),
      deletedTruckEntries: deletedEntries.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTruck,
  getTrucks,
  updateTruck,
  deleteTruck,
  serializeTruck,
  validateTruckInput,
};
