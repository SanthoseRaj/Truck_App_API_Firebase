const assert = require('assert');
const {
  serializeSupplier,
  validateSupplierInput,
  buildSupplierListQuery,
  supplierNameKey,
} = require('../services/supplierService');

const baseSupplier = {
  _id: 'supplier-1',
  supplierName: 'Gulf Supplier',
  companyName: 'Gulf Trading LLC',
  contactNumber: '+96893307711',
  isActive: true,
};

assert.strictEqual(supplierNameKey('  Gulf Supplier  '), 'gulf supplier');

assert.strictEqual(validateSupplierInput(baseSupplier, { requireAll: true }), null);
assert.strictEqual(
  validateSupplierInput({ ...baseSupplier, supplierName: '   ' }, { requireAll: true }),
  'Supplier name is required'
);
assert.strictEqual(
  validateSupplierInput({ ...baseSupplier, companyName: null }, { requireAll: true }),
  'Company name is required'
);
assert.strictEqual(
  validateSupplierInput({ ...baseSupplier, contactNumber: '' }, { requireAll: true }),
  'Contact number is required'
);
assert.strictEqual(validateSupplierInput({ isActive: 'true' }), 'isActive must be true or false');

assert.deepStrictEqual(serializeSupplier(baseSupplier), {
  id: 'supplier-1',
  supplierName: 'Gulf Supplier',
  companyName: 'Gulf Trading LLC',
  contactNumber: '+96893307711',
  isActive: true,
});

assert.strictEqual(serializeSupplier({ ...baseSupplier, isActive: undefined }).isActive, true);

assert.deepStrictEqual(buildSupplierListQuery({}, { role: 'yard' }), { query: { isActive: true } });
assert.deepStrictEqual(buildSupplierListQuery({}, { role: 'admin' }), { query: { isActive: true } });
assert.deepStrictEqual(buildSupplierListQuery({ includeInactive: 'true' }, { role: 'admin' }), { query: {} });
assert.deepStrictEqual(buildSupplierListQuery({ isActive: 'false' }, { role: 'owner' }), {
  query: { isActive: false },
});
assert.deepStrictEqual(buildSupplierListQuery({ includeInactive: 'maybe' }, { role: 'admin' }), {
  error: 'includeInactive must be true or false',
});

console.log('supplier service tests passed');
