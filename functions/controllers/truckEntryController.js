const mongoose = require('mongoose');
const Ship = require('../models/Ship');
const Truck = require('../models/Truck');
const TruckEntry = require('../models/TruckEntry');
const { resolveActiveSupplierForEntry } = require('../services/supplierService');
const { normalizeDestination } = require('../utils/destination');
const { normalizeTruckModel } = require('../utils/truckModel');
const {
  workflowRoles,
  normalizeStop,
  requiresEntryForStop,
  getWorkflowStopsForDestination,
  getNextStopForDestination,
  toApiStop,
} = require('../utils/workflow');
const {
  formatSelectedLocalDateTime,
  parseSelectedLocalDateTime,
  selectedLocalDateTimeFromDate,
} = require('../utils/selectedLocalDateTime');
const { buildDashboardCounts } = require('./publicDashboardController');

const requiredFields = [
  'truckId',
  'headTruckNumber',
  'tailTrailerNumber',
  'shipId',
  'shipName',
  'shipNumber',
  'tripNumber',
  'tripTime',
  'driverName',
  'driverMobile',
  'driverTdCardNumber',
  'truckModel',
];

const stringFields = requiredFields.filter((field) => field !== 'tripTime');
const adminRoles = ['owner', 'admin'];
const originStops = ['yard', 'gate', 'port', 'portloading'];
const finishTripUpdateFields = [
  'tripNumber',
  'driverName',
  'driverMobile',
  'driverTdCardNumber',
  'truckModel',
];

const normalizeUpper = (value) => value.trim().toUpperCase();
const normalizeText = (value) => value?.toLowerCase().trim();
const trimString = (value) => (typeof value === 'string' ? value.trim() : value);
const resolveQueryWithSession = (query, session) =>
  session && query && typeof query.session === 'function' ? query.session(session) : query;
const parseIsoDateTime = (value) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' || !value.includes('T')) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toStoredOriginStop = (originStop) => {
  const normalized = normalizeOriginStop(originStop);
  if (normalized === undefined) return undefined;
  if (normalized === null) return null;
  if (normalized === 'gate' || normalized === 'port' || normalized === 'portloading') return 'portLoading';
  return normalized;
};
const toWorkflowOriginStop = (originStop) => normalizeStop(originStop) || 'yard';
const isValidOriginStop = (originStop) => originStop === undefined || originStop === null || originStops.includes(originStop);
const normalizeOriginStop = (originStop) => {
  if (originStop === undefined) return undefined;
  if (originStop === null) return null;
  return originStop.toString().trim().toLowerCase();
};
const getOriginStop = (truckEntry) => toStoredOriginStop(truckEntry.originStop) || 'yard';
const getWorkflowStops = (truckEntry) =>
  getWorkflowStopsForDestination(normalizeDestination(truckEntry.destination), toWorkflowOriginStop(getOriginStop(truckEntry)));
const getNextRouteStop = (stop, truckEntry) =>
  getNextStopForDestination(stop, normalizeDestination(truckEntry.destination), toWorkflowOriginStop(getOriginStop(truckEntry)));
const isCompletedFreeZoneDestination = (truckEntry) =>
  normalizeDestination(truckEntry?.destination) === 'freezone' && hasCompletedUpdate(truckEntry);
const getVisibleUpdates = (truckEntry) => {
  const destination = normalizeDestination(truckEntry.destination);

  return destination === 'freezone'
    ? truckEntry.updates.filter((update) => normalizeStop(update.stop, destination) !== 'clearence')
    : truckEntry.updates;
};

const validateRequiredFields = (body) => {
  const missingField = requiredFields.find((field) => {
    const value = body[field];
    return value === undefined || value === null || (typeof value === 'string' && !value.trim());
  });

  if (missingField) {
    return `${missingField} is required`;
  }

  const invalidStringField = stringFields.find((field) => typeof body[field] !== 'string');

  if (invalidStringField) {
    return `${invalidStringField} must be a string`;
  }

  if (!Number.isFinite(Number(body.tripTime))) {
    return 'tripTime must be a valid number';
  }

  if (!normalizeTruckModel(body.truckModel)) {
    return 'truckModel must be one of 2 Axle, 3 Axle, or 6 Wheel';
  }

  if (!normalizeDestination(body.destination)) {
    return 'destination must be either dubai or freezone';
  }

  if (!isValidOriginStop(normalizeOriginStop(body.originStop))) {
    return 'originStop must be either yard or portLoading';
  }

  return null;
};

const getTeamName = (user) => user.entryTeam?.name || (user.role === 'yard' ? 'Yard Entry Team' : user.role);

const hasUpdate = (truckEntry, stop, status) =>
  truckEntry.updates.some(
    (update) =>
      normalizeStop(update.stop, normalizeDestination(truckEntry.destination)) === stop &&
      normalizeText(update.status) === status
  );

const hasCompletedUpdate = (truckEntry) =>
  (truckEntry?.updates || []).some((update) => normalizeText(update.status) === 'completed');

const hasCanceledUpdate = (truckEntry) =>
  (truckEntry?.updates || []).some((update) => ['canceled', 'cancelled'].includes(normalizeText(update.status)));

