const assert = require('assert');
const mongoose = require('mongoose');
const Ship = require('../models/Ship');
const Supplier = require('../models/Supplier');
const Truck = require('../models/Truck');
const TruckEntry = require('../models/TruckEntry');
const {
  createTruckEntry,
  cancelTruckEntry,
  getWorkflowState,
  markGateReturnEntry,
  markTeamEntry,
  resolveEntryDestinationUpdate,
  resolveOriginStopForDestination,
  serializeTruckEntry,
  validateOriginCycle,
} = require('../controllers/truckEntryController');

const baseEntry = {
  _id: 'entry-1',
  truckId: '507f1f77bcf86cd799439010',
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

const at = (minute) => new Date(`2026-05-01T08:${String(minute).padStart(2, '0')}:00.000Z`);

const yardOrigin = {
  ...baseEntry,
  originStop: 'yard',
  updates: [{ stop: 'yard', status: 'entry', updatedAt: at(0), teamName: 'Yard Team', memberName: 'Yard Member' }],
};

const gateOrigin = {
  ...baseEntry,
  _id: 'entry-2',
  destination: 'freezone',
  originStop: 'gate',
  updates: [{ stop: 'gate', status: 'entry', updatedAt: at(0), teamName: 'Gate Team', memberName: 'Gate Member' }],
};

const completedGateOrigin = {
  ...gateOrigin,
  updates: [
    { stop: 'gate', status: 'entry', updatedAt: at(0) },
    { stop: 'gate', status: 'exit', updatedAt: at(1) },
    { stop: 'port', status: 'entry', updatedAt: at(2) },
    { stop: 'port', status: 'exit', updatedAt: at(3) },
    { stop: 'clearence', status: 'exit', updatedAt: at(5) },
    { stop: 'dubai', status: 'entry', updatedAt: at(6) },
    { stop: 'dubai', status: 'exit', updatedAt: at(7) },
  ],
};

const completedFreeZoneAtGate = {
  ...completedGateOrigin,
  updates: [
    ...completedGateOrigin.updates,
    { stop: 'gate', status: 'entry', updatedAt: at(8) },
    { stop: 'gate', status: 'completed', updatedAt: at(8) },
  ],
};

const waitingAtCustomClearence = {
  ...baseEntry,
  updates: [
    { stop: 'yard', status: 'entry', updatedAt: at(0) },
    { stop: 'yard', status: 'exit', updatedAt: at(1) },
    { stop: 'gate', status: 'entry', updatedAt: at(2) },
    { stop: 'gate', status: 'exit', updatedAt: at(3) },
    { stop: 'port', status: 'entry', updatedAt: at(4) },
    { stop: 'port', status: 'exit', updatedAt: at(5) },
  ],
};

const afterCustomClearenceExit = {
  ...waitingAtCustomClearence,
  updates: [
    ...waitingAtCustomClearence.updates,
    { stop: 'clearence', status: 'exit', updatedAt: at(6) },
  ],
};

const freeZoneAfterPortExit = {
  ...waitingAtCustomClearence,
  destination: 'freezone',
};

const freezoneDubaiAfterYardExit = {
  ...baseEntry,
  destination: 'freeZoneDubai',
  updates: [
    { stop: 'yard', status: 'entry', updatedAt: at(1) },
    { stop: 'yard', status: 'exit', updatedAt: at(2) },
  ],
};

const freezoneDubaiAfterFreezoneExit = {
  ...freezoneDubaiAfterYardExit,
  updates: [
    ...freezoneDubaiAfterYardExit.updates,
    { stop: 'freezone', status: 'entry', updatedAt: at(3) },
    { stop: 'freezone', status: 'exit', updatedAt: at(4) },
  ],
};

const freezoneDubaiAfterDubaiExit = {
  ...freezoneDubaiAfterFreezoneExit,
  updates: [
    ...freezoneDubaiAfterFreezoneExit.updates,
    { stop: 'dubai', status: 'entry', updatedAt: at(5) },
    { stop: 'dubai', status: 'exit', updatedAt: at(6) },
  ],
};

assert.deepStrictEqual(getWorkflowState(yardOrigin), {
  currentAllowedRole: 'yard',
  currentAllowedStop: 'yard',
  currentAction: 'exit',
  workflowStatus: 'pending',
  nextRole: 'yard',
  nextStop: 'yard',
});

assert.deepStrictEqual(getWorkflowState(gateOrigin), {
  currentAllowedRole: 'port',
  currentAllowedStop: 'port',
  currentAction: 'exit',
  workflowStatus: 'pending',
  nextRole: 'port',
  nextStop: 'port',
});

assert.deepStrictEqual(getWorkflowState(waitingAtCustomClearence), {
  currentAllowedRole: 'clearence',
  currentAllowedStop: 'clearence',
  currentAction: 'exit',
  workflowStatus: 'pending',
  nextRole: 'clearence',
  nextStop: 'clearence',
});

assert.deepStrictEqual(getWorkflowState(afterCustomClearenceExit), {
  currentAllowedRole: 'yard',
  currentAllowedStop: 'yard',
  currentAction: null,
  workflowStatus: 'pending',
  nextRole: 'yard',
  nextStop: 'yard',
});

assert.deepStrictEqual(getWorkflowState(freeZoneAfterPortExit), {
  currentAllowedRole: 'freezone',
  currentAllowedStop: 'freezone',
  currentAction: 'entry',
  workflowStatus: 'pending',
  nextRole: 'freezone',
  nextStop: 'freezone',
});

assert.deepStrictEqual(getWorkflowState(freezoneDubaiAfterYardExit), {
  currentAllowedRole: 'freezone',
  currentAllowedStop: 'freezone',
  currentAction: 'entry',
  workflowStatus: 'pending',
  nextRole: 'freezone',
  nextStop: 'freezone',
});

assert.deepStrictEqual(getWorkflowState(freezoneDubaiAfterFreezoneExit), {
  currentAllowedRole: 'dubai',
  currentAllowedStop: 'dubai',
  currentAction: 'entry',
  workflowStatus: 'pending',
  nextRole: 'dubai',
  nextStop: 'dubai',
});

assert.deepStrictEqual(getWorkflowState(freezoneDubaiAfterDubaiExit), {
  currentAllowedRole: 'yard',
  currentAllowedStop: 'yard',
  currentAction: null,
  workflowStatus: 'pending',
  nextRole: 'yard',
  nextStop: 'yard',
});

assert.deepStrictEqual(getWorkflowState(completedGateOrigin), {
  currentAllowedRole: 'port',
  currentAllowedStop: 'port',
  currentAction: 'entry',
  workflowStatus: 'pending',
  nextRole: 'port',
  nextStop: 'port',
});

assert.deepStrictEqual(getWorkflowState(completedFreeZoneAtGate), {
  currentAllowedRole: 'port',
  currentAllowedStop: 'port',
  currentAction: null,
  workflowStatus: 'completed',
  nextRole: 'port',
  nextStop: 'port',
});

const serializedGateOrigin = serializeTruckEntry(gateOrigin);
const serializedLegacyFreeZone = serializeTruckEntry({ ...gateOrigin, destination: 'Free Zone' });
const serializedWaitingAtCustomClearence = serializeTruckEntry(waitingAtCustomClearence);
const serializedFreeZoneAfterPortExit = serializeTruckEntry(freeZoneAfterPortExit);
const serializedAfterFreeZoneCustomClearenceExit = serializeTruckEntry({
  ...afterCustomClearenceExit,
  destination: 'freezone',
});
const serializedAfterFreeZoneExit = serializeTruckEntry(completedGateOrigin);
const serializedFreezoneDubaiAfterYardExit = serializeTruckEntry(freezoneDubaiAfterYardExit);
const serializedFreezoneDubaiAfterFreezoneExit = serializeTruckEntry(freezoneDubaiAfterFreezoneExit);
const serializedFreezoneDubaiAfterDubaiExit = serializeTruckEntry(freezoneDubaiAfterDubaiExit);

assert.strictEqual(serializedGateOrigin.destination, 'freezone');
assert.strictEqual(serializedLegacyFreeZone.destination, 'freezone');
assert.strictEqual(serializedFreezoneDubaiAfterYardExit.destination, 'freezoneDubai');
assert.strictEqual(serializedFreezoneDubaiAfterYardExit.dubaiFreeZoneDestination, 'freezoneDubai');
assert.strictEqual(serializedFreezoneDubaiAfterYardExit.nextStop, 'freezone');
assert.strictEqual(serializedFreezoneDubaiAfterYardExit.movementStatus, 'yardToFreezone');
assert.strictEqual(serializedFreezoneDubaiAfterYardExit.from, 'Yard');
assert.strictEqual(serializedFreezoneDubaiAfterYardExit.to, 'Free Zone');
assert.strictEqual(serializedFreezoneDubaiAfterFreezoneExit.nextStop, 'dubai');
assert.strictEqual(serializedFreezoneDubaiAfterFreezoneExit.movementStatus, 'freezoneToDubai');
assert.strictEqual(serializedFreezoneDubaiAfterFreezoneExit.from, 'Free Zone');
assert.strictEqual(serializedFreezoneDubaiAfterFreezoneExit.to, 'Dubai');
assert.strictEqual(serializedFreezoneDubaiAfterDubaiExit.workflowStatus, 'pending');
assert.strictEqual(serializedFreezoneDubaiAfterDubaiExit.currentAllowedRole, 'yard');
assert.strictEqual(serializedFreezoneDubaiAfterDubaiExit.nextStop, null);
assert.strictEqual(serializedGateOrigin.truckModel, '6 Wheel');
assert.strictEqual(serializedGateOrigin.originStop, 'portLoading');
assert.strictEqual(serializedGateOrigin.currentStop, 'portLoading');
assert.strictEqual(serializedGateOrigin.currentStatus, 'entry');
assert.strictEqual(serializedGateOrigin.currentAllowedRole, 'portLoading');
assert.strictEqual(serializedGateOrigin.currentAction, 'exit');
assert.strictEqual(serializedGateOrigin.nextStop, 'freezone');
assert.strictEqual(serializedWaitingAtCustomClearence.currentAllowedRole, 'clearence');
assert.strictEqual(serializedWaitingAtCustomClearence.currentAllowedStop, 'clearence');
assert.strictEqual(serializedWaitingAtCustomClearence.currentAction, 'exit');
assert.strictEqual(serializedFreeZoneAfterPortExit.currentStop, 'portLoading');
assert.strictEqual(serializedFreeZoneAfterPortExit.nextStop, 'freezone');
assert.strictEqual(
  serializedWaitingAtCustomClearence.updates.some(
    (update) => update.stop === 'clearence' && update.status === 'entry'
  ),
  false
);
assert.strictEqual(serializedAfterFreeZoneCustomClearenceExit.currentAllowedRole, 'freezone');
assert.strictEqual(serializedAfterFreeZoneCustomClearenceExit.currentAllowedStop, 'freezone');
assert.strictEqual(serializedAfterFreeZoneCustomClearenceExit.currentAction, 'entry');
assert.strictEqual(
  serializedAfterFreeZoneCustomClearenceExit.updates.some((update) => update.stop === 'clearence'),
  false
);
assert.strictEqual(serializedAfterFreeZoneExit.workflowStatus, 'pending');
assert.strictEqual(serializedAfterFreeZoneExit.currentAllowedRole, 'portLoading');
assert.strictEqual(serializedAfterFreeZoneExit.currentAllowedStop, 'portLoading');
assert.strictEqual(serializedAfterFreeZoneExit.currentAction, 'entry');
assert.strictEqual(serializedAfterFreeZoneExit.currentLocation, 'Moving');
assert.strictEqual(serializedAfterFreeZoneExit.from, 'Free Zone');
assert.strictEqual(serializedAfterFreeZoneExit.to, 'Port Loading');
assert.strictEqual(serializedAfterFreeZoneExit.movementStatus, 'freezoneToPort');
assert.strictEqual(serializedAfterFreeZoneExit.nextStop, 'portLoading');
const serializedAfterDubaiCustomClearenceExit = serializeTruckEntry(afterCustomClearenceExit);
assert.strictEqual(serializedAfterDubaiCustomClearenceExit.currentAllowedRole, 'yard');
assert.strictEqual(serializedAfterDubaiCustomClearenceExit.currentAllowedStop, 'yard');
assert.strictEqual(serializedAfterDubaiCustomClearenceExit.currentAction, null);
assert.strictEqual(serializedAfterDubaiCustomClearenceExit.workflowStatus, 'pending');
assert.notStrictEqual(serializedAfterDubaiCustomClearenceExit.currentAllowedRole, 'dubai');

const canceledEntry = {
  ...yardOrigin,
  workflowStatus: 'canceled',
  currentStatus: 'canceled',
  updates: [
    ...yardOrigin.updates,
    {
      stop: 'yard',
      status: 'canceled',
      updatedAt: at(2),
      teamName: 'Owner',
      memberName: 'Owner User',
      remarks: 'Duplicate trip',
    },
  ],
};
const serializedCanceledEntry = serializeTruckEntry(canceledEntry);

assert.deepStrictEqual(getWorkflowState(canceledEntry), {
  currentAllowedRole: null,
  currentAllowedStop: null,
  currentAction: null,
  workflowStatus: 'canceled',
  nextRole: null,
  nextStop: null,
});
assert.strictEqual(serializedCanceledEntry.workflowStatus, 'canceled');
assert.strictEqual(serializedCanceledEntry.currentStatus, 'canceled');
assert.strictEqual(serializedCanceledEntry.currentAllowedRole, null);
assert.strictEqual(serializedCanceledEntry.currentAllowedStop, null);
assert.strictEqual(serializedCanceledEntry.currentAction, null);
assert.strictEqual(serializedCanceledEntry.nextStop, null);
assert.strictEqual(serializedCanceledEntry.movementStatus, undefined);

assert.strictEqual(validateOriginCycle('yard', null), null);
assert.strictEqual(validateOriginCycle('yard', { destination: 'dubai' }), null);
assert.strictEqual(
  validateOriginCycle('yard', { destination: 'freezone' }),
  'This truck completed Free Zone, so the next trip can be added only at Port Loading'
);
assert.strictEqual(validateOriginCycle('gate', null), null);
assert.strictEqual(
  validateOriginCycle('gate', { destination: 'dubai' }),
  'This truck completed Dubai, so the next trip can be added only at Yard'
);
assert.strictEqual(validateOriginCycle('gate', { destination: 'freezone' }), null);
assert.strictEqual(validateOriginCycle('gate', { destination: 'free_zone' }), null);

assert.deepStrictEqual(resolveEntryDestinationUpdate({ destination: 'dubai' }, {}), {
  destination: 'dubai',
});
assert.deepStrictEqual(resolveEntryDestinationUpdate({ destination: 'freezone' }, {}), {
  destination: 'freezone',
});
assert.deepStrictEqual(resolveEntryDestinationUpdate({ destination: 'Free Zone' }, { destination: 'free_zone' }), {
  destination: 'freezone',
});
assert.deepStrictEqual(resolveEntryDestinationUpdate({ destination: undefined }, { destination: 'freeZone' }), {
  destination: 'freezone',
});
assert.deepStrictEqual(resolveEntryDestinationUpdate({ destination: undefined }, { destination: 'freeZoneDubai' }), {
  destination: 'freezoneDubai',
});
assert.deepStrictEqual(resolveEntryDestinationUpdate({ destination: undefined }, { destination: 'freezoneanddubai' }), {
  destination: 'freezoneDubai',
});
assert.deepStrictEqual(resolveEntryDestinationUpdate({ destination: undefined }, {}), {
  error: { status: 400, message: 'Dubai or Free Zone destination is required' },
});
assert.deepStrictEqual(resolveEntryDestinationUpdate({ destination: 'dubai' }, { destination: 'freeZone' }), {
  error: { status: 400, message: 'destination cannot be updated here' },
});

assert.deepStrictEqual(resolveOriginStopForDestination('freeZone'), {
  originStop: 'yard',
});
assert.deepStrictEqual(resolveOriginStopForDestination('dubai'), {
  originStop: 'yard',
});
assert.deepStrictEqual(resolveOriginStopForDestination('free_zone', 'gate'), {
  originStop: 'portLoading',
});
assert.deepStrictEqual(resolveOriginStopForDestination('dubai', 'yard'), {
  originStop: 'yard',
});
assert.deepStrictEqual(resolveOriginStopForDestination('freeZone', 'yard'), {
  originStop: 'yard',
});
assert.deepStrictEqual(resolveOriginStopForDestination('dubai', 'gate'), {
  originStop: 'portLoading',
});
assert.deepStrictEqual(resolveOriginStopForDestination('freeZone', 'YARD'), {
  originStop: 'yard',
});
assert.deepStrictEqual(resolveOriginStopForDestination('freeZoneDubai', 'yard'), {
  originStop: 'yard',
});
assert.deepStrictEqual(resolveOriginStopForDestination('freezoneanddubai', undefined), {
  originStop: 'yard',
});
assert.deepStrictEqual(resolveOriginStopForDestination('freezoneDubai', 'gate'), {
  error: { status: 400, message: 'freezoneDubai trips can be created only at Yard' },
});
assert.deepStrictEqual(resolveOriginStopForDestination('FREE_ZONE', 'Gate'), {
  originStop: 'portLoading',
});

const validShipId = '507f1f77bcf86cd799439011';
const validTruckId = '507f1f77bcf86cd799439010';
const makeCreateBody = (overrides = {}) => ({
  truckId: validTruckId,
  headTruckNumber: 'HT-200',
  tailTrailerNumber: 'TT-200',
  supplierName: 'Gulf Supplier',
  shipId: validShipId,
  shipName: 'Gulf Star',
  shipNumber: 'GS-1',
  tripNumber: 'TRIP-2',
  tripTime: 1,
  driverName: 'Driver Two',
  driverMobile: '971500000001',
  driverTdCardNumber: 'TD-2',
  truckModel: 'sixAxis',
  destination: 'dubai',
  originStop: 'yard',
  ...overrides,
});

const makeCompletedEntry = (destination) => ({
  ...baseEntry,
  _id: `completed-${destination}`,
  destination,
  updates: [
    { stop: 'yard', status: 'entry', updatedAt: at(0) },
    { stop: 'yard', status: 'exit', updatedAt: at(1) },
    { stop: 'gate', status: 'entry', updatedAt: at(2) },
    { stop: 'gate', status: 'exit', updatedAt: at(3) },
    { stop: 'port', status: 'entry', updatedAt: at(4) },
    { stop: 'port', status: 'exit', updatedAt: at(5) },
    { stop: 'clearence', status: 'exit', updatedAt: at(7) },
    {
      stop: destination === 'freezone' ? 'freezone' : 'dubai',
      status: 'completed',
      updatedAt: at(9),
      ...(destination === 'dubai' ? { destination: 'dubai' } : {}),
    },
  ],
});

const makePendingDubaiReturnToYardEntry = () => ({
  ...baseEntry,
  _id: 'pending-dubai-return-yard',
  destination: 'dubai',
  updates: [
    { stop: 'yard', status: 'entry', updatedAt: at(0) },
    { stop: 'yard', status: 'exit', updatedAt: at(1) },
    { stop: 'gate', status: 'entry', updatedAt: at(2) },
    { stop: 'gate', status: 'exit', updatedAt: at(3) },
    { stop: 'port', status: 'entry', updatedAt: at(4) },
    { stop: 'port', status: 'exit', updatedAt: at(5) },
    { stop: 'clearence', status: 'exit', updatedAt: at(7) },
  ],
});

const makePendingFreezoneDubaiReturnToYardEntry = () => ({
  ...baseEntry,
  _id: 'pending-freezone-dubai-return-yard',
  destination: 'DubaiFreeZone',
  updates: [
    { stop: 'yard', status: 'entry', updatedAt: at(0) },
    { stop: 'yard', status: 'exit', updatedAt: at(1) },
    { stop: 'freezone', status: 'entry', updatedAt: at(2) },
    { stop: 'freezone', status: 'exit', updatedAt: at(3) },
  ],
});

const makeCanceledEntry = (overrides = {}) => ({
  ...makePendingDubaiReturnToYardEntry(),
  _id: 'canceled-latest-entry',
  workflowStatus: 'cancelled',
  currentStatus: 'cancelled',
  canceledAt: at(12),
  createdAt: at(10),
  updatedAt: at(12),
  updates: [
    ...makePendingDubaiReturnToYardEntry().updates,
    { stop: 'clearence', status: 'cancelled', updatedAt: at(12) },
  ],
  ...overrides,
});

const matchesTruckEntryCriteria = (entry, criteria) => {
  if (!criteria) return true;
  if (criteria.$or) return criteria.$or.some((candidate) => matchesTruckEntryCriteria(entry, candidate));

  return Object.entries(criteria).every(([key, value]) => String(entry[key]) === String(value));
};

const callCreateTruckEntry = async ({
  body,
  entries = [],
  entriesByFind = null,
  createImpl = null,
  expectNextError = false,
  expectFindCriteria = null,
}) => {
  const originalFindById = Ship.findById;
  const originalTruckFindOne = Truck.findOne;
  const originalSupplierFindOne = Supplier.findOne;
  const originalFind = TruckEntry.find;
  const originalCreate = TruckEntry.create;
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let nextError = null;

  Ship.findById = async () => ({ _id: validShipId });
  Truck.findOne = async () => ({
    _id: validTruckId,
    headTruckNumber: body.headTruckNumber.trim().toUpperCase(),
    tailTrailerNumber: body.tailTrailerNumber.trim().toUpperCase(),
    truckModel: body.truckModel,
    isActive: true,
  });
  Supplier.findOne = async () => ({
    _id: body.supplierId || '507f1f77bcf86cd799439012',
    supplierName: body.supplierId ? 'Supplier By Id' : body.supplierName.trim(),
    isActive: true,
  });
  let findCallIndex = 0;
  TruckEntry.find = (criteria) => {
    if (expectFindCriteria) {
      const expectedCriteria = Array.isArray(expectFindCriteria)
        ? expectFindCriteria[findCallIndex]
        : expectFindCriteria;
      assert.deepStrictEqual(criteria, expectedCriteria);
    }

    const resultEntries = entriesByFind ? entriesByFind[findCallIndex] || [] : entries;
    findCallIndex += 1;

    return { sort: async () => resultEntries };
  };
  TruckEntry.create =
    createImpl || (async (payload) => ({ _id: 'created-entry', ...payload }));

  try {
    await createTruckEntry(
      { body, user: { role: 'yard', name: 'Yard Member', entryTeam: { name: 'Yard Entry Team' } } },
      res,
      (error) => {
        nextError = error;
      }
    );
  } finally {
    Ship.findById = originalFindById;
    Truck.findOne = originalTruckFindOne;
    Supplier.findOne = originalSupplierFindOne;
    TruckEntry.find = originalFind;
    TruckEntry.create = originalCreate;
  }

  if (expectNextError) {
    return { res, nextError };
  }

  assert.strictEqual(nextError, null);
  return res;
};

const callMarkTeamEntry = async ({ entry, body = {}, role = 'gate' }) => {
  const originalFindById = TruckEntry.findById;
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let nextError = null;

  TruckEntry.findById = async () => entry;

  try {
    await markTeamEntry(
      {
        params: { id: validTruckId },
        body,
        user: { role, name: 'Gate Member', entryTeam: { name: 'Gate Entry Team' } },
      },
      res,
      (error) => {
        nextError = error;
      }
    );
  } finally {
    TruckEntry.findById = originalFindById;
  }

  assert.strictEqual(nextError, null);
  return res;
};

const callCancelTruckEntry = async ({ entry, body = {}, role = 'admin' }) => {
  const originalFindById = TruckEntry.findById;
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let nextError = null;

  TruckEntry.findById = () => ({
    populate: async () => entry,
  });

  try {
    await cancelTruckEntry(
      {
        params: { id: validTruckId },
        body,
        user: { _id: validTruckId, role, name: 'Admin User', entryTeam: { name: 'Admin Team' } },
      },
      res,
      (error) => {
        nextError = error;
      }
    );
  } finally {
    TruckEntry.findById = originalFindById;
  }

  assert.strictEqual(nextError, null);
  return res;
};

const makeFreeZoneReturnTrip = (overrides = {}) => ({
  ...completedGateOrigin,
  _id: '507f1f77bcf86cd799439014',
  truckId: validTruckId,
  headTruckNumber: 'HT-200',
  tailTrailerNumber: 'TT-200',
  supplierName: 'Gulf Supplier',
  shipId: validShipId,
  shipName: 'Gulf Star',
  shipNumber: 'GS-1',
  tripNumber: 'TRIP-2',
  tripTime: 2,
  driverName: 'Driver Two',
  driverMobile: '971500000001',
  driverTdCardNumber: 'TD-2',
  truckModel: '6 Wheel',
  destination: 'freezone',
  updates: completedGateOrigin.updates.map((update) => ({ ...update })),
  save: async () => {},
  populate: async function populate() {
    return this;
  },
  ...overrides,
});

const callMarkGateReturnEntry = async ({ entry, existingEntries = null, nextTripOverrides = {} }) => {
  const originalStartSession = mongoose.startSession;
  const originalFindById = TruckEntry.findById;
  const originalFind = TruckEntry.find;
  const originalCreate = TruckEntry.create;
  const originalShipFindById = Ship.findById;
  const originalTruckFindOne = Truck.findOne;
  const originalSupplierFindOne = Supplier.findOne;
  const allEntries = existingEntries || [entry];
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let nextError = null;

  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: () => {},
  });
  TruckEntry.findById = () => entry;
  TruckEntry.find = (criteria) => {
    if (!criteria) {
      return {
        populate: () => ({
          sort: async () => allEntries,
        }),
      };
    }

    return {
      sort: async () =>
        allEntries.filter((candidate) => matchesTruckEntryCriteria(candidate, criteria)),
    };
  };
  TruckEntry.create = async (payloads) => {
    const created = payloads.map((payload, index) => ({
      _id: `507f1f77bcf86cd79943902${index}`,
      ...payload,
      populate: async function populate() {
        return this;
      },
    }));
    allEntries.push(...created);
    return created;
  };
  Ship.findById = async () => ({ _id: validShipId });
  Truck.findOne = async () => ({
    _id: validTruckId,
    headTruckNumber: entry.headTruckNumber,
    tailTrailerNumber: entry.tailTrailerNumber,
    truckModel: entry.truckModel,
    isActive: true,
  });
  Supplier.findOne = async () => ({
    _id: '507f1f77bcf86cd799439012',
    supplierName: 'Gulf Supplier',
    isActive: true,
  });

  try {
    await markGateReturnEntry(
      {
        params: { id: String(entry._id) },
        body: {
          entryAt: '2026-05-01T08:08',
          finishTripUpdates: {
            driverName: 'Driver Three',
            driverMobile: '971500000003',
            driverTdCardNumber: 'TD-3',
            truckModel: '6 Wheel',
            remarks: 'Return checked',
          },
          nextTrip: makeCreateBody({
            headTruckNumber: entry.headTruckNumber,
            tailTrailerNumber: entry.tailTrailerNumber,
            truckModel: entry.truckModel,
            originStop: 'portloading',
            destination: 'dubai',
            tripNumber: 'TRIP-3',
            tripTime: 1,
            entryAt: '2026-05-01T08:08',
            ...nextTripOverrides,
          }),
        },
        user: { role: 'port', name: 'Port Member', entryTeam: { name: 'Port Loading Entry Team' } },
      },
      res,
      (error) => {
        nextError = error;
      }
    );
  } finally {
    mongoose.startSession = originalStartSession;
    TruckEntry.findById = originalFindById;
    TruckEntry.find = originalFind;
    TruckEntry.create = originalCreate;
    Ship.findById = originalShipFindById;
    Truck.findOne = originalTruckFindOne;
    Supplier.findOne = originalSupplierFindOne;
  }

  assert.strictEqual(nextError, null);
  return { res, allEntries };
};

