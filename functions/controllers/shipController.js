const mongoose = require('mongoose');
const Ship = require('../models/Ship');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REQUIRED_SHIP_FIELDS = [
  ['shipName', 'Ship name is required'],
  ['quantityOfCargoOnBoard', 'Quantity of cargo on board is required'],
  ['eta', 'ETA is required'],
  ['atb', 'ATB is required'],
  ['dailyDischargeRate', 'Daily discharge rate is required'],
];

const toFiniteNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const parseShipDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const calculateEtc = (ship) => {
  const quantityOfCargoOnBoard = toFiniteNumber(ship.quantityOfCargoOnBoard);
  const dailyDischargeRate = toFiniteNumber(ship.dailyDischargeRate);

  if (!dailyDischargeRate || dailyDischargeRate <= 0 || quantityOfCargoOnBoard === null) {
    return { etcDays: null, completionDate: null };
  }

  const baseDate = parseShipDate(ship.atb) || parseShipDate(ship.eta);
  if (!baseDate) return { etcDays: quantityOfCargoOnBoard / dailyDischargeRate, completionDate: null };

  const etcDays = quantityOfCargoOnBoard / dailyDischargeRate;
  const completionDate = new Date(baseDate.getTime() + etcDays * MS_PER_DAY);
  return { etcDays, completionDate: completionDate.toISOString() };
};

const serializeShip = (ship) => ({
  id: ship._id,
  shipName: ship.shipName,
  shipNumber: ship.shipNumber || '',
  quantityOfCargoOnBoard: ship.quantityOfCargoOnBoard,
  eta: ship.eta,
  atb: ship.atb,
  dailyDischargeRate: ship.dailyDischargeRate,
  ...calculateEtc(ship),
  isActive: ship.isActive !== false,
  createdAt: ship.createdAt,
  updatedAt: ship.updatedAt,
});

const normalizeShipNumber = (shipNumber) => (shipNumber || '').trim().toUpperCase();

const validateShipInput = (body, options = {}) => {
  const { requireAll = false } = options;

  for (const [field, message] of REQUIRED_SHIP_FIELDS) {
    if (!requireAll && !(field in body)) continue;

    if (field === 'shipName' || field === 'eta' || field === 'atb') {
      if (!body[field] || !String(body[field]).trim()) return message;
      continue;
    }

    if (toFiniteNumber(body[field]) === null) return message;
  }

  return null;
};

const handleDuplicateShipNumber = (error, res) => {
  if (error.code === 11000 && error.keyPattern && error.keyPattern.shipNumber) {
    res.status(409).json({ success: false, message: 'Ship number already exists' });
    return true;
  }

  return false;
};

const createShip = async (req, res, next) => {
  try {
    const {
      shipName,
      shipNumber,
      quantityOfCargoOnBoard,
      eta,
      atb,
      dailyDischargeRate,
      isActive,
    } = req.body;
    const validationError = validateShipInput(req.body, { requireAll: true });

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const normalizedShipNumber = normalizeShipNumber(shipNumber);
    const existingShip = normalizedShipNumber
      ? await Ship.findOne({ shipNumber: normalizedShipNumber })
      : null;

    if (existingShip) {
      return res.status(409).json({ success: false, message: 'Ship number already exists' });
    }

    const ship = await Ship.create({
      shipName: shipName.trim(),
      shipNumber: normalizedShipNumber || undefined,
      quantityOfCargoOnBoard: toFiniteNumber(quantityOfCargoOnBoard),
      eta: eta.trim(),
      atb: atb.trim(),
      dailyDischargeRate: toFiniteNumber(dailyDischargeRate),
      isActive: typeof isActive === 'boolean' ? isActive : true,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      message: 'Ship created successfully',
      ship: serializeShip(ship),
    });
  } catch (error) {
    if (handleDuplicateShipNumber(error, res)) return;
    next(error);
  }
};

const getShips = async (req, res, next) => {
  try {
    const ships = await Ship.find().sort('-createdAt');
    return res.status(200).json({ ships: ships.map(serializeShip) });
  } catch (error) {
    next(error);
  }
};

const getShipById = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Ship not found' });
    }

    const ship = await Ship.findById(req.params.id);
    if (!ship) return res.status(404).json({ success: false, message: 'Ship not found' });

    return res.status(200).json({ ship: serializeShip(ship) });
  } catch (error) {
    next(error);
  }
};

const updateShip = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Ship not found' });
    }

    const validationError = validateShipInput(req.body);

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const ship = await Ship.findById(req.params.id);
    if (!ship) return res.status(404).json({ success: false, message: 'Ship not found' });

    const updates = {};
    const unsetFields = {};

    if ('shipName' in req.body) updates.shipName = req.body.shipName.trim();
    if ('shipNumber' in req.body) {
      const normalizedShipNumber = normalizeShipNumber(req.body.shipNumber);
      if (normalizedShipNumber) {
        updates.shipNumber = normalizedShipNumber;
      } else {
        unsetFields.shipNumber = '';
      }
    }
    if ('quantityOfCargoOnBoard' in req.body) {
      updates.quantityOfCargoOnBoard = toFiniteNumber(req.body.quantityOfCargoOnBoard);
    }
    if ('eta' in req.body) updates.eta = req.body.eta.trim();
    if ('atb' in req.body) updates.atb = req.body.atb.trim();
    if ('dailyDischargeRate' in req.body) {
      updates.dailyDischargeRate = toFiniteNumber(req.body.dailyDischargeRate);
    }
    if ('isActive' in req.body) updates.isActive = req.body.isActive;

    const duplicateShip = updates.shipNumber
      ? await Ship.findOne({
          shipNumber: updates.shipNumber,
          _id: { $ne: ship._id },
        })
      : null;

    if (duplicateShip) {
      return res.status(409).json({ success: false, message: 'Ship number already exists' });
    }

    const updateOperation = {};
    if (Object.keys(updates).length) updateOperation.$set = updates;
    if (Object.keys(unsetFields).length) updateOperation.$unset = unsetFields;

    if (!Object.keys(updateOperation).length) {
      return res.status(200).json({
        message: 'Ship updated successfully',
        ship: serializeShip(ship),
      });
    }

    const updatedShip = await Ship.findByIdAndUpdate(req.params.id, updateOperation, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      message: 'Ship updated successfully',
      ship: serializeShip(updatedShip),
    });
  } catch (error) {
    if (handleDuplicateShipNumber(error, res)) return;
    next(error);
  }
};

const deleteShip = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Ship not found' });
    }

    const ship = await Ship.findByIdAndDelete(req.params.id);
    if (!ship) return res.status(404).json({ success: false, message: 'Ship not found' });

    return res.status(200).json({ message: 'Ship deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createShip,
  getShips,
  getShipById,
  updateShip,
  deleteShip,
  calculateEtc,
  serializeShip,
  validateShipInput,
};