const isCanceledTruckEntry = (truckEntry) =>
  ['canceled', 'cancelled'].includes(normalizeText(truckEntry?.workflowStatus)) ||
  ['canceled', 'cancelled'].includes(normalizeText(truckEntry?.currentStatus)) ||
  truckEntry?.canceledAt != null ||
  hasCanceledUpdate(truckEntry);

const getLatestUpdate = (truckEntry) =>
  (truckEntry?.updates || []).reduce((latestUpdate, update) => {
    if (!latestUpdate) return update;
    return toTimeValue(update.updatedAt) >= toTimeValue(latestUpdate.updatedAt) ? update : latestUpdate;
  }, null);

const hasDubaiMovementUpdate = (truckEntry) =>
  (truckEntry?.updates || []).some((update) => {
    const stop = normalizeStop(update.stop, normalizeDestination(truckEntry?.destination));
    const status = normalizeText(update.status);

    return stop === 'dubai' && ['entry', 'exit'].includes(status);
  });

const isDubaiEntryReadyForYardCompletion = (truckEntry) => {
  const latestUpdate = getLatestUpdate(truckEntry);

  return (
    normalizeDestination(truckEntry?.destination) === 'dubai' &&
    !isCanceledTruckEntry(truckEntry) &&
    !hasCompletedUpdate(truckEntry) &&
    !hasDubaiMovementUpdate(truckEntry) &&
    normalizeStop(latestUpdate?.stop, 'dubai') === 'clearence' &&
    normalizeText(latestUpdate?.status) === 'exit'
  );
};

const isFreeZoneEntryReadyForGateCompletion = (truckEntry) =>
  normalizeDestination(truckEntry?.destination) === 'freezone' &&
  hasUpdate(truckEntry, 'freezone', 'exit') &&
  !hasCompletedUpdate(truckEntry);

const getWorkflowState = (truckEntry) => {
  if (isCanceledTruckEntry(truckEntry)) {
    return {
      currentAllowedRole: null,
      currentAllowedStop: null,
      currentAction: null,
      workflowStatus: 'canceled',
      nextRole: null,
      nextStop: null,
    };
  }

  if (hasCompletedUpdate(truckEntry)) {
    if (isCompletedFreeZoneDestination(truckEntry)) {
      return {
        currentAllowedRole: 'port',
        currentAllowedStop: 'port',
        currentAction: null,
        workflowStatus: 'completed',
        nextRole: 'port',
        nextStop: 'port',
      };
    }

    return {
      currentAllowedRole: null,
      currentAllowedStop: null,
      currentAction: null,
      workflowStatus: 'completed',
      nextRole: null,
      nextStop: null,
    };
  }

  for (const stop of getWorkflowStops(truckEntry)) {
    const entryCompleted = hasUpdate(truckEntry, stop, 'entry');
    const exitCompleted = hasUpdate(truckEntry, stop, 'exit');

    if (requiresEntryForStop(stop) && !entryCompleted) {
      return {
        currentAllowedRole: stop,
        currentAllowedStop: stop,
        currentAction: 'entry',
        workflowStatus: 'pending',
        nextRole: stop,
        nextStop: stop,
      };
    }

    if (!exitCompleted) {
      return {
        currentAllowedRole: stop,
        currentAllowedStop: stop,
        currentAction: 'exit',
        workflowStatus: 'pending',
        nextRole: stop,
        nextStop: stop,
      };
    }
  }

  if (normalizeDestination(truckEntry.destination) === 'dubai') {
    return {
      currentAllowedRole: 'yard',
      currentAllowedStop: 'yard',
      currentAction: null,
      workflowStatus: 'pending',
      nextRole: 'yard',
      nextStop: 'yard',
    };
  }

  return {
    currentAllowedRole: 'port',
    currentAllowedStop: 'port',
    currentAction: 'entry',
    workflowStatus: 'pending',
    nextRole: 'port',
    nextStop: 'port',
  };
};

const serializeWorkflowState = (workflowState) => ({
  ...workflowState,
  currentAllowedRole: toApiStop(workflowState.currentAllowedRole),
  currentAllowedStop: toApiStop(workflowState.currentAllowedStop),
  nextRole: toApiStop(workflowState.nextRole),
  nextStop: toApiStop(workflowState.nextStop),
});

