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
const originStops = ['yard', 'gate'];

const normalizeUpper = (value) => value.trim().toUpperCase();
const normalizeText = (value) => value?.toLowerCase().trim();

const isValidOriginStop = (originStop) => originStop === undefined || originStops.includes(originStop);
const normalizeOriginStop = (originStop) => {
  if (originStop === undefined) return undefined;
  if (originStop === null) return null;
  return originStop.toString().trim().toLowerCase();
};
const getOriginStop = (truckEntry) => truckEntry.originStop || 'yard';
const getWorkflowStops = (truckEntry) =>
  getWorkflowStopsForDestination(normalizeDestination(truckEntry.destination), getOriginStop(truckEntry));
const getNextRouteStop = (stop, truckEntry) =>
  getNextStopForDestination(stop, normalizeDestination(truckEntry.destination), getOriginStop(truckEntry));

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
    return 'originStop must be either yard or gate';
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
  truckEntry.updates.some((update) => normalizeText(update.status) === 'completed');

const isDubaiEntryReadyForYardCompletion = (truckEntry) =>
  normalizeDestination(truckEntry?.destination) === 'dubai' &&
  hasUpdate(truckEntry, 'clearence', 'exit') &&
  !hasCompletedUpdate(truckEntry);

const getWorkflowState = (truckEntry) => {
  if (hasCompletedUpdate(truckEntry)) {
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
    currentAllowedRole: null,
    currentAllowedStop: null,
    currentAction: null,
    workflowStatus: 'completed',
    nextRole: null,
    nextStop: null,
  };
};

const serializeTruckEntry = (truckEntry) => {
  const entry = truckEntry.toObject ? truckEntry.toObject() : truckEntry;
  const destination = normalizeDestination(entry.destination);
  const updates = entry.updates.map((update) => {
    const { destination: updateDestination, ...serializedUpdate } = update;
    const selectedAt = formatSelectedLocalDateTime(update.updatedAt);
    const stop = normalizeStop(update.stop, normalizeDestination(entry.destination));
    return {
      ...serializedUpdate,
      stop,
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
  const latestStop = normalizeText(latestUpdate?.stop) || null;
  const latestStatus = normalizeText(latestUpdate?.status) || null;
  const currentStatus = workflowState.workflowStatus === 'completed' ? 'completed' : latestStatus;
  const nextStop = workflowState.workflowStatus === 'completed' ? null : getNextRouteStop(latestStop, entry);

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
    ...workflowState,
    currentStop: latestStop,
    currentStatus,
    nextStop,
  };
};

const getEntriesForTruck = (headTruckNumber, tailTrailerNumber) =>
  TruckEntry.find({
    headTruckNumber,
    tailTrailerNumber,
  }).sort('-createdAt');

const getAllowedDubaiYardCompletionEntry = (entries, originStop) => {
  if (originStop !== 'yard') return null;

  return entries.find(isDubaiEntryReadyForYardCompletion) || null;
};

const hasOpenTruckEntry = (entries, allowedOpenEntry = null) =>
  entries.some(
    (entry) => entry !== allowedOpenEntry && getWorkflowState(entry).workflowStatus !== 'completed'
  );
const getLatestCompletedEntry = (entries, effectiveCompletedEntry = null) =>
  entries.find(
    (entry) => entry === effectiveCompletedEntry || getWorkflowState(entry).workflowStatus === 'completed'
  ) || null;

const completeLatestDubaiEntryFromYard = async (entries, originStop, user, updatedAt) => {
  const previousEntry = getAllowedDubaiYardCompletionEntry(entries, originStop);
  if (!previousEntry) return null;

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

  return previousEntry;
};

const validateOriginCycle = (originStop, latestCompletedEntry) => {
  const latestDestination = normalizeDestination(latestCompletedEntry?.destination);

  if (latestDestination === 'dubai' && originStop !== 'yard') {
    return 'This truck completed Dubai, so the next trip can be added only at Yard';
  }

  if (latestDestination === 'freezone' && originStop !== 'gate') {
    return 'This truck completed Free Zone, so the next trip can be added only at Gate';
  }

  return null;
};

const resolveOriginStopForDestination = (destination, submittedOriginStop) => {
  const normalizedOriginStop = normalizeOriginStop(submittedOriginStop);

  if (!normalizeDestination(destination)) {
    return { error: { status: 400, message: 'destination must be either dubai or freezone' } };
  }

  if (normalizedOriginStop !== undefined && !isValidOriginStop(normalizedOriginStop)) {
    return { error: { status: 400, message: 'originStop must be either yard or gate' } };
  }

  return { originStop: normalizedOriginStop || 'yard' };
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
    const existingEntries = await getEntriesForTruck(headTruckNumber, tailTrailerNumber);
    const entryAt = body.entryAt ? parseSelectedLocalDateTime(body.entryAt) : selectedLocalDateTimeFromDate(new Date());

    if (!entryAt) {
      return res.status(400).json({ success: false, message: 'entryAt must be a valid date' });
    }

    const dubaiYardCompletionEntry = getAllowedDubaiYardCompletionEntry(existingEntries, originStop);

    const duplicateOpenEntry = hasOpenTruckEntry(existingEntries, dubaiYardCompletionEntry);

    if (duplicateOpenEntry) {
      return res.status(409).json({ success: false, message: 'Duplicate active truck entry already exists' });
    }

    const originCycleError = validateOriginCycle(originStop, getLatestCompletedEntry(existingEntries, dubaiYardCompletionEntry));

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
      tripNumber: body.tripNumber.trim(),
      tripTime: Number(body.tripTime),
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
  markTeamEntry,
  markTeamExit,
  getWorkflowState,
  resolveEntryDestinationUpdate,
  serializeTruckEntry,
  validateOriginCycle,
  resolveOriginStopForDestination,
  completeLatestDubaiEntryFromYard,
};
