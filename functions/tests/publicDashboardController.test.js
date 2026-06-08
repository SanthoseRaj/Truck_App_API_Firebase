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
      { stop: 'clearence', status: 'exit', updatedAt: at(8) },
      { stop: 'dubai', status: 'completed', destination: 'dubai', updatedAt: at(10) },
    ])
  ),
];

const counts = buildDashboardCounts(publicEntries);
const canceledPublicEntry = serializePublicTruckEntry({
  ...baseEntry,
  _id: 'entry-canceled',
  workflowStatus: 'canceled',
  currentStatus: 'canceled',
  updates: [
    { stop: 'yard', status: 'entry', updatedAt: at(1) },
    { stop: 'yard', status: 'canceled', updatedAt: at(2) },
  ],
});
const waitingAtCustomClearence = serializePublicTruckEntry(
  makeEntry('entry-clearence', 'HT-105', 'TT-105', [
    { stop: 'yard', status: 'entry', updatedAt: at(1) },
    { stop: 'yard', status: 'exit', updatedAt: at(2) },
    { stop: 'gate', status: 'entry', updatedAt: at(3) },
    { stop: 'gate', status: 'exit', updatedAt: at(4) },
    { stop: 'port', status: 'entry', updatedAt: at(5) },
    { stop: 'port', status: 'exit', updatedAt: at(6) },
  ])
);
const afterFreeZoneCustomClearenceExit = serializePublicTruckEntry({
  ...baseEntry,
  _id: 'entry-freezone-after-clearence',
  destination: 'freezone',
  updates: [
    { stop: 'yard', status: 'entry', updatedAt: at(1) },
    { stop: 'yard', status: 'exit', updatedAt: at(2) },
    { stop: 'gate', status: 'entry', updatedAt: at(3) },
    { stop: 'gate', status: 'exit', updatedAt: at(4) },
    { stop: 'port', status: 'entry', updatedAt: at(5) },
    { stop: 'port', status: 'exit', updatedAt: at(6) },
    { stop: 'clearence', status: 'exit', updatedAt: at(7) },
  ],
});

assert.strictEqual(publicEntries[0].workflowStatus, 'active');
assert.strictEqual(publicEntries[0].currentStop, 'yard');
assert.strictEqual(publicEntries[0].currentStatus, 'entry');
assert.strictEqual(publicEntries[0].nextStop, 'portLoading');
assert.strictEqual(publicEntries[0].originStop, 'yard');
assert.strictEqual(publicEntries[0].currentAllowedRole, 'yard');
assert.strictEqual(publicEntries[0].currentAction, 'exit');
assert.strictEqual(publicEntries[0].driverName, 'Driver One');
assert.strictEqual(publicEntries[0].destination, 'dubai');
assert.strictEqual(publicEntries[0].truckModel, '6 Wheel');
assert.strictEqual(publicEntries[0].updates[0].teamName, 'Yard Team');
assert.strictEqual(publicEntries[3].workflowStatus, 'completed');
assert.strictEqual(publicEntries[3].currentStop, 'dubai');
assert.strictEqual(publicEntries[3].currentStatus, 'completed');
assert.strictEqual(publicEntries[3].currentAllowedRole, null);
assert.strictEqual(publicEntries[3].currentAction, null);
assert.strictEqual(publicEntries[3].updates.at(-1).stop, 'dubai');
assert.strictEqual(publicEntries[3].updates.at(-1).destination, 'dubai');
assert.strictEqual(canceledPublicEntry.workflowStatus, 'canceled');
assert.strictEqual(canceledPublicEntry.currentStatus, 'canceled');
assert.strictEqual(canceledPublicEntry.currentAllowedRole, null);
assert.strictEqual(canceledPublicEntry.currentAllowedStop, null);
assert.strictEqual(canceledPublicEntry.currentAction, null);
assert.strictEqual(waitingAtCustomClearence.currentAllowedRole, 'clearence');
assert.strictEqual(waitingAtCustomClearence.currentAllowedStop, 'clearence');
assert.strictEqual(waitingAtCustomClearence.currentAction, 'exit');
assert.strictEqual(
  waitingAtCustomClearence.updates.some((update) => update.stop === 'clearence' && update.status === 'entry'),
  false
);
assert.strictEqual(afterFreeZoneCustomClearenceExit.currentAllowedRole, 'freezone');
assert.strictEqual(afterFreeZoneCustomClearenceExit.currentAllowedStop, 'freezone');
assert.strictEqual(afterFreeZoneCustomClearenceExit.currentAction, 'entry');
assert.strictEqual(
  afterFreeZoneCustomClearenceExit.updates.some((update) => update.stop === 'clearence'),
  false
);
const afterDubaiCustomClearenceExit = serializePublicTruckEntry({
  ...baseEntry,
  _id: 'entry-dubai-after-clearence',
  destination: 'dubai',
  updates: [
    { stop: 'yard', status: 'entry', updatedAt: at(1) },
    { stop: 'yard', status: 'exit', updatedAt: at(2) },
    { stop: 'gate', status: 'entry', updatedAt: at(3) },
    { stop: 'gate', status: 'exit', updatedAt: at(4) },
    { stop: 'port', status: 'entry', updatedAt: at(5) },
    { stop: 'port', status: 'exit', updatedAt: at(6) },
    { stop: 'clearence', status: 'exit', updatedAt: at(7) },
  ],
});
assert.strictEqual(afterDubaiCustomClearenceExit.workflowStatus, 'active');
assert.strictEqual(afterDubaiCustomClearenceExit.currentAllowedRole, 'yard');
assert.strictEqual(afterDubaiCustomClearenceExit.currentAllowedStop, 'yard');
assert.strictEqual(afterDubaiCustomClearenceExit.currentAction, null);