const serializeTruckEntry = (truckEntry) => {
  const entry = truckEntry.toObject ? truckEntry.toObject() : truckEntry;
  const destination = normalizeDestination(entry.destination);
  const updates = getVisibleUpdates(entry).map((update) => {
    const { destination: updateDestination, ...serializedUpdate } = update;
    const selectedAt = formatSelectedLocalDateTime(update.updatedAt);
    const stop = normalizeStop(update.stop, normalizeDestination(entry.destination));
    return {
      ...serializedUpdate,
      stop: toApiStop(stop),
      ...(updateDestination ? { destination: normalizeDestination(updateDestination) } : {}),
      updatedAt: selectedAt,
      crossedAt: selectedAt,
      ...(normalizeText(update.status) === 'entry' ? { entryAt: selectedAt } : {}),
      ...(normalizeText(update.status) === 'exit' ? { exitAt: selectedAt } : {}),
    };
  });
  const yardEntry = updates.find(
    (update) => normalizeText(update.stop) === 'yard' && normalizeText(update.status) === 'entry'
  );
  const latestExit = [...updates].reverse().find((update) => normalizeText(update.status) === 'exit');
  const workflowState = getWorkflowState(entry);
  const latestUpdate = [...updates].reverse()[0] || null;
  const latestStop = normalizeStop(latestUpdate?.stop, destination) || null;
  const latestStatus = normalizeText(latestUpdate?.status) || null;
  const currentStatus =
    workflowState.workflowStatus === 'completed' || workflowState.workflowStatus === 'canceled'
      ? workflowState.workflowStatus
      : latestStatus;
  const isFreeZoneToPortMoving =
    workflowState.workflowStatus !== 'canceled' &&
    isFreeZoneEntryReadyForGateCompletion(entry) &&
    latestStop === 'freezone' &&
    latestStatus === 'exit';
  const nextStop =
    ['completed', 'canceled'].includes(workflowState.workflowStatus)
      ? null
      : isFreeZoneToPortMoving
        ? 'port'
        : getNextRouteStop(latestStop, entry);
  const apiWorkflowState = serializeWorkflowState(workflowState);

  return {
    ...entry,
    id: entry._id,
    truckModel: normalizeTruckModel(entry.truckModel) || entry.truckModel,
    destination,
    dubaiFreeZoneDestination: destination,
    destinationType: destination,
    originStop: getOriginStop(entry),
    updates,
    ...(yardEntry ? { entryAt: yardEntry.updatedAt } : {}),
    ...(latestExit ? { exitAt: latestExit.updatedAt } : {}),
    ...apiWorkflowState,
    currentStop: toApiStop(latestStop),
    currentStatus,
    nextStop: toApiStop(nextStop),
    backendNextStop: toApiStop(nextStop),
    ...(isFreeZoneToPortMoving
      ? {
          currentLocation: 'Moving',
          from: 'Free Zone',
          to: 'Port Loading',
          movementStatus: 'freezoneToPort',
        }
      : {}),
  };
};

const buildTruckEntryLookupQuery = (truckId, headTruckNumber, tailTrailerNumber) => {
  const truckMatches = [];

  if (truckId) {
    truckMatches.push({ truckId });
  }

  if (headTruckNumber && tailTrailerNumber) {
    truckMatches.push({ headTruckNumber, tailTrailerNumber });
  }

  return truckMatches.length === 1 ? truckMatches[0] : { $or: truckMatches };
};

const getEntriesForTruck = async (truckId, headTruckNumber, tailTrailerNumber) => {
  if (truckId) {
    const truckIdEntries = await TruckEntry.find({ truckId }).sort('-createdAt');
    if (truckIdEntries.length > 0) return truckIdEntries;
  }

  if (headTruckNumber && tailTrailerNumber) {
    return TruckEntry.find({ headTruckNumber, tailTrailerNumber }).sort('-createdAt');
  }

  return [];
};

const getAllowedDubaiYardCompletionEntries = (entries, originStop) => {
  if (originStop !== 'yard') return [];

  return entries.filter(isDubaiEntryReadyForYardCompletion);
};

const hasOpenTruckEntry = (entries, allowedOpenEntries = []) => {
  const allowedOpenEntrySet = new Set(allowedOpenEntries);

  return entries.some(
    (entry) =>
      !allowedOpenEntrySet.has(entry) &&
      !['completed', 'canceled'].includes(getWorkflowState(entry).workflowStatus)
  );
};

const toTimeValue = (value) => {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
};

const getLatestActivityTime = (entry) =>
  Math.max(
    toTimeValue(entry?.updatedAt),
    toTimeValue(entry?.createdAt),
    toTimeValue(entry?.completedAt),
    toTimeValue(entry?.canceledAt),
    ...(entry?.updates || []).map((update) => toTimeValue(update.updatedAt))
  );

const sortEntriesByLatestActivity = (entries) =>
  [...entries].sort((first, second) => getLatestActivityTime(second) - getLatestActivityTime(first));

const getLatestCompletedEntry = (entries, effectiveCompletedEntries = []) => {
  const sortedEntries = sortEntriesByLatestActivity(entries);
  const latestEntry = sortedEntries[0] || null;
  const effectiveCompletedEntrySet = new Set(effectiveCompletedEntries);

  if (latestEntry && isCanceledTruckEntry(latestEntry)) return null;

  return (
    sortedEntries.find(
      (entry) =>
        (effectiveCompletedEntrySet.has(entry) || getWorkflowState(entry).workflowStatus === 'completed') &&
        !isCanceledTruckEntry(entry)
    ) || null
  );
};

const getTripCountValue = (entry) => {
  const tripTime = Number(entry?.tripTime);
  if (Number.isFinite(tripTime) && tripTime > 0) return tripTime;

  const tripNumber = Number(entry?.tripNumber);
  return Number.isFinite(tripNumber) && tripNumber > 0 ? tripNumber : 0;
};

const getNextTripCount = (entries) =>
  entries.reduce((max, entry) => Math.max(max, getTripCountValue(entry)), 0) + 1;

