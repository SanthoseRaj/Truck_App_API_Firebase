const assert = require('assert');
const { calculateEtc, serializeShip, validateShipInput } = require('../controllers/shipController');

const baseShip = {
  _id: 'ship-1',
  shipName: 'MV Midway Spirit',
  shipNumber: '',
  quantityOfCargoOnBoard: 30000,
  eta: '2026-05-14',
  atb: '2026-05-15',
  dailyDischargeRate: 5000,
  isActive: true,
  createdAt: new Date('2026-05-14T00:00:00.000Z'),
  updatedAt: new Date('2026-05-14T00:00:00.000Z'),
};

assert.strictEqual(validateShipInput(baseShip, { requireAll: true }), null);
assert.strictEqual(validateShipInput({ ...baseShip, shipNumber: undefined }, { requireAll: true }), null);
assert.strictEqual(validateShipInput({ ...baseShip, shipName: '' }, { requireAll: true }), 'Ship name is required');
assert.strictEqual(
  validateShipInput({ ...baseShip, quantityOfCargoOnBoard: '' }, { requireAll: true }),
  'Quantity of cargo on board is required'
);

assert.deepStrictEqual(calculateEtc(baseShip), {
  etcDays: 6,
  completionDate: '2026-05-21T00:00:00.000Z',
});

assert.deepStrictEqual(calculateEtc({ ...baseShip, atb: 'not-a-date' }), {
  etcDays: 6,
  completionDate: '2026-05-20T00:00:00.000Z',
});

assert.deepStrictEqual(calculateEtc({ ...baseShip, dailyDischargeRate: 0 }), {
  etcDays: null,
  completionDate: null,
});

assert.deepStrictEqual(serializeShip(baseShip), {
  id: 'ship-1',
  shipName: 'MV Midway Spirit',
  shipNumber: '',
  quantityOfCargoOnBoard: 30000,
  eta: '2026-05-14',
  atb: '2026-05-15',
  dailyDischargeRate: 5000,
  etcDays: 6,
  completionDate: '2026-05-21T00:00:00.000Z',
  isActive: true,
  createdAt: baseShip.createdAt,
  updatedAt: baseShip.updatedAt,
});

assert.strictEqual(serializeShip({ ...baseShip, isActive: undefined }).isActive, true);

console.log('ship controller tests passed');
