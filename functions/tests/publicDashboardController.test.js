const assert = require('assert');
const {
  buildDashboardCounts,
  buildDashboardDateFilter,
  filterDashboardTruckEntriesByDate,
  getDashboardDateRange,
  serializePublicTruckEntry,
} = require('../controllers/publicDashboardController');

const baseEntry = {
  _id: 'entry-1',
  headTruckNumber: 'HT-100',
  tailTrailerNumber: 'TT-100',
  supplierName: 'Gulf Supplier',
  shipId: 'ship-1',
  shipName: 'Gulf Star',
  shipNumber: 'GS-1',
  tripNumber: 'TRIP-1',
  tripTime: 1,
  driverName: 'Driver One',
  driverMobile: '971500000000',
  driverTdCardNumber: 'TD-1',
  truckModel: 'sixAxis',
  destination: 'dubai',
};

const makeEntry = (id, headTruckNumber, tailTrailerNumber, updates) => ({
  ...baseEntry,
  _id: id,
  headTruckNumber,
  tailTrailerNumber,
  updates,
});

const makeStoredEntry = (id, createdAt, updates) => ({
  ...baseEntry,
  _id: id,
  createdAt,
  updates,
});

const at = (day) => new Date(`2026-05-${String(day).padStart(2, '0')}T08:00:00.000Z`);

const publicEntries = [
  serializePublicTruckEntry(
    makeEntry('entry-yard', 'HT-101', 'TT-101', [
      { stop: 'yard', status: 'entry', updatedAt: at(1), teamName: 'Yard Team', memberName: 'Yard Member' },
    ])
  ),
  serializePublicTruckEntry(
    makeEntry('entry-moving', 'HT-102', 'TT-102', [
      { stop: 'yard', status: 'entry', updatedAt: at(1), teamName: 'Yard Team', memberName: 'Yard Member' },
      { stop: 'yard', status: 'exit', updatedAt: at(2), teamName: 'Yard Team', memberName: 'Yard Member' },
    ])
  ),
  serializePublicTruckEntry(
    makeEntry('entry-gate', 'HT-103', 'TT-103', [
      { stop: 'yard', status: 'entry', updatedAt: at(1) },
      { stop: 'yard', status: 'exit', updatedAt: at(2) },
      { stop: 'gate', status: 'entry', updatedAt: at(3) },
    ])
  ),
  serializePublicTruckEntry(
    makeEntry('entry-completed', 'HT-104', 'TT-104', [
      { stop: 'yard', status: 'entry', updatedAt: at(1) },
      { stop: 'yard', status: 'exit', updatedAt: at(2) },
      { stop: 'gate', status: 'entry', updatedAt: at(3) },
      { stop: 'gate', status: 'exit', updatedAt: at(4) },
      { stop: 'port', status: 'entry', updatedAt: at(5) },
      { stop: 'port', status: 'exit', updatedAt: at(6) },
      { stop: 'clearence', status: 'entry', updatedAt: at(7) },
      { stop: 'clearence', status: 'exit', updatedAt: at(8) },
      { stop: 'dubai', status: 'entry', updatedAt: at(9) },
      { stop: 'dubai', status: 'exit', updatedAt: at(10) },
    ])
  ),
];

const counts = buildDashboardCounts(publicEntries);

assert.strictEqual(publicEntries[0].workflowStatus, 'active');
assert.strictEqual(publicEntries[0].currentStop, 'yard');
assert.strictEqual(publicEntries[0].currentStatus, 'entry');
assert.strictEqual(publicEntries[0].nextStop, 'gate');
assert.strictEqual(publicEntries[0].originStop, 'yard');
assert.strictEqual(publicEntries[0].currentAllowedRole, 'yard');
assert.strictEqual(publicEntries[0].currentAction, 'exit');
assert.strictEqual(publicEntries[0].driverName, 'Driver One');
assert.strictEqual(publicEntries[0].destination, 'dubai');
assert.strictEqual(publicEntries[0].updates[0].teamName, 'Yard Team');
assert.strictEqual(publicEntries[3].workflowStatus, 'completed');
assert.strictEqual(publicEntries[3].currentStop, 'dubai');
assert.strictEqual(publicEntries[3].currentStatus, 'completed');
assert.strictEqual(publicEntries[3].currentAllowedRole, null);
assert.strictEqual(publicEntries[3].currentAction, null);

assert.deepStrictEqual(counts, {
  totalActive: 3,
  moving: 1,
  exitedDubai: 1,
  stops: {
    yard: 1,
    gate: 1,
    port: 0,
    clearence: 0,
    dubai: 0,
  },
  routes: {
    yardToGate: 1,
    gateToPort: 0,
    portToClearence: 0,
    clearenceToDubai: 0,
  },
});

const range = getDashboardDateRange('2026-05-14');