const completeLatestDubaiEntryFromYard = async (entries, originStop, user, updatedAt) => {
  const previousEntries = getAllowedDubaiYardCompletionEntries(entries, originStop);
  if (previousEntries.length === 0) return null;

  for (const previousEntry of previousEntries) {
    previousEntry.updates.push({
      stop: 'dubai',
      status: 'completed',
      destination: 'dubai',
      updatedAt,
      teamName: getTeamName(user),
      memberName: user.name,
      remarks: 'Dubai destination trip completed when truck was reassigned from Yard',
    });

    if (typeof previousEntry.save === 'function') {
      await previousEntry.save();
    }
  }

  return previousEntries[0];
};

const completeFreeZoneEntryAtPortLoading = (truckEntry, user, updatedAt, remarks = undefined) => {
  truckEntry.updates.push({
    stop: 'portLoading',
    status: 'completed',
    updatedAt,
    teamName: getTeamName(user),
    memberName: user.name,
    remarks: remarks || 'Free Zone destination trip completed at Port Loading entry',
  });
};

const applyFinishTripUpdates = async (truckEntry, updates = {}, session = null) => {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return { error: { status: 400, message: 'finishTripUpdates must be an object' } };
  }

  if (updates.supplierId !== undefined || updates.supplierName !== undefined) {
    const supplierResult = await resolveActiveSupplierForEntry(updates, { session });

    if (supplierResult.error) return { error: supplierResult.error };

    truckEntry.supplierId = supplierResult.supplier._id;
    truckEntry.supplierName = supplierResult.supplier.supplierName;
  }

  if (updates.shipId !== undefined) {
    if (!mongoose.isValidObjectId(updates.shipId)) {
      return { error: { status: 404, message: 'Ship not found' } };
    }

    const ship = await resolveQueryWithSession(Ship.findById(updates.shipId), session);
    if (!ship) return { error: { status: 404, message: 'Ship not found' } };

    truckEntry.shipId = ship._id;
  }

  if (updates.shipName !== undefined) {
    if (typeof updates.shipName !== 'string' || !updates.shipName.trim()) {
      return { error: { status: 400, message: 'shipName must be a non-empty string' } };
    }

    truckEntry.shipName = updates.shipName.trim();
  }

  if (updates.shipNumber !== undefined) {
    if (typeof updates.shipNumber !== 'string' || !updates.shipNumber.trim()) {
      return { error: { status: 400, message: 'shipNumber must be a non-empty string' } };
    }

    truckEntry.shipNumber = normalizeUpper(updates.shipNumber);
  }

  for (const field of finishTripUpdateFields) {
    if (updates[field] === undefined) continue;

    if (typeof updates[field] !== 'string' || !updates[field].trim()) {
      return { error: { status: 400, message: `${field} must be a non-empty string` } };
    }

    truckEntry[field] = field === 'truckModel' ? normalizeTruckModel(updates[field]) : updates[field].trim();

    if (field === 'truckModel' && !truckEntry[field]) {
      return { error: { status: 400, message: 'truckModel must be one of 2 Axle, 3 Axle, or 6 Wheel' } };
    }
  }

  return {};
};

const buildTruckEntryPayload = (body, truck, ship, supplier, originStop, entryAt, user) => ({
  truckId: truck._id,
  headTruckNumber: normalizeUpper(body.headTruckNumber),
  tailTrailerNumber: normalizeUpper(body.tailTrailerNumber),
  supplierId: supplier._id,
  supplierName: supplier.supplierName,
  shipId: ship._id,
  shipName: body.shipName.trim(),
  shipNumber: normalizeUpper(body.shipNumber),
  tripNumber: body.tripNumber.trim(),
  tripTime: Number(body.tripTime),
  driverName: body.driverName.trim(),
  driverMobile: body.driverMobile.trim(),
  driverTdCardNumber: body.driverTdCardNumber.trim(),
  truckModel: normalizeTruckModel(body.truckModel),
  destination: normalizeDestination(body.destination),
  originStop,
  updates: [
    {
      stop: originStop,
      status: 'entry',
      updatedAt: entryAt,
      teamName: getTeamName(user),
      memberName: user.name,
    },
  ],
});

const getEntryId = (entry) => (entry?._id === undefined || entry?._id === null ? entry?.id : entry._id);
const isSameTruckEntry = (entry, otherEntryOrId) => {
  const entryId = getEntryId(entry);
  const otherId = typeof otherEntryOrId === 'object' ? getEntryId(otherEntryOrId) : otherEntryOrId;

  return entryId !== undefined && otherId !== undefined && String(entryId) === String(otherId);
};

