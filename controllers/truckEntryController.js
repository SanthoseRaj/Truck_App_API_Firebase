const mongoose = require('mongoose');
const Ship = require('../models/Ship');
const TruckEntry = require('../models/TruckEntry');
const { normalizeDestination } = require('../utils/destination');
const {
  formatSelectedLocalDateTime,
  parseSelectedLocalDateTime,
  selectedLocalDateTimeFromDate,
} = require('../utils/selectedLocalDateTime');

const requiredFields = [
  'headTruckNumber',
  'tailTrailerNumber',
  'supplierName',
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
const workflowStops = ['yard', 'gate', 'port', 'clearence', 'dubai'];
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
const getWorkflowStops = (truckEntry) => {
  const originIndex = workflowStops.indexOf(getOriginStop(truckEntry));

  return originIndex >= 0 ? workflowStops.slice(originIndex) : workflowStops;
};
const getNextRouteStop = (stop) => {
  const index = workflowStops.indexOf(stop);

  return index >= 0 && index < workflowStops.length - 1 ? workflowStops[index + 1] : null;
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

  if (!['threeAxis', 'sixAxis'].includes(body.truckModel)) {
    return 'truckModel must be either threeAxis or sixAxis';
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
  truckEntry.updates.some((update) => normalizeText(update.stop) === stop && normalizeText(update.status) === status);

const getWorkflowState = (truckEntry) => {
  for (const stop of getWorkflowStops(truckEntry)) {
    const entryCompleted = hasUpdate(truckEntry, stop, 'entry');
    const exitCompleted = hasUpdate(truckEntry, stop, 'exit');

    if (!entryCompleted) {
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
  const updates = entry.updates.map((update) => {
    const { destination, ...serializedUpdate } = update;
    const selectedAt = formatSelectedLocalDateTime(update.updatedAt);
    return {
      ...serializedUpdate,
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
  const nextStop = workflowState.workflowStatus === 'completed' ? null : getNextRouteStop(latestStop);

  return {
    ...entry,
    id: entry._id,
    destination: normalizeDestination(entry.destination),
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

const hasOpenTruckEntry = (entries) => entries.some((entry) => getWorkflowState(entry).workflowStatus !== 'completed');
const getLatestCompletedEntry = (entries) =>
  entries.find((entry) => getWorkflowState(entry).workflowStatus === 'completed') || null;

const validateOriginCycle = (originStop, latestCompletedEntry) => {
  const latestDestination = normalizeDestination(latestCompletedEntry?.destination);

  if (latestDestination === 'dubai' && originStop !== 'yard') {
    return 'Latest completed Dubai trip must start the next trip from Yard';
  }

  if (latestDestination === 'freezone' && originStop !== 'gate') {
    return 'Latest completed Free Zone trip must start the next trip from Gate';
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

    const ship = await Ship.findById(body.shipId);
    if (!ship) return res.status(404).json({ success: false, message: 'Ship not found' });

    const headTruckNumber = normalizeUpper(body.headTruckNumber);
    const tailTrailerNumber = normalizeUpper(body.tailTrailerNumber);
    const destination = normalizeDestination(body.destination);
    const originStopUpdate = resolveOriginStopForDestination(destination, body.originStop);

    if (originStopUpdate.error) {
      return res.status(originStopUpdate.error.status).json({ success: false, message: originStopUpdate.error.message });
    }

    const originStop = originStopUpdate.originStop;
    const existingEntries = await getEntriesForTruck(headTruckNumber, tailTrailerNumber);
    const duplicateOpenEntry = hasOpenTruckEntry(existingEntries);

    if (duplicateOpenEntry) {
      return res.status(409).json({ success: false, message: 'Duplicate active truck entry already exists' });
    }

    const originCycleError = validateOriginCycle(originStop, getLatestCompletedEntry(existingEntries));

    if (originCycleError) {
      return res.status(400).json({ success: false, message: originCycleError });
    }

    const entryAt = body.entryAt ? parseSelectedLocalDateTime(body.entryAt) : selectedLocalDateTimeFromDate(new Date());

    if (!entryAt) {
      return res.status(400).json({ success: false, message: 'entryAt must be a valid date' });
    }

    const truckEntry = await TruckEntry.create({
      headTruckNumber,
      tailTrailerNumber,
      supplierName: body.supplierName.trim(),
      shipId: ship._id,
      shipName: body.shipName.trim(),
      shipNumber: normalizeUpper(body.shipNumber),
      tripNumber: body.tripNumber.trim(),
      tripTime: Number(body.tripTime),
      driverName: body.driverName.trim(),
      driverMobile: body.driverMobile.trim(),
      driverTdCardNumber: body.driverTdCardNumber.trim(),
      truckModel: body.truckModel,
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
    return res.status(200).json({ truckEntries: truckEntries.map(serializeTruckEntry) });
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

  if (workflowState.workflowStatus === 'completed') {
    return { status: 400, message: 'Truck entry workflow is already completed' };
  }

  const userStopIndex = workflowStops.indexOf(userRole);
  const allowedStopIndex = workflowStops.indexOf(workflowState.currentAllowedRole);

  if (userStopIndex === -1) {
    return { status: 403, message: 'You do not have permission' };
  }

  if (userStopIndex > allowedStopIndex) {
    return { status: 400, message: 'Previous stop is not completed' };
  }

  if (workflowState.currentAllowedRole !== userRole) {
    return { status: 403, message: 'You do not have permission' };
  }

  if (action === 'entry' && workflowState.currentAction !== 'entry') {
    return { status: 400, message: `${userRole} entry already exists` };
  }

  if (action === 'exit' && workflowState.currentAction === 'entry') {
    return { status: 400, message: 'Exit cannot be completed before entry' };
  }

  if (action === 'exit' && workflowState.currentAction !== 'exit') {
    return { status: 400, message: `${userRole} exit already exists` };
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
      stop: req.user.role,
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
};
