const TruckEntry = require('../models/TruckEntry');
const { normalizeDestination } = require('../utils/destination');
const {
  normalizeStop,
  requiresEntryForStop,
  getWorkflowStopsForDestination,
  getNextStopForDestination,
  toApiStop,
} = require('../utils/workflow');
const { formatSelectedLocalDateTime } = require('../utils/selectedLocalDateTime');
const { getDashboardCountRouteKeyForTruckEntry } = require('../utils/dashboardRouteGrouping');
const { normalizeTruckModel } = require('../utils/truckModel');

const dashboardDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

const normalizeText = (value) => value?.toString().toLowerCase().trim();
const getOriginStop = (truckEntry) => {
  const normalized = normalizeStop(truckEntry.originStop);
  return normalized === 'port' ? 'portLoading' : truckEntry.originStop || 'yard';
};
const getWorkflowStops = (truckEntry) =>
  getWorkflowStopsForDestination(normalizeDestination(truckEntry.destination), normalizeStop(getOriginStop(truckEntry)));

const hasUpdate = (truckEntry, stop, status) =>
  (truckEntry.updates || []).some(
    (update) =>
      normalizeStop(update.stop, normalizeDestination(truckEntry.destination)) === stop &&
      normalizeText(update.status) === status
  );

const hasCompletedUpdate = (truckEntry) =>
  (truckEntry.updates || []).some((update) => normalizeText(update.status) === 'completed');

const hasCanceledUpdate = (truckEntry) =>
  (truckEntry.updates || []).some((update) => normalizeText(update.status) === 'canceled');

const isCanceledTruckEntry = (truckEntry) =>
  normalizeText(truckEntry?.workflowStatus) === 'canceled' ||
  normalizeText(truckEntry?.currentStatus) === 'canceled' ||
  hasCanceledUpdate(truckEntry);

const isCompletedFreeZoneDestination = (truckEntry) =>
  normalizeDestination(truckEntry?.destination) === 'freezone' && hasCompletedUpdate(truckEntry);

const isFreeZoneEntryReadyForGateCompletion = (truckEntry) =>
  normalizeDestination(truckEntry?.destination) === 'freezone' &&
  hasUpdate(truckEntry, 'freezone', 'exit') &&
  !hasCompletedUpdate(truckEntry);

const getLatestUpdate = (truckEntry, range = null) => {
  if (!truckEntry.updates?.length) return null;

  const updates = range
    ? truckEntry.updates.filter((update) => isDateInRange(update.updatedAt, range))
    : truckEntry.updates;

  if (!updates.length) return null;

  return [...updates].sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt)).at(-1);
};

const getNextStopForEntry = (stop, truckEntry) =>
  getNextStopForDestination(stop, normalizeDestination(truckEntry.destination), normalizeStop(getOriginStop(truckEntry)));

const getWorkflowStatus = (truckEntry) => {
  if (isCanceledTruckEntry(truckEntry)) return 'canceled';
  if (hasCompletedUpdate(truckEntry)) return 'completed';

  const completed = getWorkflowStops(truckEntry).every(
    (stop) =>
      (!requiresEntryForStop(stop) || hasUpdate(truckEntry, stop, 'entry')) &&
      hasUpdate(truckEntry, stop, 'exit')
  );

  if (normalizeDestination(truckEntry.destination) === 'dubai') return 'active';

  return completed && !isFreeZoneEntryReadyForGateCompletion(truckEntry) ? 'completed' : 'active';
};

const getWorkflowState = (truckEntry) => {
  if (isCanceledTruckEntry(truckEntry)) {
    return {
      currentAllowedRole: null,
      currentAllowedStop: null,
      currentAction: null,
    };
  }

  if (hasCompletedUpdate(truckEntry)) {
    if (isCompletedFreeZoneDestination(truckEntry)) {
      return {
        currentAllowedRole: 'port',
        currentAllowedStop: 'port',
        currentAction: null,
      };
    }

    return {
      currentAllowedRole: null,
      currentAllowedStop: null,
      currentAction: null,
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
      };
    }

    if (!exitCompleted) {
      return {
        currentAllowedRole: stop,
        currentAllowedStop: stop,
        currentAction: 'exit',
      };
    }
  }

  if (normalizeDestination(truckEntry.destination) === 'dubai') {
    return {
      currentAllowedRole: 'yard',
      currentAllowedStop: 'yard',
      currentAction: null,
    };
  }

  return {
    currentAllowedRole: 'port',
    currentAllowedStop: 'port',
    currentAction: 'entry',
  };
};