const validateNextTripForGateReturn = async (body, existingTrip, session) => {
  const validationError = validateRequiredFields(body);

  if (validationError) {
    return { error: { status: 400, message: validationError } };
  }

  const originStopUpdate = resolveOriginStopForDestination(body.destination, body.originStop);

  if (originStopUpdate.error) return { error: originStopUpdate.error };
  if (originStopUpdate.originStop !== 'portLoading') {
    return { error: { status: 400, message: 'nextTrip originStop must be portLoading' } };
  }

  if (!mongoose.isValidObjectId(body.shipId)) {
    return { error: { status: 404, message: 'Ship not found' } };
  }

  if (!mongoose.isValidObjectId(body.truckId)) {
    return { error: { status: 404, message: 'Truck not found' } };
  }

  if (String(existingTrip.truckId) !== String(body.truckId)) {
    return { error: { status: 400, message: 'nextTrip must use the same truck' } };
  }

  const truck = await resolveQueryWithSession(Truck.findOne({ _id: body.truckId, isActive: true }), session);
  if (!truck) return { error: { status: 404, message: 'Truck not found' } };

  if (
    normalizeUpper(body.headTruckNumber) !== truck.headTruckNumber ||
    normalizeUpper(body.tailTrailerNumber) !== truck.tailTrailerNumber ||
    normalizeTruckModel(body.truckModel) !== normalizeTruckModel(truck.truckModel)
  ) {
    return { error: { status: 400, message: 'Truck details do not match selected truck' } };
  }

  if (
    normalizeUpper(body.headTruckNumber) !== normalizeUpper(existingTrip.headTruckNumber) ||
    normalizeUpper(body.tailTrailerNumber) !== normalizeUpper(existingTrip.tailTrailerNumber)
  ) {
    return { error: { status: 400, message: 'nextTrip must use the same truck' } };
  }

  const ship = await resolveQueryWithSession(Ship.findById(body.shipId), session);
  if (!ship) return { error: { status: 404, message: 'Ship not found' } };

  const supplierResult = await resolveActiveSupplierForEntry(body, { session });
  if (supplierResult.error) return { error: supplierResult.error };

  const entryAt = body.entryAt
    ? parseSelectedLocalDateTime(body.entryAt)
    : selectedLocalDateTimeFromDate(new Date());

  if (!entryAt) {
    return { error: { status: 400, message: 'nextTrip.entryAt must be a valid date' } };
  }

  return {
    truck,
    ship,
    supplier: supplierResult.supplier,
    originStop: originStopUpdate.originStop,
    entryAt,
  };
};

const validateOriginCycle = (originStop, latestCompletedEntry) => {
  const latestDestination = normalizeDestination(latestCompletedEntry?.destination);

  if (latestDestination === 'dubai' && originStop !== 'yard') {
    return 'This truck completed Dubai, so the next trip can be added only at Yard';
  }

  if (latestDestination === 'freezone' && toWorkflowOriginStop(originStop) !== 'port') {
    return 'This truck completed Free Zone, so the next trip can be added only at Port Loading';
  }

  return null;
};

const resolveOriginStopForDestination = (destination, submittedOriginStop) => {
  const normalizedOriginStop = normalizeOriginStop(submittedOriginStop);

  if (!normalizeDestination(destination)) {
    return { error: { status: 400, message: 'destination must be either dubai or freezone' } };
  }

  if (normalizedOriginStop !== undefined && !isValidOriginStop(normalizedOriginStop)) {
    return { error: { status: 400, message: 'originStop must be either yard or portLoading' } };
  }

  return { originStop: toStoredOriginStop(normalizedOriginStop) || 'yard' };
};

const createTruckEntry = async (req, res, next) => {
  try {
    const body = req.body || {};
    const validationError = validateRequiredFields(body);

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    if (!mongoose.isValidObjectId(body.shipId)) {
      return res.status(404).json({ success: false, message: 'Ship not found' });
    }

    if (!mongoose.isValidObjectId(body.truckId)) {
      return res.status(404).json({ success: false, message: 'Truck not found' });
    }

    const truck = await Truck.findOne({ _id: body.truckId, isActive: true });
    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });

    if (
      normalizeUpper(body.headTruckNumber) !== truck.headTruckNumber ||
      normalizeUpper(body.tailTrailerNumber) !== truck.tailTrailerNumber ||
      normalizeTruckModel(body.truckModel) !== normalizeTruckModel(truck.truckModel)
    ) {
      return res.status(400).json({ success: false, message: 'Truck details do not match selected truck' });
    }

    const ship = await Ship.findById(body.shipId);
    if (!ship) return res.status(404).json({ success: false, message: 'Ship not found' });

    const supplierResult = await resolveActiveSupplierForEntry(body);
    if (supplierResult.error) {
      return res
        .status(supplierResult.error.status)
        .json({ success: false, message: supplierResult.error.message });
    }

    const supplier = supplierResult.supplier;

    const headTruckNumber = normalizeUpper(body.headTruckNumber);
    const tailTrailerNumber = normalizeUpper(body.tailTrailerNumber);
    const destination = normalizeDestination(body.destination);
    const originStopUpdate = resolveOriginStopForDestination(destination, body.originStop);

    if (originStopUpdate.error) {
      return res.status(originStopUpdate.error.status).json({ success: false, message: originStopUpdate.error.message });
    }

    const originStop = originStopUpdate.originStop;
    const existingEntries = sortEntriesByLatestActivity(
      await getEntriesForTruck(truck._id, headTruckNumber, tailTrailerNumber)
    );
    const nextTripCount = getNextTripCount(existingEntries);
    const entryAt = body.entryAt ? parseSelectedLocalDateTime(body.entryAt) : selectedLocalDateTimeFromDate(new Date());

    if (!entryAt) {
      return res.status(400).json({ success: false, message: 'entryAt must be a valid date' });
    }

    const dubaiYardCompletionEntries = getAllowedDubaiYardCompletionEntries(existingEntries, originStop);

    const duplicateOpenEntry = hasOpenTruckEntry(existingEntries, dubaiYardCompletionEntries);

    if (duplicateOpenEntry) {
      return res.status(409).json({ success: false, message: 'Duplicate active truck entry already exists' });
    }

    const originCycleError = validateOriginCycle(originStop, getLatestCompletedEntry(existingEntries, dubaiYardCompletionEntries));

    if (originCycleError) {
      return res.status(400).json({ success: false, message: originCycleError });
    }

    const truckEntry = await TruckEntry.create({
      truckId: truck._id,
      headTruckNumber,
      tailTrailerNumber,
      supplierId: supplier._id,
      supplierName: supplier.supplierName,
      shipId: ship._id,
      shipName: body.shipName.trim(),
      shipNumber: normalizeUpper(body.shipNumber),
      tripNumber: String(nextTripCount),
      tripTime: nextTripCount,
      driverName: body.driverName.trim(),
      driverMobile: body.driverMobile.trim(),
      driverTdCardNumber: body.driverTdCardNumber.trim(),
      truckModel: normalizeTruckModel(body.truckModel),
      destination,
      originStop,
      updates: [
        {
          stop: originStop,
          status: 'entry',
          updatedAt: entryAt,
          teamName: getTeamName(req.user),
          memberName: req.user.name,
        },
      ],
    });

    await completeLatestDubaiEntryFromYard(existingEntries, originStop, req.user, entryAt);

    return res.status(201).json({
      message: 'Truck entry created successfully',
      truckEntry: serializeTruckEntry(truckEntry),
    });
  } catch (error) {
    next(error);
  }
};