const customClearenceExitCounts = buildDashboardCounts([
  afterDubaiCustomClearenceExit,
  afterFreeZoneCustomClearenceExit,
]);

assert.strictEqual(customClearenceExitCounts.routes.clearenceToDubai, 1);
assert.strictEqual(customClearenceExitCounts.routes.portToFreezone, 1);
assert.strictEqual(customClearenceExitCounts.routes.clearenceToFreezone, 0);
assert.strictEqual(customClearenceExitCounts.moving, 2);
assert.strictEqual(customClearenceExitCounts.totalActive, 2);

const freezoneDubaiAfterYardExit = serializePublicTruckEntry({
  ...baseEntry,
  _id: 'entry-freezone-dubai-yard-exit',
  destination: 'freezoneanddubai',
  updates: [
    { stop: 'yard', status: 'entry', updatedAt: at(1) },
    { stop: 'yard', status: 'exit', updatedAt: at(2) },
  ],
});
const freezoneDubaiAfterFreezoneExit = serializePublicTruckEntry({
  ...baseEntry,
  _id: 'entry-freezone-dubai-freezone-exit',
  destination: 'freeZoneDubai',
  updates: [
    { stop: 'yard', status: 'entry', updatedAt: at(1) },
    { stop: 'yard', status: 'exit', updatedAt: at(2) },
    { stop: 'freezone', status: 'entry', updatedAt: at(3) },
    { stop: 'freezone', status: 'exit', updatedAt: at(4) },
  ],
});
const freezoneDubaiCounts = buildDashboardCounts([freezoneDubaiAfterYardExit, freezoneDubaiAfterFreezoneExit]);

assert.strictEqual(freezoneDubaiAfterYardExit.destination, 'freezoneDubai');
assert.strictEqual(freezoneDubaiAfterYardExit.nextStop, 'freezone');
assert.strictEqual(freezoneDubaiAfterYardExit.movementStatus, 'yardToFreezone');
assert.strictEqual(freezoneDubaiAfterFreezoneExit.nextStop, 'dubai');
assert.strictEqual(freezoneDubaiAfterFreezoneExit.movementStatus, 'freezoneToDubai');
assert.strictEqual(freezoneDubaiCounts.routes.yardToFreezone, 1);
assert.strictEqual(freezoneDubaiCounts.routes.freezoneToDubai, 1);
assert.strictEqual(freezoneDubaiCounts.moving, 2);