const getDashboardDateRange = (value) => {
  if (typeof value !== 'string') return null;

  const match = value.trim().match(dashboardDatePattern);
  if (!match) return null;

  const [, year, month, day] = match;
  const start = new Date(Number(year), Number(month) - 1, Number(day));

  if (
    start.getFullYear() !== Number(year) ||
    start.getMonth() !== Number(month) - 1 ||
    start.getDate() !== Number(day)
  ) {
    return null;
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

const buildDashboardDateFilter = (date) => {
  const range = getDashboardDateRange(date);
  if (!range) return null;

  return {
    updates: {
      $elemMatch: {
        updatedAt: { $gte: range.start, $lt: range.end },
      },
    },
  };
};

const isDateInRange = (value, range) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return date >= range.start && date < range.end;
};

const filterDashboardTruckEntriesByDate = (truckEntries, date) => {
  const range = getDashboardDateRange(date);
  if (!range) return null;

  return truckEntries.filter((truckEntry) => {
    const entry = truckEntry.toObject ? truckEntry.toObject() : truckEntry;

    return (entry.updates || []).some((update) => isDateInRange(update.updatedAt, range));
  });
};

const getActiveMapCount = (counts) => {
  const stops = counts.stops || {};
  const routes = counts.routes || {};

  return (
    (stops.yard || 0) +
    (stops.portLoading || 0) +
    (stops.clearence || 0) +
    (stops.customClearance || 0) +
    (stops.dubai || 0) +
    (stops.freezone || 0) +
    (routes.yardToPortLoading || 0) +
    (routes.portToClearence || 0) +
    (routes.clearenceToDubai || 0) +
    (routes.clearenceToFreezone || 0) +
    (routes.dubaiToYard || 0) +
    (routes.freezoneToPortLoading || 0)
  );
};

const serializePublicTruckEntry = (truckEntry, options = {}) => {
  const entry = truckEntry.toObject ? truckEntry.toObject() : truckEntry;
  const latestUpdate = getLatestUpdate(entry, options.dateRange);
  const destination = normalizeDestination(entry.destination);
  const currentStop = normalizeStop(latestUpdate?.stop, destination);
  const latestStatus = normalizeText(latestUpdate?.status) || null;
  const workflowStatus = options.dateRange
    ? latestStatus === 'canceled'
      ? 'canceled'
      : latestStatus === 'completed'
      ? 'completed'
      : 'active'
    : getWorkflowStatus(entry);
  const currentStatus = ['completed', 'canceled'].includes(workflowStatus) ? workflowStatus : latestStatus;
  const workflowState =
    workflowStatus === 'completed'
      ? normalizeDestination(entry.destination) === 'freezone'
        ? { currentAllowedRole: 'port', currentAllowedStop: 'port', currentAction: null }
        : { currentAllowedRole: null, currentAllowedStop: null, currentAction: null }
      : getWorkflowState(entry);
  const apiWorkflowState = {
    ...workflowState,
    currentAllowedRole: toApiStop(workflowState.currentAllowedRole),
    currentAllowedStop: toApiStop(workflowState.currentAllowedStop),
  };
  const isFreeZoneToPortMoving =
    workflowStatus !== 'canceled' &&
    isFreeZoneEntryReadyForGateCompletion(entry) &&
    currentStop === 'freezone' &&
    latestStatus === 'exit';
  const nextStop =
    ['completed', 'canceled'].includes(workflowStatus)
      ? null
      : isFreeZoneToPortMoving
        ? 'port'
        : getNextStopForEntry(currentStop, entry);

  return {
    _id: entry._id,
    headTruckNumber: entry.headTruckNumber,
    tailTrailerNumber: entry.tailTrailerNumber,
    supplierName: entry.supplierName,
    shipId: entry.shipId,
    shipName: entry.shipName,
    shipNumber: entry.shipNumber,
    tripNumber: entry.tripNumber,
    tripTime: entry.tripTime,
    driverName: entry.driverName,
    driverMobile: entry.driverMobile,
    driverTdCardNumber: entry.driverTdCardNumber,
    truckModel: normalizeTruckModel(entry.truckModel) || entry.truckModel,
    destination,
    dubaiFreeZoneDestination: destination,
    destinationType: destination,
    originStop: getOriginStop(entry),
    currentStop: toApiStop(currentStop),
    currentStatus,
    nextStop: toApiStop(nextStop),
    backendNextStop: toApiStop(nextStop),
    workflowStatus,
    ...apiWorkflowState,
    ...(isFreeZoneToPortMoving
      ? {
          currentLocation: 'Moving',
          from: 'Free Zone',
          to: 'Port Loading',
          movementStatus: 'freezoneToPort',
        }
      : {}),
    updates: (entry.updates || []).map((update) => {
      const selectedAt = formatSelectedLocalDateTime(update.updatedAt);
      const status = normalizeText(update.status);

      return {
        stop: toApiStop(normalizeStop(update.stop, destination)),
        status,
        ...(update.destination ? { destination: normalizeDestination(update.destination) } : {}),
        updatedAt: selectedAt,
        teamName: update.teamName,
        memberId: update.memberId,
        memberName: update.memberName,
        crossedAt: selectedAt,
        ...(status === 'entry' ? { entryAt: selectedAt } : {}),
        ...(status === 'exit' ? { exitAt: selectedAt } : {}),
      };
    }),
  };
};

const buildDashboardCounts = (truckEntries, options = {}) => {
  const counts = {
    totalActive: 0,
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
      portToClearence: 0,
      clearenceToDubai: 0,
      clearenceToFreezone: 0,
      dubaiToYard: 0,
      freezoneToPortLoading: 0,
    },
  };

  truckEntries.forEach((truckEntry) => {
    if (truckEntry.workflowStatus === 'canceled' || truckEntry.currentStatus === 'canceled') {
      return;
    }

    const isCompletedFreeZoneReadyForGate =
      truckEntry.workflowStatus === 'completed' && normalizeDestination(truckEntry.destination) === 'freezone';

    if (options.dateScoped) {
      if (truckEntry.currentStop === 'dubai' && ['exit', 'completed'].includes(truckEntry.currentStatus)) {
        counts.exitedDubai += 1;
      }

      if (isCompletedFreeZoneReadyForGate) {
        counts.stops.portLoading += 1;
        return;
      }

      const currentStop = toApiStop(truckEntry.currentStop);

      if (truckEntry.currentStatus === 'entry' && currentStop in counts.stops) {
        counts.stops[currentStop] += 1;
        return;
      }

      if (
        truckEntry.currentStatus === 'exit' ||
        truckEntry.currentStatus === 'moving' ||
        truckEntry.currentStatus === 'completed'
      ) {
        const routeKey = getDashboardCountRouteKeyForTruckEntry(truckEntry);

        if (routeKey) {
          counts.routes[routeKey] += 1;
          counts.moving += 1;
        }
      }

      return;
    }

    if (hasUpdate(truckEntry, 'dubai', 'exit')) {
      counts.exitedDubai += 1;
    }

    if (truckEntry.workflowStatus === 'completed') {
      if (isCompletedFreeZoneReadyForGate) {
        counts.stops.portLoading += 1;
      }

      return;
    }

    const currentStop = toApiStop(truckEntry.currentStop);

    if (truckEntry.currentStatus === 'entry' && currentStop in counts.stops) {
      counts.stops[currentStop] += 1;
    }

    if (truckEntry.currentStatus === 'exit' || truckEntry.currentStatus === 'moving') {
      const routeKey = getDashboardCountRouteKeyForTruckEntry(truckEntry);

      if (routeKey) {
        counts.routes[routeKey] += 1;
        counts.moving += 1;
      }
    }
  });

  counts.totalActive = getActiveMapCount(counts);
  counts.totalTrucks = counts.totalActive;

  return counts;
};