const getTruckEntries = async (req, res, next) => {
  try {
    const truckEntries = await TruckEntry.find().populate('shipId', 'shipName shipNumber').sort('-createdAt');
    const serializedTruckEntries = truckEntries.map(serializeTruckEntry);
    const counts = buildDashboardCounts(serializedTruckEntries);

    return res.status(200).json({ counts, truckEntries: serializedTruckEntries });
  } catch (error) {
    next(error);
  }
};

const getTruckEntryById = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Truck entry not found' });
    }

    const truckEntry = await TruckEntry.findById(req.params.id).populate('shipId', 'shipName shipNumber');
    if (!truckEntry) return res.status(404).json({ success: false, message: 'Truck entry not found' });

    return res.status(200).json({ truckEntry: serializeTruckEntry(truckEntry) });
  } catch (error) {
    next(error);
  }
};

const cancelTruckEntry = async (req, res, next) => {
  try {
    const body = req.body || {};

    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin can cancel trips' });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Truck entry not found' });
    }

    if (body.remarks !== undefined && typeof body.remarks !== 'string') {
      return res.status(400).json({ success: false, message: 'remarks must be a string' });
    }

    const canceledAt = body.canceledAt ? parseIsoDateTime(body.canceledAt) : selectedLocalDateTimeFromDate(new Date());

    if (!canceledAt) {
      return res.status(400).json({ success: false, message: 'canceledAt must be a valid ISO datetime' });
    }

    const truckEntry = await TruckEntry.findById(req.params.id).populate('shipId', 'shipName shipNumber');
    if (!truckEntry) return res.status(404).json({ success: false, message: 'Truck entry not found' });

    if (isCanceledTruckEntry(truckEntry)) {
      return res.status(400).json({ success: false, message: 'Truck entry is already canceled' });
    }

    const serializedBeforeCancel = serializeTruckEntry(truckEntry);
    const cancelStop =
      serializedBeforeCancel.currentStop ||
      serializedBeforeCancel.currentAllowedStop ||
      serializedBeforeCancel.originStop ||
      'yard';

    truckEntry.workflowStatus = 'canceled';
    truckEntry.currentStatus = 'canceled';
    truckEntry.currentAction = null;
    truckEntry.currentAllowedRole = null;
    truckEntry.currentAllowedStop = null;
    truckEntry.nextRole = null;
    truckEntry.nextStop = null;
    truckEntry.movementStatus = null;
    truckEntry.canceledAt = canceledAt;
    truckEntry.updates.push({
      stop: cancelStop,
      status: 'canceled',
      updatedAt: canceledAt,
      teamName: req.user ? getTeamName(req.user) : undefined,
      memberId: req.user?._id,
      memberName: req.user?.name,
      remarks: typeof body.remarks === 'string' ? body.remarks.trim() : undefined,
    });

    await truckEntry.save();

    return res.status(200).json({
      message: 'Truck entry canceled successfully',
      truckEntry: serializeTruckEntry(truckEntry),
    });
  } catch (error) {
    next(error);
  }
};