assert.deepStrictEqual(counts, {
  totalActive: 3,
  totalTrucks: 3,
  moving: 1,
  exitedDubai: 0,
  stops: {
    yard: 1,
    portLoading: 1,
    clearence: 0,
    dubai: 0,
    freezone: 0,
  },
  routes: {
    yardToPortLoading: 1,
    yardToFreezone: 0,
    portToClearence: 0,
    portToFreezone: 0,
    clearenceToDubai: 0,
    clearenceToFreezone: 0,
    freezoneToDubai: 0,
    dubaiToYard: 0,
    freezoneToPortLoading: 0,
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
  totalTrucks: 3,
  moving: 2,
  exitedDubai: 1,
  stops: {
    yard: 1,
    portLoading: 0,
    clearence: 0,
    dubai: 0,
    freezone: 0,
  },
  routes: {
    yardToPortLoading: 1,
    yardToFreezone: 0,
    portToClearence: 0,
    portToFreezone: 0,
    clearenceToDubai: 0,
    clearenceToFreezone: 0,
    freezoneToDubai: 0,
    dubaiToYard: 1,
    freezoneToPortLoading: 0,
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
    { stop: 'clearence', status: 'exit', updatedAt: at(6) },
    { stop: 'dubai', status: 'entry', updatedAt: at(7) },
    { stop: 'dubai', status: 'exit', updatedAt: at(8) },
  ],
});

assert.strictEqual(gateOriginFreeZoneEntry.destination, 'freezone');
assert.strictEqual(gateOriginFreeZoneEntry.originStop, 'portLoading');
assert.strictEqual(gateOriginFreeZoneEntry.workflowStatus, 'active');
assert.strictEqual(gateOriginFreeZoneEntry.currentStop, 'freezone');
assert.strictEqual(gateOriginFreeZoneEntry.currentStatus, 'exit');
assert.strictEqual(gateOriginFreeZoneEntry.currentAllowedRole, 'portLoading');
assert.strictEqual(gateOriginFreeZoneEntry.currentAllowedStop, 'portLoading');
assert.strictEqual(gateOriginFreeZoneEntry.currentAction, 'entry');
assert.strictEqual(gateOriginFreeZoneEntry.currentLocation, 'Moving');
assert.strictEqual(gateOriginFreeZoneEntry.from, 'Free Zone');
assert.strictEqual(gateOriginFreeZoneEntry.to, 'Port Loading');
assert.strictEqual(gateOriginFreeZoneEntry.movementStatus, 'freezoneToPort');
assert.strictEqual(gateOriginFreeZoneEntry.nextStop, 'portLoading');

const completedGateOriginFreeZoneEntry = serializePublicTruckEntry({
  ...baseEntry,
  _id: 'completed-gate-origin-free-zone',
  destination: 'freezone',
  originStop: 'gate',
  updates: [
    ...gateOriginFreeZoneEntry.updates,
    { stop: 'gate', status: 'entry', updatedAt: at(9) },
    { stop: 'gate', status: 'completed', updatedAt: at(9) },
  ],
});

const completedFreeZoneCounts = buildDashboardCounts([completedGateOriginFreeZoneEntry]);

assert.deepStrictEqual(completedFreeZoneCounts, {
  totalActive: 1,
  totalTrucks: 1,
  moving: 0,
  exitedDubai: 0,
  stops: {
    yard: 0,
    portLoading: 1,
    clearence: 0,
    dubai: 0,
    freezone: 0,
  },
  routes: {
    yardToPortLoading: 0,
    yardToFreezone: 0,
    portToClearence: 0,
    portToFreezone: 0,
    clearenceToDubai: 0,
    clearenceToFreezone: 0,
    freezoneToDubai: 0,
    dubaiToYard: 0,
    freezoneToPortLoading: 0,
  },
});

const pendingFreeZoneToGateCounts = buildDashboardCounts([gateOriginFreeZoneEntry]);

assert.deepStrictEqual(pendingFreeZoneToGateCounts, {
  totalActive: 1,
  totalTrucks: 1,
  moving: 1,
  exitedDubai: 0,
  stops: {
    yard: 0,
    portLoading: 0,
    clearence: 0,
    dubai: 0,
    freezone: 0,
  },
  routes: {
    yardToPortLoading: 0,
    yardToFreezone: 0,
    portToClearence: 0,
    portToFreezone: 0,
    clearenceToDubai: 0,
    clearenceToFreezone: 0,
    freezoneToDubai: 0,
    dubaiToYard: 0,
    freezoneToPortLoading: 1,
  },
});

const completedDubaiCounts = buildDashboardCounts([publicEntries[3]]);

assert.deepStrictEqual(completedDubaiCounts, {
  totalActive: 0,
  totalTrucks: 0,
  moving: 0,
  exitedDubai: 0,
  stops: {
    yard: 0,
    portLoading: 0,
    clearence: 0,
    dubai: 0,
    freezone: 0,
  },
  routes: {
    yardToPortLoading: 0,
    yardToFreezone: 0,
    portToClearence: 0,
    portToFreezone: 0,
    clearenceToDubai: 0,
    clearenceToFreezone: 0,
    freezoneToDubai: 0,
    dubaiToYard: 0,
    freezoneToPortLoading: 0,
  },
});

const canceledCounts = buildDashboardCounts([canceledPublicEntry]);

assert.deepStrictEqual(canceledCounts, {
  totalActive: 0,
  totalTrucks: 0,
  moving: 0,
  exitedDubai: 0,
  stops: {
    yard: 0,
    portLoading: 0,
    clearence: 0,
    dubai: 0,
    freezone: 0,
  },
  routes: {
    yardToPortLoading: 0,
    yardToFreezone: 0,
    portToClearence: 0,
    portToFreezone: 0,
    clearenceToDubai: 0,
    clearenceToFreezone: 0,
    freezoneToDubai: 0,
    dubaiToYard: 0,
    freezoneToPortLoading: 0,
  },
});

console.log('public dashboard controller tests passed');
