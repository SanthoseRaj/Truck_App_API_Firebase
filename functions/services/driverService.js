const mongoose = require('mongoose');
const Driver = require('../models/Driver');

const REQUIRED_DRIVER_FIELDS = [
  ['driverName', 'Driver name is required'],
  ['mobileNumber', 'Mobile number is required'],
  ['idNumber', 'ID number is required'],
];

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : value);

const serializeDriver = (driver) => ({
  id: driver._id,
  driverName: driver.driverName,
  mobileNumber: driver.mobileNumber,
  idNumber: driver.idNumber,
  isActive: driver.isActive !== false,
  createdAt: driver.createdAt,
  updatedAt: driver.updatedAt,
});

const validateDriverInput = (body, options = {}) => {
  const { requireAll = false } = options;

  for (const [field, message] of REQUIRED_DRIVER_FIELDS) {
    if (!requireAll && !(field in body)) continue;
    if (!normalizeString(body[field])) return message;
  }

  return null;
};

const parseBooleanQuery = (value) => {
  if (value === undefined) return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
};

const buildDriverListQuery = (queryParams = {}) => {
  const query = {};
  const isActive = parseBooleanQuery(queryParams.isActive);

  if (isActive !== undefined) {
    if (isActive === null) return { error: 'isActive must be true or false' };
    query.isActive = isActive;
  }

  const search = normalizeString(queryParams.search);
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { driverName: { $regex: escapedSearch, $options: 'i' } },
      { mobileNumber: { $regex: escapedSearch, $options: 'i' } },
      { idNumber: { $regex: escapedSearch, $options: 'i' } },
    ];
  }

  return { query };
};

const getDuplicateDriverMessage = (error) => {
  if (error.code !== 11000) return null;

  const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
  if (field === 'mobileNumber') return 'Mobile number already exists';
  if (field === 'idNumber') return 'ID number already exists';
  return 'Driver already exists';
};

const ensureUniqueDriverFields = async ({ mobileNumber, idNumber }, excludedDriverId) => {
  const duplicateChecks = [];
  const baseExclusion = excludedDriverId ? { _id: { $ne: excludedDriverId } } : {};

  if (mobileNumber) {
    duplicateChecks.push(
      Driver.findOne({ ...baseExclusion, mobileNumber }).then((driver) =>
        driver ? 'Mobile number already exists' : null
      )
    );
  }

  if (idNumber) {
    duplicateChecks.push(
      Driver.findOne({ ...baseExclusion, idNumber }).then((driver) =>
        driver ? 'ID number already exists' : null
      )
    );
  }

  const duplicateMessages = await Promise.all(duplicateChecks);
  return duplicateMessages.find(Boolean) || null;
};

const listDrivers = async (queryParams) => {
  const { query, error } = buildDriverListQuery(queryParams);
  if (error) return { error };

  const drivers = await Driver.find(query).sort({ driverName: 1 });
  return { drivers: drivers.map(serializeDriver) };
};

const getDriverById = async (id) => {
  if (!mongoose.isValidObjectId(id)) return null;
  const driver = await Driver.findById(id);
  return driver ? serializeDriver(driver) : null;
};

const createDriver = async (body) => {
  const validationError = validateDriverInput(body, { requireAll: true });
  if (validationError) return { error: validationError, statusCode: 400 };

  const driverPayload = {
    driverName: normalizeString(body.driverName),
    mobileNumber: normalizeString(body.mobileNumber),
    idNumber: normalizeString(body.idNumber),
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
  };

  const duplicateError = await ensureUniqueDriverFields(driverPayload);
  if (duplicateError) return { error: duplicateError, statusCode: 409 };

  const driver = await Driver.create(driverPayload);
  return { driver: serializeDriver(driver) };
};

const updateDriver = async (id, body) => {
  if (!mongoose.isValidObjectId(id)) return { notFound: true };

  const validationError = validateDriverInput(body);
  if (validationError) return { error: validationError, statusCode: 400 };

  const updates = {};
  if ('driverName' in body) updates.driverName = normalizeString(body.driverName);
  if ('mobileNumber' in body) updates.mobileNumber = normalizeString(body.mobileNumber);
  if ('idNumber' in body) updates.idNumber = normalizeString(body.idNumber);
  if ('isActive' in body) updates.isActive = body.isActive;

  const duplicateError = await ensureUniqueDriverFields(updates, id);
  if (duplicateError) return { error: duplicateError, statusCode: 409 };

  const driver = await Driver.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  if (!driver) return { notFound: true };
  return { driver: serializeDriver(driver) };
};

const deleteDriver = async (id) => {
  if (!mongoose.isValidObjectId(id)) return false;
  return Boolean(await Driver.findByIdAndDelete(id));
};

module.exports = {
  listDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
  serializeDriver,
  validateDriverInput,
  buildDriverListQuery,
  getDuplicateDriverMessage,
};