(async () => {
  const yardFreezone = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'freezone', originStop: 'yard' }),
    expectFindCriteria: [
      { truckId: validTruckId },
      { headTruckNumber: 'HT-200', tailTrailerNumber: 'TT-200' },
    ],
  });

  assert.strictEqual(yardFreezone.statusCode, 201);
  assert.strictEqual(yardFreezone.body.truckEntry.destination, 'freezone');
  assert.strictEqual(yardFreezone.body.truckEntry.originStop, 'yard');
  assert.strictEqual(yardFreezone.body.truckEntry.tripNumber, '1');
  assert.strictEqual(yardFreezone.body.truckEntry.tripTime, 1);
  assert.strictEqual(yardFreezone.body.truckEntry.supplierName, 'Gulf Supplier');
  assert.strictEqual(String(yardFreezone.body.truckEntry.supplierId), '507f1f77bcf86cd799439012');

  const truckNumberFallbackEntry = makeCompletedEntry('dubai');
  truckNumberFallbackEntry.tripTime = 6;
  truckNumberFallbackEntry.tripNumber = '6';
  const fallbackLookup = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'yard' }),
    entriesByFind: [[], [truckNumberFallbackEntry]],
    expectFindCriteria: [
      { truckId: validTruckId },
      { headTruckNumber: 'HT-200', tailTrailerNumber: 'TT-200' },
    ],
  });

  assert.strictEqual(fallbackLookup.statusCode, 201);
  assert.strictEqual(fallbackLookup.body.truckEntry.tripNumber, '7');

  const gateDubai = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'gate' }),
  });

  assert.strictEqual(gateDubai.statusCode, 201);
  assert.strictEqual(gateDubai.body.truckEntry.destination, 'dubai');
  assert.strictEqual(gateDubai.body.truckEntry.originStop, 'portLoading');

  const supplierById = await callCreateTruckEntry({
    body: makeCreateBody({
      supplierId: '507f1f77bcf86cd799439013',
      supplierName: 'Ignored Supplier Name',
    }),
  });

  assert.strictEqual(supplierById.statusCode, 201);
  assert.strictEqual(supplierById.body.truckEntry.supplierName, 'Supplier By Id');
  assert.strictEqual(String(supplierById.body.truckEntry.supplierId), '507f1f77bcf86cd799439013');

  const completedTripCountHistory = {
    ...makeCompletedEntry('dubai'),
    truckId: validTruckId,
    headTruckNumber: 'HT-200',
    tailTrailerNumber: 'TT-200',
    tripNumber: '11',
    tripTime: 11,
  };
  const afterCompletedTripCountHistory = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'yard', tripNumber: '1', tripTime: 1 }),
    entries: [completedTripCountHistory],
  });

  assert.strictEqual(afterCompletedTripCountHistory.statusCode, 201);
  assert.strictEqual(afterCompletedTripCountHistory.body.truckEntry.tripNumber, '12');
  assert.strictEqual(afterCompletedTripCountHistory.body.truckEntry.tripTime, 12);

  const canceledTripCountHistory = makeCanceledEntry({
    truckId: validTruckId,
    headTruckNumber: 'HT-200',
    tailTrailerNumber: 'TT-200',
    tripNumber: '11',
    tripTime: 11,
  });
  const afterCanceledTripCountHistory = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'yard', tripNumber: '1', tripTime: 1 }),
    entries: [canceledTripCountHistory],
  });

  assert.strictEqual(afterCanceledTripCountHistory.statusCode, 201);
  assert.strictEqual(afterCanceledTripCountHistory.body.truckEntry.tripNumber, '12');
  assert.strictEqual(afterCanceledTripCountHistory.body.truckEntry.tripTime, 12);

  const previousDubaiGateOrigin = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'freezone', originStop: 'gate' }),
    entries: [makeCompletedEntry('dubai')],
  });

  assert.strictEqual(previousDubaiGateOrigin.statusCode, 400);
  assert.strictEqual(
    previousDubaiGateOrigin.body.message,
    'This truck completed Dubai, so the next trip can be added only at Yard'
  );

  const previousFreezoneYardOrigin = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'yard' }),
    entries: [makeCompletedEntry('freezone')],
  });

  assert.strictEqual(previousFreezoneYardOrigin.statusCode, 400);
  assert.strictEqual(
    previousFreezoneYardOrigin.body.message,
    'This truck completed Free Zone, so the next trip can be added only at Port Loading'
  );

  const afterLatestCanceledFreezoneYardOrigin = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'yard' }),
    entries: [makeCompletedEntry('freezone'), makeCanceledEntry()],
  });

  assert.strictEqual(afterLatestCanceledFreezoneYardOrigin.statusCode, 201);
  assert.strictEqual(afterLatestCanceledFreezoneYardOrigin.body.truckEntry.originStop, 'yard');

  const afterLatestCanceledDubaiPortOrigin = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'freezone', originStop: 'gate' }),
    entries: [makeCompletedEntry('dubai'), makeCanceledEntry()],
  });

  assert.strictEqual(afterLatestCanceledDubaiPortOrigin.statusCode, 201);
  assert.strictEqual(afterLatestCanceledDubaiPortOrigin.body.truckEntry.originStop, 'portLoading');

  const pendingDubaiPreviousEntry = makePendingDubaiReturnToYardEntry();
  const completionEvents = [];
  pendingDubaiPreviousEntry.save = async () => {
    completionEvents.push('save');
  };
  const nextYardTrip = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'yard' }),
    entries: [pendingDubaiPreviousEntry],
    createImpl: async (payload) => {
      completionEvents.push('create');
      return { _id: 'created-entry', ...payload };
    },
  });

  assert.strictEqual(nextYardTrip.statusCode, 201);
  assert.deepStrictEqual(completionEvents, ['create', 'save']);
  const dubaiCompletionUpdate = pendingDubaiPreviousEntry.updates.find(
    (update) => update.stop === 'dubai' && update.status === 'completed'
  );
  assert.ok(dubaiCompletionUpdate);
  assert.strictEqual(dubaiCompletionUpdate.destination, 'dubai');
  assert.strictEqual(
    pendingDubaiPreviousEntry.updates.some((update) => update.stop === 'yard' && update.status === 'completed'),
    false
  );
  assert.strictEqual(
    serializeTruckEntry(pendingDubaiPreviousEntry).updates.some(
      (update) => update.stop === 'dubai' && update.status === 'completed' && update.destination === 'dubai'
    ),
    true
  );
  assert.strictEqual(getWorkflowState(pendingDubaiPreviousEntry).workflowStatus, 'completed');

  const pendingFreezoneDubaiPreviousEntry = makePendingFreezoneDubaiReturnToYardEntry();
  const freezoneDubaiCompletionEvents = [];
  pendingFreezoneDubaiPreviousEntry.save = async () => {
    freezoneDubaiCompletionEvents.push('save');
  };
  const nextYardTripAfterFreezoneDubai = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'freezoneDubai', originStop: 'yard' }),
    entries: [pendingFreezoneDubaiPreviousEntry],
    createImpl: async (payload) => {
      freezoneDubaiCompletionEvents.push('create');
      return { _id: 'created-freezone-dubai-entry', ...payload };
    },
  });

  assert.strictEqual(nextYardTripAfterFreezoneDubai.statusCode, 201);
  assert.strictEqual(nextYardTripAfterFreezoneDubai.body.truckEntry.destination, 'freezoneDubai');
  assert.deepStrictEqual(freezoneDubaiCompletionEvents, ['create', 'save']);
  assert.strictEqual(getWorkflowState(pendingFreezoneDubaiPreviousEntry).workflowStatus, 'completed');
  assert.strictEqual(
    serializeTruckEntry(pendingFreezoneDubaiPreviousEntry).updates.some(
      (update) =>
        update.stop === 'freezone' &&
        update.status === 'completed' &&
        update.destination === 'freezoneDubai' &&
        update.remarks === 'Dubai Free Zone destination trip completed when truck was reassigned from Yard'
    ),
    true
  );

  const pendingFreezoneDubaiNotAtFreezoneExit = {
    ...makePendingFreezoneDubaiReturnToYardEntry(),
    _id: 'pending-freezone-dubai-not-ready',
    updates: [
      { stop: 'yard', status: 'entry', updatedAt: at(0) },
      { stop: 'yard', status: 'exit', updatedAt: at(1) },
      { stop: 'freezone', status: 'entry', updatedAt: at(2) },
    ],
  };
  const duplicateBeforeFreezoneExit = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'yard' }),
    entries: [pendingFreezoneDubaiNotAtFreezoneExit],
  });

  assert.strictEqual(duplicateBeforeFreezoneExit.statusCode, 409);
  assert.strictEqual(duplicateBeforeFreezoneExit.body.message, 'Duplicate active truck entry already exists');
  assert.strictEqual(
    pendingFreezoneDubaiNotAtFreezoneExit.updates.some(
      (update) => update.status === 'completed' && update.remarks === 'Dubai Free Zone destination trip completed when truck was reassigned from Yard'
    ),
    false
  );

  const normalFreezoneAfterFreezoneExit = {
    ...makePendingFreezoneDubaiReturnToYardEntry(),
    _id: 'normal-freezone-after-freezone-exit',
    destination: 'freezone',
  };
  const duplicateNormalFreezoneAfterFreezoneExit = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'yard' }),
    entries: [normalFreezoneAfterFreezoneExit],
  });

  assert.strictEqual(duplicateNormalFreezoneAfterFreezoneExit.statusCode, 409);
  assert.strictEqual(duplicateNormalFreezoneAfterFreezoneExit.body.message, 'Duplicate active truck entry already exists');
  assert.strictEqual(
    normalFreezoneAfterFreezoneExit.updates.some(
      (update) => update.status === 'completed' && update.remarks === 'Dubai Free Zone destination trip completed when truck was reassigned from Yard'
    ),
    false
  );

  const canceledFreezoneDubaiPreviousEntry = {
    ...makePendingFreezoneDubaiReturnToYardEntry(),
    _id: 'canceled-freezone-dubai-return-yard',
    workflowStatus: 'canceled',
    currentStatus: 'canceled',
    updates: [
      ...makePendingFreezoneDubaiReturnToYardEntry().updates,
      { stop: 'freezone', status: 'canceled', updatedAt: at(4) },
    ],
    save: async () => {
      throw new Error('canceled mixed trip should not be completed');
    },
  };
  const nextYardTripAfterCanceledFreezoneDubai = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'yard' }),
    entries: [canceledFreezoneDubaiPreviousEntry],
  });

  assert.strictEqual(nextYardTripAfterCanceledFreezoneDubai.statusCode, 201);
  assert.strictEqual(
    canceledFreezoneDubaiPreviousEntry.updates.some(
      (update) => update.status === 'completed' && update.remarks === 'Dubai Free Zone destination trip completed when truck was reassigned from Yard'
    ),
    false
  );

  const firstEligibleLegacyDubaiEntry = makePendingDubaiReturnToYardEntry();
  const secondEligibleLegacyDubaiEntry = {
    ...makePendingDubaiReturnToYardEntry(),
    _id: 'second-pending-dubai-return-yard',
    tailTrailerNumber: 'TT-101',
  };
  const multipleCompletionEvents = [];
  firstEligibleLegacyDubaiEntry.save = async () => {
    multipleCompletionEvents.push('first-save');
  };
  secondEligibleLegacyDubaiEntry.save = async () => {
    multipleCompletionEvents.push('second-save');
  };
  const nextYardTripAfterMultipleEligibleTrips = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'yard' }),
    entries: [firstEligibleLegacyDubaiEntry, secondEligibleLegacyDubaiEntry],
    createImpl: async (payload) => {
      multipleCompletionEvents.push('create');
      return { _id: 'created-entry', ...payload };
    },
  });

  assert.strictEqual(nextYardTripAfterMultipleEligibleTrips.statusCode, 201);
  assert.deepStrictEqual(multipleCompletionEvents, ['create', 'first-save', 'second-save']);
  assert.strictEqual(getWorkflowState(firstEligibleLegacyDubaiEntry).workflowStatus, 'completed');
  assert.strictEqual(getWorkflowState(secondEligibleLegacyDubaiEntry).workflowStatus, 'completed');

  const pendingDubaiDisplayClearanceEntry = {
    ...makePendingDubaiReturnToYardEntry(),
    _id: 'pending-dubai-display-clearance',
    updates: [
      ...makePendingDubaiReturnToYardEntry().updates.slice(0, -1),
      { stop: 'Custom Clearance', status: 'exit', updatedAt: at(7) },
    ],
  };
  pendingDubaiDisplayClearanceEntry.save = async () => {};
  const nextYardTripAfterDisplayClearance = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'yard' }),
    entries: [pendingDubaiDisplayClearanceEntry],
  });

  assert.strictEqual(nextYardTripAfterDisplayClearance.statusCode, 201);
  assert.strictEqual(getWorkflowState(pendingDubaiDisplayClearanceEntry).workflowStatus, 'completed');

  const pendingDubaiAfterDubaiEntry = {
    ...makePendingDubaiReturnToYardEntry(),
    _id: 'pending-dubai-after-dubai-entry',
    updates: [
      ...makePendingDubaiReturnToYardEntry().updates,
      { stop: 'dubai', status: 'entry', updatedAt: at(8) },
    ],
  };
  const duplicateAfterDubaiMovement = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'yard' }),
    entries: [pendingDubaiAfterDubaiEntry],
  });

  assert.strictEqual(duplicateAfterDubaiMovement.statusCode, 409);
  assert.strictEqual(duplicateAfterDubaiMovement.body.message, 'Duplicate active truck entry already exists');

  const createFailedPreviousEntry = makePendingDubaiReturnToYardEntry();
  createFailedPreviousEntry.save = async () => {
    throw new Error('previous trip should not be completed when new trip creation fails');
  };
  const failedCreate = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'yard' }),
    entries: [createFailedPreviousEntry],
    createImpl: async () => {
      throw new Error('create failed');
    },
    expectNextError: true,
  });

  assert.strictEqual(failedCreate.nextError.message, 'create failed');
  assert.strictEqual(
    createFailedPreviousEntry.updates.some((update) => update.stop === 'dubai' && update.status === 'completed'),
    false
  );
  assert.strictEqual(getWorkflowState(createFailedPreviousEntry).workflowStatus, 'pending');

  const pendingDubaiGateOrigin = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'gate' }),
    entries: [makePendingDubaiReturnToYardEntry()],
  });

  assert.strictEqual(pendingDubaiGateOrigin.statusCode, 409);
  assert.strictEqual(pendingDubaiGateOrigin.body.message, 'Duplicate active truck entry already exists');

  const pendingFreeZonePreviousEntry = {
    ...makePendingDubaiReturnToYardEntry(),
    _id: 'pending-freezone-clearence-exit',
    destination: 'freezone',
  };
  const pendingFreeZoneDuplicate = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'freezone', originStop: 'yard' }),
    entries: [pendingFreeZonePreviousEntry],
  });

  assert.strictEqual(pendingFreeZoneDuplicate.statusCode, 409);
  assert.strictEqual(pendingFreeZoneDuplicate.body.message, 'Duplicate active truck entry already exists');

  const canceledPreviousEntry = {
    ...makePendingDubaiReturnToYardEntry(),
    workflowStatus: 'canceled',
    currentStatus: 'canceled',
    updates: [
      ...makePendingDubaiReturnToYardEntry().updates,
      { stop: 'clearence', status: 'canceled', updatedAt: at(8) },
    ],
  };
  const afterCanceledPreviousEntry = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'yard' }),
    entries: [canceledPreviousEntry],
  });

  assert.strictEqual(afterCanceledPreviousEntry.statusCode, 201);

  const canceledAtOnlyPreviousEntry = {
    ...makePendingDubaiReturnToYardEntry(),
    _id: 'canceled-at-only-entry',
    canceledAt: at(8),
  };
  const afterCanceledAtOnlyPreviousEntry = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'yard' }),
    entries: [canceledAtOnlyPreviousEntry],
  });

  assert.strictEqual(afterCanceledAtOnlyPreviousEntry.statusCode, 201);

  const gateCompletionEntry = {
    ...completedGateOrigin,
    save: async () => {},
    populate: async () => {},
  };
  const normalGateEntryForReturn = await callMarkTeamEntry({
    entry: gateCompletionEntry,
    body: { entryAt: '2026-05-01T08:08' },
  });

  assert.strictEqual(normalGateEntryForReturn.statusCode, 400);
  assert.strictEqual(
    normalGateEntryForReturn.body.message,
    'Use gate-return-entry endpoint to complete Free Zone return and create next trip'
  );
  assert.strictEqual(getWorkflowState(gateCompletionEntry).workflowStatus, 'pending');

  const returningFreeZoneTrip = makeFreeZoneReturnTrip();
  const portReturnResult = await callMarkGateReturnEntry({ entry: returningFreeZoneTrip });

  assert.strictEqual(portReturnResult.res.statusCode, 200);
  assert.strictEqual(portReturnResult.res.body.completedTrip.workflowStatus, 'completed');
  assert.strictEqual(portReturnResult.res.body.completedTrip.currentStatus, 'completed');
  assert.strictEqual(returningFreeZoneTrip.workflowStatus, 'completed');
  assert.strictEqual(returningFreeZoneTrip.currentStatus, 'completed');
  assert.strictEqual(returningFreeZoneTrip.completedLocation, 'portLoading');
  assert.strictEqual(returningFreeZoneTrip.updates.at(-2).stop, 'portLoading');
  assert.strictEqual(returningFreeZoneTrip.updates.at(-2).status, 'entry');
  assert.strictEqual(returningFreeZoneTrip.updates.at(-1).stop, 'portLoading');
  assert.strictEqual(returningFreeZoneTrip.updates.at(-1).status, 'completed');
  assert.strictEqual(portReturnResult.res.body.newTrip.originStop, 'portLoading');
  assert.strictEqual(portReturnResult.res.body.newTrip.currentStop, 'portLoading');
  assert.strictEqual(portReturnResult.res.body.newTrip.currentAction, 'exit');
  assert.strictEqual(portReturnResult.res.body.newTrip.tripNumber, '3');
  assert.strictEqual(portReturnResult.res.body.newTrip.tripTime, 3);
  assert.strictEqual(
    portReturnResult.allEntries.filter((entry) => !['completed', 'canceled'].includes(getWorkflowState(entry).workflowStatus))
      .length,
    1
  );
  assert.strictEqual(
    portReturnResult.allEntries.find((entry) => getWorkflowState(entry).workflowStatus === 'pending').originStop,
    'portLoading'
  );

  const thirdActiveTrip = {
    ...makePendingDubaiReturnToYardEntry(),
    _id: '507f1f77bcf86cd799439017',
    headTruckNumber: returningFreeZoneTrip.headTruckNumber,
    tailTrailerNumber: returningFreeZoneTrip.tailTrailerNumber,
    truckId: returningFreeZoneTrip.truckId,
  };
  const blockedPortReturn = await callMarkGateReturnEntry({
    entry: makeFreeZoneReturnTrip({ _id: '507f1f77bcf86cd799439018' }),
    existingEntries: [makeFreeZoneReturnTrip({ _id: '507f1f77bcf86cd799439018' }), thirdActiveTrip],
  });

  assert.strictEqual(blockedPortReturn.res.statusCode, 409);
  assert.strictEqual(blockedPortReturn.res.body.message, 'Duplicate active truck entry already exists');

  const entryTeamCancelAttemptEntry = {
    ...completedGateOrigin,
    save: async () => {
      throw new Error('entry team should not be able to cancel trips');
    },
    populate: async () => {},
  };
  const entryTeamCancelAttempt = await callCancelTruckEntry({
    entry: entryTeamCancelAttemptEntry,
    role: 'freezone',
    body: { canceledAt: '2026-05-01T08:09:00.000Z', remarks: 'Assigned stop attempt' },
  });

  assert.strictEqual(entryTeamCancelAttempt.statusCode, 403);
  assert.strictEqual(entryTeamCancelAttempt.body.message, 'Only admin can cancel trips');
  assert.strictEqual(entryTeamCancelAttemptEntry.workflowStatus, completedGateOrigin.workflowStatus);
  assert.strictEqual(entryTeamCancelAttemptEntry.currentStatus, completedGateOrigin.currentStatus);

  const cancelableEntry = {
    ...completedGateOrigin,
    save: async () => {},
    populate: async () => {},
  };
  const canceledTrip = await callCancelTruckEntry({
    entry: cancelableEntry,
    body: { canceledAt: '2026-05-01T08:09:00.000Z', remarks: 'Customer request' },
  });

  assert.strictEqual(canceledTrip.statusCode, 200);
  assert.strictEqual(canceledTrip.body.truckEntry.workflowStatus, 'canceled');
  assert.strictEqual(canceledTrip.body.truckEntry.currentStatus, 'canceled');
  assert.strictEqual(cancelableEntry.workflowStatus, 'canceled');
  assert.strictEqual(cancelableEntry.currentStatus, 'canceled');
  assert.strictEqual(cancelableEntry.currentAction, null);
  assert.strictEqual(cancelableEntry.currentAllowedRole, null);
  assert.strictEqual(cancelableEntry.currentAllowedStop, null);
  assert.strictEqual(cancelableEntry.nextRole, null);
  assert.strictEqual(cancelableEntry.nextStop, null);
  assert.strictEqual(cancelableEntry.movementStatus, null);
  assert.strictEqual(cancelableEntry.truckId, baseEntry.truckId);
  assert.deepStrictEqual(cancelableEntry.updates.at(-1), {
    stop: 'freezone',
    status: 'canceled',
    updatedAt: new Date('2026-05-01T08:09:00.000Z'),
    teamName: 'Admin Team',
    memberId: validTruckId,
    memberName: 'Admin User',
    remarks: 'Customer request',
  });

  for (const truckModel of ['2 Axle', '3 Axle', '6 Wheel', 'Flat Trailer']) {
    let createdPayload = null;
    const createdEntry = await callCreateTruckEntry({
      body: makeCreateBody({ truckModel }),
      createImpl: async (payload) => {
        createdPayload = payload;
        return { _id: `created-${truckModel}`, ...payload };
      },
    });

    assert.strictEqual(createdEntry.statusCode, 201);
    assert.strictEqual(createdPayload.truckModel, truckModel);
    assert.strictEqual(createdEntry.body.truckEntry.truckModel, truckModel);
  }

  console.log('truck entry controller tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