assert.strictEqual(range.start.getFullYear(), 2026);
assert.strictEqual(range.start.getMonth(), 4);
assert.strictEqual(range.start.getDate(), 14);
assert.strictEqual(range.start.getHours(), 0);
assert.strictEqual(range.start.getMinutes(), 0);
assert.strictEqual(range.end.getFullYear(), 2026);
assert.strictEqual(range.end.getMonth(), 4);
assert.strictEqual(range.end.getDate(), 15);
assert.strictEqual(range.end.getHours(), 0);
assert.strictEqual(range.end.getMinutes(), 0);
assert.strictEqual(getDashboardDateRange('2026-02-30'), null);
assert.strictEqual(getDashboardDateRange('14-05-2026'), null);

const dateFilter = buildDashboardDateFilter('2026-05-14');

assert.deepStrictEqual(dateFilter.updates.$elemMatch.updatedAt, {
  $gte: range.start,
  $lt: range.end,
});
assert.strictEqual(Object.keys(dateFilter.updates.$elemMatch).length, 1);
assert.strictEqual(buildDashboardDateFilter('2026-13-01'), null);

const datedEntries = [
  makeStoredEntry('may-13-entry', at(5), [{ stop: 'yard', status: 'entry', updatedAt: at(13) }]),
  makeStoredEntry('may-5-entry', at(13), [{ stop: 'yard', status: 'entry', updatedAt: at(5) }]),
  makeStoredEntry('may-5-created', at(5), []),
  makeStoredEntry('may-5-gate', at(1), [
    { stop: 'yard', status: 'entry', updatedAt: at(1) },
    { stop: 'gate', status: 'entry', updatedAt: at(5) },
  ]),
];

assert.deepStrictEqual(
  filterDashboardTruckEntriesByDate(datedEntries, '2026-05-05').map((entry) => entry._id),
  ['may-5-entry', 'may-5-gate']
);
assert.deepStrictEqual(
  filterDashboardTruckEntriesByDate(datedEntries, '2026-05-13').map((entry) => entry._id),
  ['may-13-entry']
);

const selectedDateRange = getDashboardDateRange('2026-05-05');
const selectedDateEntries = [
  serializePublicTruckEntry(
    makeEntry('selected-yard', 'HT-201', 'TT-201', [
      { stop: 'yard', status: 'entry', updatedAt: at(5) },
      { stop: 'gate', status: 'entry', updatedAt: at(6) },
    ]),
    { dateRange: selectedDateRange }
  ),
  serializePublicTruckEntry(
    makeEntry('selected-moving', 'HT-202', 'TT-202', [
      { stop: 'yard', status: 'entry', updatedAt: at(5) },
      { stop: 'yard', status: 'exit', updatedAt: new Date('2026-05-05T09:00:00.000Z') },
      { stop: 'gate', status: 'entry', updatedAt: at(6) },
    ]),
    { dateRange: selectedDateRange }
  ),
  serializePublicTruckEntry(
    makeEntry('selected-exited', 'HT-203', 'TT-203', [
      { stop: 'dubai', status: 'entry', updatedAt: at(4) },
      { stop: 'dubai', status: 'exit', updatedAt: at(5) },
    ]),
    { dateRange: selectedDateRange }
  ),
];

assert.strictEqual(selectedDateEntries[0].currentStop, 'yard');
assert.strictEqual(selectedDateEntries[0].currentStatus, 'entry');
assert.strictEqual(selectedDateEntries[1].currentStop, 'yard');
assert.strictEqual(selectedDateEntries[1].currentStatus, 'exit');
assert.deepStrictEqual(buildDashboardCounts(selectedDateEntries, { dateScoped: true }), {
  totalActive: 3,
  moving: 1,
  exitedDubai: 1,
  stops: {
    yard: 1,
    gate: 0,
    port: 0,
    clearence: 0,
    dubai: 0,
  },
  routes: {
    yardToGate: 1,
    gateToPort: 0,
    portToClearence: 0,
    clearenceToDubai: 0,
  },
});

const gateOriginFreeZoneEntry = serializePublicTruckEntry({
  ...baseEntry,
  _id: 'gate-origin-free-zone',
  destination: 'freezone',
  originStop: 'gate',
  updates: [
    { stop: 'gate', status: 'entry', updatedAt: at(1) },
    { stop: 'gate', status: 'exit', updatedAt: at(2) },
    { stop: 'port', status: 'entry', updatedAt: at(3) },
    { stop: 'port', status: 'exit', updatedAt: at(4) },
    { stop: 'clearence', status: 'entry', updatedAt: at(5) },
    { stop: 'clearence', status: 'exit', updatedAt: at(6) },
    { stop: 'dubai', status: 'entry', updatedAt: at(7) },
    { stop: 'dubai', status: 'exit', updatedAt: at(8) },
  ],
});

assert.strictEqual(gateOriginFreeZoneEntry.destination, 'freezone');
assert.strictEqual(gateOriginFreeZoneEntry.originStop, 'gate');
assert.strictEqual(gateOriginFreeZoneEntry.workflowStatus, 'completed');
assert.strictEqual(gateOriginFreeZoneEntry.currentStop, 'dubai');
assert.strictEqual(gateOriginFreeZoneEntry.currentStatus, 'completed');

console.log('public dashboard controller tests passed');
