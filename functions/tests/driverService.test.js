const assert = require('assert');
const {
  serializeDriver,
  validateDriverInput,
  buildDriverListQuery,
} = require('../services/driverService');

const baseDriver = {
  _id: 'driver-1',
  driverName: 'Ali Mohammed',
  mobileNumber: '+96893307711',
  idNumber: 'ID-11842',
  isActive: true,
  createdAt: new Date('2026-05-14T00:00:00.000Z'),
  updatedAt: new Date('2026-05-14T00:00:00.000Z'),
};

assert.strictEqual(validateDriverInput(baseDriver, { requireAll: true }), null);
assert.strictEqual(validateDriverInput({ ...baseDriver, driverName: '' }, { requireAll: true }), 'Driver name is required');
assert.strictEqual(
  validateDriverInput({ ...baseDriver, mobileNumber: '   ' }, { requireAll: true }),
  'Mobile number is required'
);
assert.strictEqual(validateDriverInput({ ...baseDriver, idNumber: null }, { requireAll: true }), 'ID number is required');

assert.deepStrictEqual(serializeDriver(baseDriver), {
  id: 'driver-1',
  driverName: 'Ali Mohammed',
  mobileNumber: '+96893307711',
  idNumber: 'ID-11842',
  isActive: true,
  createdAt: baseDriver.createdAt,
  updatedAt: baseDriver.updatedAt,
});

assert.strictEqual(serializeDriver({ ...baseDriver, isActive: undefined }).isActive, true);

assert.deepStrictEqual(buildDriverListQuery({ isActive: 'true' }), { query: { isActive: true } });
assert.deepStrictEqual(buildDriverListQuery({ isActive: 'false' }), { query: { isActive: false } });
assert.deepStrictEqual(buildDriverListQuery({ isActive: 'maybe' }), { error: 'isActive must be true or false' });

const searchQuery = buildDriverListQuery({ search: 'Ali+' }).query;
assert.strictEqual(searchQuery.$or.length, 3);
assert.deepStrictEqual(searchQuery.$or[0], { driverName: { $regex: 'Ali\\+', $options: 'i' } });

console.log('driver service tests passed');