const getPublicDashboardTruckEntries = async (req, res, next) => {
  try {
    const query = {
      isDeleted: { $ne: true },
      workflowStatus: { $ne: 'canceled' },
      currentStatus: { $ne: 'canceled' },
      'updates.status': { $ne: 'canceled' },
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    };

    if (req.query?.date !== undefined) {
      const dateFilter = buildDashboardDateFilter(req.query.date);

      if (!dateFilter) {
        return res.status(400).json({ success: false, message: 'date must be in YYYY-MM-DD format' });
      }

      query.$and = [dateFilter];
    }

    const truckEntries = await TruckEntry.find(query).sort('-createdAt');
    const dateRange = req.query?.date !== undefined ? getDashboardDateRange(req.query.date) : null;
    const filteredTruckEntries =
      req.query?.date !== undefined ? filterDashboardTruckEntriesByDate(truckEntries, req.query.date) : truckEntries;
    const publicTruckEntries = filteredTruckEntries.map((truckEntry) =>
      serializePublicTruckEntry(truckEntry, dateRange ? { dateRange } : {})
    );
    const counts = buildDashboardCounts(publicTruckEntries, { dateScoped: Boolean(dateRange) });

    console.log(
      `[public-dashboard] entries=${publicTruckEntries.length} active=${counts.totalActive} moving=${counts.moving}`
    );

    res.set('Cache-Control', 'no-store');

    return res.status(200).json({
      counts,
      truckEntries: publicTruckEntries,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicDashboardTruckEntries,
  buildDashboardCounts,
  buildDashboardDateFilter,
  filterDashboardTruckEntriesByDate,
  getDashboardDateRange,
  getActiveMapCount,
  serializePublicTruckEntry,
};
