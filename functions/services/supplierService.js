const mongoose = require('mongoose');
const Supplier = require('../models/Supplier');

const managerRoles = ['owner', 'admin'];
const REQUIRED_SUPPLIER_FIELDS = [
  ['supplierName', 'Supplier name is required'],
  ['companyName', 'Company name is required'],
  ['contactNumber', 'Contact number is required'],
];

const trimString = (value) => (typeof value === 'string' ? value.trim() : value);
const supplierNameKey = (value) => trimString(value)?.toLowerCase();
const isManager = (user) => managerRoles.includes(user?.role);

const serializeSupplier = (supplier) => ({
  id: supplier._id,
  supplierName: supplier.supplierName,
  companyName: supplier.companyName,
  contactNumber: supplier.contactNumber,
  isActive: supplier.isActive !== false,
});

const validateSupplierInput = (body = {}, options = {}) => {
  const { requireAll = false } = options;

  for (const [field, message] of REQUIRED_SUPPLIER_FIELDS) {
    if (!requireAll && !(field in body)) continue;
    if (!trimString(body[field])) return message;
  }

  if ('isActive' in body && typeof body.isActive !== 'boolean') {
    return 'isActive must be true or false';
  }

  return null;
};

const parseBooleanQuery = (value) => {
  if (value === undefined) return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
};

const buildSupplierListQuery = (queryParams = {}, user = {}) => {
  const query = {};

  if (!isManager(user)) {
    return { query: { isActive: true } };
  }

  const includeInactive = parseBooleanQuery(queryParams.includeInactive);
  if (includeInactive === null) return { error: 'includeInactive must be true or false' };

  const isActive = parseBooleanQuery(queryParams.isActive);
  if (isActive === null) return { error: 'isActive must be true or false' };

  if (isActive !== undefined) {
    query.isActive = isActive;
  } else if (includeInactive !== true) {
    query.isActive = true;
  }

  return { query };
};

const listSuppliers = async (queryParams, user) => {
  const { query, error } = buildSupplierListQuery(queryParams, user);
  if (error) return { error, statusCode: 400 };

  const suppliers = await Supplier.find(query).sort({ supplierName: 1 });
  return { suppliers: suppliers.map(serializeSupplier) };
};

const createSupplier = async (body = {}) => {
  const validationError = validateSupplierInput(body, { requireAll: true });
  if (validationError) return { error: validationError, statusCode: 400 };

  const payload = {
    supplierName: trimString(body.supplierName),
    supplierNameKey: supplierNameKey(body.supplierName),
    companyName: trimString(body.companyName),
    contactNumber: trimString(body.contactNumber),
    isActive: true,
  };

  const supplier = await Supplier.create(payload);
  return { supplier: serializeSupplier(supplier) };
};

const updateSupplier = async (id, body = {}) => {
  if (!mongoose.isValidObjectId(id)) return { notFound: true };

  const validationError = validateSupplierInput(body);
  if (validationError) return { error: validationError, statusCode: 400 };

  const updates = {};
  if ('supplierName' in body) {
    updates.supplierName = trimString(body.supplierName);
    updates.supplierNameKey = supplierNameKey(body.supplierName);
  }
  if ('companyName' in body) updates.companyName = trimString(body.companyName);
  if ('contactNumber' in body) updates.contactNumber = trimString(body.contactNumber);
  if ('isActive' in body) updates.isActive = body.isActive;

  const supplier = await Supplier.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  if (!supplier) return { notFound: true };
  return { supplier: serializeSupplier(supplier) };
};

const deactivateSupplier = async (id) => {
  if (!mongoose.isValidObjectId(id)) return null;

  const supplier = await Supplier.findByIdAndUpdate(
    id,
    { isActive: false },
    {
      new: true,
      runValidators: true,
    }
  );

  return supplier ? serializeSupplier(supplier) : null;
};

const resolveActiveSupplierForEntry = async (body = {}) => {
  const hasSupplierId = body.supplierId !== undefined && body.supplierId !== null && String(body.supplierId).trim();

  if (hasSupplierId) {
    if (!mongoose.isValidObjectId(body.supplierId)) {
      return { error: { status: 404, message: 'Supplier not found' } };
    }

    const supplier = await Supplier.findOne({ _id: body.supplierId, isActive: true });
    if (!supplier) return { error: { status: 404, message: 'Supplier not found' } };
    return { supplier };
  }

  if (!trimString(body.supplierName)) {
    return { error: { status: 400, message: 'supplierName or supplierId is required' } };
  }

  const supplier = await Supplier.findOne({
    supplierNameKey: supplierNameKey(body.supplierName),
    isActive: true,
  });

  if (!supplier) return { error: { status: 404, message: 'Supplier not found' } };
  return { supplier };
};

module.exports = {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deactivateSupplier,
  resolveActiveSupplierForEntry,
  serializeSupplier,
  validateSupplierInput,
  buildSupplierListQuery,
  supplierNameKey,
};
