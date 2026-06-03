const assert = require('assert');
const { buildRouteStatsFromTruckEntries } = require('../controllers/dashboardController');

const truckEntries = [
  {
    _id: 'dubai-after-clearence',
    headTruckNumber: 'HT-DXB',
    destination: 'dubai',
    currentStop: 'clearence',
    currentStatus: 'exit',
    nextStop: null,
  },
  {
    _id: 'freezone-after-clearence',
    headTruckNumber: 'HT-FZ',
    destination: 'freezone',
    currentStop: 'clearence',
    currentStatus: 'exit',
    nextStop: 'freezone',
  },
  {
    _id: 'legacy-freezone-after-clearence',
    headTruckNumber: 'HT-FZ-LEGACY',
    destination: 'Free Zone',
    currentStop: 'clearence',
    currentStatus: 'exit',
    nextStop: 'freezone',
  },
  {
    _id: 'dubai-waiting-clearence',
    headTruckNumber: 'HT-WAIT',
    destination: 'dubai',
    currentStop: 'clearence',
    currentStatus: 'entry',
    nextStop: null,
  },
  {
    _id: 'canceled-after-clearence',
    headTruckNumber: 'HT-CANCELED',
    destination: 'dubai',
    currentStop: 'clearence',
    currentStatus: 'exit',
    workflowStatus: 'canceled',
    nextStop: null,
  },
];

const routes = buildRouteStatsFromTruckEntries(truckEntries);
const clearenceToDubai = routes.find(
  (route) => route.from === 'Custom Clearence' && route.to === 'Dubai'
);
const portToFreeZone = routes.find(
  (route) => route.from === 'Port Loading' && route.to === 'Free Zone'
);

assert.strictEqual(clearenceToDubai.count, 1);
assert.deepStrictEqual(
  clearenceToDubai.trucks.map((truck) => truck._id),
  ['dubai-after-clearence']
);
assert.strictEqual(clearenceToDubai.count, clearenceToDubai.trucks.length);

assert.strictEqual(portToFreeZone.count, 2);
assert.deepStrictEqual(
  portToFreeZone.trucks.map((truck) => truck._id),
  ['freezone-after-clearence', 'legacy-freezone-after-clearence']
);
assert.strictEqual(portToFreeZone.count, portToFreeZone.trucks.length);

for (const route of routes) {
  assert.strictEqual(route.count, route.trucks.length);
}

console.log('dashboard controller tests passed');
