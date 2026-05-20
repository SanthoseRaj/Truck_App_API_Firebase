const assert = require('assert');
const Ship = require('../models/Ship');
const Supplier = require('../models/Supplier');
const Truck = require('../models/Truck');
const TruckEntry = require('../models/TruckEntry');
const {
  createTruckEntry,
  getWorkflowState,
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

assert.deepStrictEqual(getWorkflowState(yardOrigin), {
  currentAllowedRole: 'yard',
  currentAllowedStop: 'yard',
  currentAction: 'exit',
  workflowStatus: 'pending',
  nextRole: 'yard',
  nextStop: 'yard',
});

assert.deepStrictEqual(getWorkflowState(gateOrigin), {
  currentAllowedRole: 'gate',
  currentAllowedStop: 'gate',
  currentAction: 'exit',
  workflowStatus: 'pending',
  nextRole: 'gate',
  nextStop: 'gate',
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

assert.deepStrictEqual(getWorkflowState(completedGateOrigin), {
  currentAllowedRole: 'gate',
  currentAllowedStop: 'gate',
  currentAction: 'entry',
  workflowStatus: 'pending',
  nextRole: 'gate',
  nextStop: 'gate',
});

assert.deepStrictEqual(getWorkflowState(completedFreeZoneAtGate), {
  currentAllowedRole: 'gate',
  currentAllowedStop: 'gate',
  currentAction: null,
  workflowStatus: 'completed',
  nextRole: 'gate',
  nextStop: 'gate',
});

const serializedGateOrigin = serializeTruckEntry(gateOrigin);
const serializedLegacyFreeZone = serializeTruckEntry({ ...gateOrigin, destination: 'Free Zone' });
const serializedWaitingAtCustomClearence = serializeTruckEntry(waitingAtCustomClearence);
const serializedAfterFreeZoneCustomClearenceExit = serializeTruckEntry({
  ...afterCustomClearenceExit,
  destination: 'freezone',
});
const serializedAfterFreeZoneExit = serializeTruckEntry(completedGateOrigin);

assert.strictEqual(serializedGateOrigin.destination, 'freezone');
assert.strictEqual(serializedLegacyFreeZone.destination, 'freezone');
assert.strictEqual(serializedGateOrigin.truckModel, '6 Wheel');
assert.strictEqual(serializedGateOrigin.originStop, 'gate');
assert.strictEqual(serializedGateOrigin.currentStop, 'gate');
assert.strictEqual(serializedGateOrigin.currentStatus, 'entry');
assert.strictEqual(serializedGateOrigin.currentAllowedRole, 'gate');
assert.strictEqual(serializedGateOrigin.currentAction, 'exit');
assert.strictEqual(serializedGateOrigin.nextStop, 'port');
assert.strictEqual(serializedWaitingAtCustomClearence.currentAllowedRole, 'clearence');
assert.strictEqual(serializedWaitingAtCustomClearence.currentAllowedStop, 'clearence');
assert.strictEqual(serializedWaitingAtCustomClearence.currentAction, 'exit');
assert.strictEqual(
  serializedWaitingAtCustomClearence.updates.some(
    (update) => update.stop === 'clearence' && update.status === 'entry'
  ),
  false
);
assert.strictEqual(serializedAfterFreeZoneCustomClearenceExit.currentAllowedRole, 'freezone');
assert.strictEqual(serializedAfterFreeZoneCustomClearenceExit.currentAllowedStop, 'freezone');
assert.strictEqual(serializedAfterFreeZoneCustomClearenceExit.currentAction, 'entry');
assert.strictEqual(serializedAfterFreeZoneExit.workflowStatus, 'pending');
assert.strictEqual(serializedAfterFreeZoneExit.currentAllowedRole, 'gate');
assert.strictEqual(serializedAfterFreeZoneExit.currentAllowedStop, 'gate');
assert.strictEqual(serializedAfterFreeZoneExit.currentAction, 'entry');
assert.strictEqual(serializedAfterFreeZoneExit.currentLocation, 'Moving');
assert.strictEqual(serializedAfterFreeZoneExit.from, 'Free Zone');
assert.strictEqual(serializedAfterFreeZoneExit.to, 'Gate');
assert.strictEqual(serializedAfterFreeZoneExit.movementStatus, 'Free Zone to Gate');
assert.strictEqual(serializedAfterFreeZoneExit.nextStop, 'gate');
const serializedAfterDubaiCustomClearenceExit = serializeTruckEntry(afterCustomClearenceExit);
assert.strictEqual(serializedAfterDubaiCustomClearenceExit.currentAllowedRole, 'yard');
assert.strictEqual(serializedAfterDubaiCustomClearenceExit.currentAllowedStop, 'yard');
assert.strictEqual(serializedAfterDubaiCustomClearenceExit.currentAction, null);
assert.strictEqual(serializedAfterDubaiCustomClearenceExit.workflowStatus, 'pending');
assert.notStrictEqual(serializedAfterDubaiCustomClearenceExit.currentAllowedRole, 'dubai');

assert.strictEqual(validateOriginCycle('yard', null), null);
assert.strictEqual(validateOriginCycle('yard', { destination: 'dubai' }), null);
assert.strictEqual(
  validateOriginCycle('yard', { destination: 'freezone' }),
  'This truck completed Free Zone, so the next trip can be added only at Gate'
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
  originStop: 'gate',
});
assert.deepStrictEqual(resolveOriginStopForDestination('dubai', 'yard'), {
  originStop: 'yard',
});
assert.deepStrictEqual(resolveOriginStopForDestination('freeZone', 'yard'), {
  originStop: 'yard',
});
assert.deepStrictEqual(resolveOriginStopForDestination('dubai', 'gate'), {
  originStop: 'gate',
});
assert.deepStrictEqual(resolveOriginStopForDestination('freeZone', 'YARD'), {
  originStop: 'yard',
});
assert.deepStrictEqual(resolveOriginStopForDestination('FREE_ZONE', 'Gate'), {
  originStop: 'gate',
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

const callCreateTruckEntry = async ({ body, entries = [], createImpl = null, expectNextError = false }) => {
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
  TruckEntry.find = () => ({ sort: async () => entries });
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

(async () => {
  const yardFreezone = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'freezone', originStop: 'yard' }),
  });

  assert.strictEqual(yardFreezone.statusCode, 201);
  assert.strictEqual(yardFreezone.body.truckEntry.destination, 'freezone');
  assert.strictEqual(yardFreezone.body.truckEntry.originStop, 'yard');
  assert.strictEqual(yardFreezone.body.truckEntry.supplierName, 'Gulf Supplier');
  assert.strictEqual(String(yardFreezone.body.truckEntry.supplierId), '507f1f77bcf86cd799439012');

  const gateDubai = await callCreateTruckEntry({
    body: makeCreateBody({ destination: 'dubai', originStop: 'gate' }),
  });

  assert.strictEqual(gateDubai.statusCode, 201);
  assert.strictEqual(gateDubai.body.truckEntry.destination, 'dubai');
  assert.strictEqual(gateDubai.body.truckEntry.originStop, 'gate');

  const supplierById = await callCreateTruckEntry({
    body: makeCreateBody({
      supplierId: '507f1f77bcf86cd799439013',
      supplierName: 'Ignored Supplier Name',
    }),
  });

  assert.strictEqual(supplierById.statusCode, 201);
  assert.strictEqual(supplierById.body.truckEntry.supplierName, 'Supplier By Id');
  assert.strictEqual(String(supplierById.body.truckEntry.supplierId), '507f1f77bcf86cd799439013');

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
    'This truck completed Free Zone, so the next trip can be added only at Gate'
  );

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

  for (const truckModel of ['2 Axle', '3 Axle', '6 Wheel']) {
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