const markGateReturnEntry = async (req, res, next) => {
  if (normalizeStop(req.user.role) !== 'port') {
    return res.status(403).json({ success: false, message: 'You do not have permission' });
  }

  const body = req.body || {};
  const finishTripUpdates = body.finishTripUpdates || {};
  const nextTrip = body.nextTrip;
  const entryAt = body.entryAt
    ? parseSelectedLocalDateTime(body.entryAt)
    : selectedLocalDateTimeFromDate(new Date());

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ success: false, message: 'Truck entry not found' });
  }

  if (!entryAt) {
    return res.status(400).json({ success: false, message: 'entryAt must be a valid date' });
  }

  if (!nextTrip || typeof nextTrip !== 'object' || Array.isArray(nextTrip)) {
    return res.status(400).json({ success: false, message: 'nextTrip is required' });
  }

  if (
    finishTripUpdates.remarks !== undefined &&
    (typeof finishTripUpdates.remarks !== 'string' || !finishTripUpdates.remarks.trim())
  ) {
    return res.status(400).json({ success: false, message: 'remarks must be a non-empty string' });
  }

  const session = await mongoose.startSession();

  try {
    let completedTrip;
    let newTrip;

    await session.withTransaction(async () => {
      const truckEntry = await resolveQueryWithSession(TruckEntry.findById(req.params.id), session);

      if (!truckEntry) {
        const error = new Error('Truck entry not found');
        error.status = 404;
        throw error;
      }

      const workflowState = getWorkflowState(truckEntry);
      const serializedReturningTrip = serializeTruckEntry(truckEntry);

      if (
        normalizeDestination(truckEntry.destination) !== 'freezone' ||
        workflowState.workflowStatus === 'completed' ||
        workflowState.currentAllowedRole !== 'port' ||
        workflowState.currentAllowedStop !== 'port' ||
        workflowState.currentAction !== 'entry' ||
        serializedReturningTrip.movementStatus !== 'freezoneToPort'
      ) {
        const error = new Error('Truck entry is not ready for Free Zone return Port Loading entry');
        error.status = 400;
        throw error;
      }

      const finishUpdateResult = await applyFinishTripUpdates(truckEntry, finishTripUpdates, session);
      if (finishUpdateResult.error) {
        const error = new Error(finishUpdateResult.error.message);
        error.status = finishUpdateResult.error.status;
        throw error;
      }

      const nextTripValidation = await validateNextTripForGateReturn(
        {
          ...nextTrip,
          entryAt: nextTrip.entryAt || entryAt,
        },
        truckEntry,
        session
      );
      if (nextTripValidation.error) {
        const error = new Error(nextTripValidation.error.message);
        error.status = nextTripValidation.error.status;
        throw error;
      }

      const existingEntries = await resolveQueryWithSession(
        TruckEntry.find(
          buildTruckEntryLookupQuery(
            truckEntry.truckId,
            normalizeUpper(truckEntry.headTruckNumber),
            normalizeUpper(truckEntry.tailTrailerNumber)
          )
        ).sort('-createdAt'),
        session
      );
      const nextTripCount = getNextTripCount(existingEntries);
      const duplicateOpenEntry = existingEntries.some(
        (entry) =>
          !isSameTruckEntry(entry, truckEntry) &&
          !isSameTruckEntry(entry, req.params.id) &&
          !['completed', 'canceled'].includes(getWorkflowState(entry).workflowStatus)
      );

      if (duplicateOpenEntry) {
        const error = new Error('Duplicate active truck entry already exists');
        error.status = 409;
        throw error;
      }

      const nextTripPayload = buildTruckEntryPayload(
        {
          ...nextTrip,
          tripNumber: String(nextTripCount),
          tripTime: nextTripCount,
          entryAt: nextTrip.entryAt || entryAt,
        },
        nextTripValidation.truck,
        nextTripValidation.ship,
        nextTripValidation.supplier,
        nextTripValidation.originStop,
        nextTripValidation.entryAt,
        req.user
      );
      const createdTrips = await TruckEntry.create([nextTripPayload], { session });

      truckEntry.updates.push({
        stop: 'portLoading',
        status: 'entry',
        updatedAt: entryAt,
        teamName: getTeamName(req.user),
        memberName: req.user.name,
        remarks: trimString(finishTripUpdates.remarks),
      });
      completeFreeZoneEntryAtPortLoading(truckEntry, req.user, entryAt, trimString(finishTripUpdates.remarks));
      truckEntry.completedAt = entryAt;
      truckEntry.completedLocation = 'portLoading';
      truckEntry.workflowStatus = 'completed';
      truckEntry.currentStatus = 'completed';
      truckEntry.currentAction = null;
      truckEntry.currentAllowedRole = null;
      truckEntry.currentAllowedStop = null;
      truckEntry.nextRole = null;
      truckEntry.nextStop = null;
      truckEntry.movementStatus = null;

      await truckEntry.save({ session });

      completedTrip = truckEntry;
      newTrip = createdTrips[0];
    });

    await completedTrip.populate('shipId', 'shipName shipNumber');
    await newTrip.populate('shipId', 'shipName shipNumber');

    const truckEntries = await TruckEntry.find().populate('shipId', 'shipName shipNumber').sort('-createdAt');
    const serializedTruckEntries = truckEntries.map(serializeTruckEntry);
    const counts = buildDashboardCounts(serializedTruckEntries);

    return res.status(200).json({
      message: 'Free Zone return Port Loading entry completed and next trip created successfully',
      completedTrip: serializeTruckEntry(completedTrip),
      newTrip: serializeTruckEntry(newTrip),
      counts,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    next(error);
  } finally {
    session.endSession();
  }
};

const validateWorkflowUpdate = (truckEntry, userRole, action) => {
  const workflowState = getWorkflowState(truckEntry);
  const workflowStops = getWorkflowStops(truckEntry);

  if (workflowState.workflowStatus === 'completed') {
    return { status: 400, message: 'Truck entry workflow is already completed' };
  }

  const normalizedUserRole = normalizeStop(userRole, normalizeDestination(truckEntry.destination));
  const userStopIndex = workflowStops.indexOf(normalizedUserRole);
  const allowedStopIndex = workflowStops.indexOf(workflowState.currentAllowedRole);

  if (userStopIndex === -1 || !workflowRoles.includes(normalizedUserRole)) {
    return { status: 403, message: 'You do not have permission' };
  }

  if (userStopIndex > allowedStopIndex) {
    return { status: 400, message: 'Previous stop is not completed' };
  }

  if (workflowState.currentAllowedRole !== normalizedUserRole) {
    return { status: 403, message: 'You do not have permission' };
  }

  if (action === 'entry' && workflowState.currentAction !== 'entry') {
    return { status: 400, message: `${normalizedUserRole} entry already exists` };
  }

  if (action === 'exit' && workflowState.currentAction === 'entry') {
    return { status: 400, message: 'Exit cannot be completed before entry' };
  }

  if (action === 'exit' && workflowState.currentAction !== 'exit') {
    return { status: 400, message: `${normalizedUserRole} exit already exists` };
  }

  return null;
};

const resolveEntryDestinationUpdate = (truckEntry, body = {}) => {
  const existingDestination = normalizeDestination(truckEntry.destination);
  const submittedDestination =
    body.destination === undefined ? existingDestination : normalizeDestination(body.destination);

  if (!submittedDestination) {
    return {
      error: { status: 400, message: 'Dubai or Free Zone destination is required' },
    };
  }

  if (existingDestination && submittedDestination !== existingDestination) {
    return {
      error: { status: 400, message: 'destination cannot be updated here' },
    };
  }

  return { destination: submittedDestination };
};

const appendWorkflowUpdate = async (req, res, next, action) => {
  try {
    const body = req.body || {};

    if (body.destination !== undefined && action !== 'entry') {
      return res.status(400).json({ success: false, message: 'destination cannot be updated here' });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Truck entry not found' });
    }

    const truckEntry = await TruckEntry.findById(req.params.id);
    if (!truckEntry) return res.status(404).json({ success: false, message: 'Truck entry not found' });

    if (action === 'entry') {
      const destinationUpdate = resolveEntryDestinationUpdate(truckEntry, body);

      if (destinationUpdate.error) {
        return res
          .status(destinationUpdate.error.status)
          .json({ success: false, message: destinationUpdate.error.message });
      }

      if (truckEntry.destination !== destinationUpdate.destination) {
        truckEntry.destination = destinationUpdate.destination;
      }
    }

    const workflowError = validateWorkflowUpdate(truckEntry, req.user.role, action);

    if (workflowError) {
      return res.status(workflowError.status).json({ success: false, message: workflowError.message });
    }

    if (
      action === 'entry' &&
      normalizeStop(req.user.role, normalizeDestination(truckEntry.destination)) === 'port' &&
      isFreeZoneEntryReadyForGateCompletion(truckEntry)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Use gate-return-entry endpoint to complete Free Zone return and create next trip',
      });
    }

    const dateField = action === 'entry' ? 'entryAt' : 'exitAt';
    const updatedAt = body[dateField]
      ? parseSelectedLocalDateTime(body[dateField])
      : selectedLocalDateTimeFromDate(new Date());

    if (!updatedAt) {
      return res.status(400).json({ success: false, message: `${dateField} must be a valid date` });
    }

    if (body.remarks !== undefined && typeof body.remarks !== 'string') {
      return res.status(400).json({ success: false, message: 'remarks must be a string' });
    }

    truckEntry.updates.push({
      stop: normalizeStop(req.user.role, normalizeDestination(truckEntry.destination)),
      status: action,
      updatedAt,
      teamName: getTeamName(req.user),
      memberName: req.user.name,
      remarks: typeof body.remarks === 'string' ? body.remarks.trim() : undefined,
    });

    await truckEntry.save();
    await truckEntry.populate('shipId', 'shipName shipNumber');

    return res.status(200).json({
      message: `Truck ${action} updated successfully`,
      truckEntry: serializeTruckEntry(truckEntry),
    });
  } catch (error) {
    next(error);
  }
};

const markTeamEntry = (req, res, next) => appendWorkflowUpdate(req, res, next, 'entry');

const markTeamExit = (req, res, next) => appendWorkflowUpdate(req, res, next, 'exit');

module.exports = {
  createTruckEntry,
  getTruckEntries,
  getTruckEntryById,
  cancelTruckEntry,
  markGateReturnEntry,
  markTeamEntry,
  markTeamExit,
  getWorkflowState,
  resolveEntryDestinationUpdate,
  serializeTruckEntry,
  validateOriginCycle,
  resolveOriginStopForDestination,
  completeLatestDubaiEntryFromYard,
};
