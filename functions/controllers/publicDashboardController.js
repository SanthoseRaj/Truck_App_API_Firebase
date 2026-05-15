const TruckEntry = require('../models/TruckEntry');
const { normalizeDestination } = require('../utils/destination');
const { formatSelectedLocalDateTime } = require('../utils/selectedLocalDateTime');

const workflowStops = ['yard', 'gate', 'port', 'clearence', 'dubai'];
const routeKeys = {
  yard: 'yardToGate',
  gate: 'gateToPort',
  port: 'portToClearence',
  clearence: 'clearenceToDubai',
};
const dashboardDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

const normalizeText = (value) => value?.toString().toLowerCase().trim();
const getOriginStop = (truckEntry) => truckEntry.originStop || 'yard';
const getWorkflowStops = (truckEntry) => {
  const originStop = getOriginStop(truckEntry);
  const originIndex = workflowStops.indexOf(originStop);

  return originIndex >= 0 ? workflowStops.slice(originIndex) : workflowStops;
};

const hasUpdate = (truckEntry, stop, status) =>
  (truckEntry.updates || []).some(
    (update) => normalizeText(update.stop) === stop && normalizeText(update.status) === status
  );

const getLatestUpdate = (truckEntry, range = null) => {
  if (!truckEntry.updates?.length) return null;

  const updates = range
    ? truckEntry.updates.filter((update) => isDateInRange(update.updatedAt, range))
    : truckEntry.updates;

  if (!updates.length) return null;

  return [...updates].sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt)).at(-1);
};

const getNextStop = (stop) => {
  const index = workflowStops.indexOf(stop);
  return index >= 0 && index < workflowStops.length - 1 ? workflowStops[index + 1] : null;
};

const getWorkflowStatus = (truckEntry) => {
  const completed = getWorkflowStops(truckEntry).every(
    (stop) => hasUpdate(truckEntry, stop, 'entry') && hasUpdate(truckEntry, stop, 'exit')
  );

  return completed ? 'completed' : 'active';
};

const getWorkflowState = (truckEntry) => {
  for (const stop of getWorkflowStops(truckEntry)) {
    const entryCompleted = hasUpdate(truckEntry, stop, 'entry');
    const exitCompleted = hasUpdate(truckEntry, stop, 'exit');

    if (!entryCompleted) {
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

  return {
    currentAllowedRole: null,
    currentAllowedStop: null,
    currentAction: null,
  };
};

const getTruckIdentity = (truckEntry) => {
  const head = normalizeText(truckEntry.headTruckNumber) || '';
  const tail = normalizeText(truckEntry.tailTrailerNumber) || '';

  return `${head}|${tail}`;
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

const serializePublicTruckEntry = (truckEntry, options = {}) => {
  const entry = truckEntry.toObject ? truckEntry.toObject() : truckEntry;
  const latestUpdate = getLatestUpdate(entry, options.dateRange);
  const currentStop = normalizeText(latestUpdate?.stop) || null;
  const latestStatus = normalizeText(latestUpdate?.status) || null;
  const workflowStatus = options.dateRange
    ? latestStatus === 'completed'
      ? 'completed'
      : 'active'
    : getWorkflowStatus(entry);
  const currentStatus = workflowStatus === 'completed' ? 'completed' : latestStatus;
  const workflowState =
    workflowStatus === 'completed'
      ? { currentAllowedRole: null, currentAllowedStop: null, currentAction: null }
      : getWorkflowState(entry);

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
    truckModel: entry.truckModel,
    destination: normalizeDestination(entry.destination),
    originStop: getOriginStop(entry),
    currentStop,
    currentStatus,
    nextStop: workflowStatus === 'completed' ? null : getNextStop(currentStop),
    workflowStatus,
    ...workflowState,
    updates: (entry.updates || []).map((update) => {
      const selectedAt = formatSelectedLocalDateTime(update.updatedAt);
      const status = normalizeText(update.status);

      return {
        stop: normalizeText(update.stop),
        status,
        updatedAt: selectedAt,
        teamName: update.teamName,
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
      gate: 0,
      port: 0,
      clearence: 0,
      dubai: 0,
    },
    routes: {
      yardToGate: 0,
      gateToPort: 0,
      portToClearence: 0,
      clearenceToDubai: 0,
    },
  };

  const activeTruckIdentities = new Set();

  truckEntries.forEach((truckEntry) => {
    if (options.dateScoped) {
      counts.totalActive += 1;

      if (truckEntry.currentStop === 'dubai' && ['exit', 'completed'].includes(truckEntry.currentStatus)) {
        counts.exitedDubai += 1;
        return;
      }

      if (truckEntry.currentStatus === 'entry' && truckEntry.currentStop in counts.stops) {
        counts.stops[truckEntry.currentStop] += 1;
        return;
      }

      if (truckEntry.currentStatus === 'exit' || truckEntry.currentStatus === 'moving') {
        const routeKey = routeKeys[truckEntry.currentStop];
        const nextStop = getNextStop(truckEntry.currentStop);

        if (routeKey && nextStop) {
          counts.routes[routeKey] += 1;
          counts.moving += 1;
        }
      }

      return;
    }

    if (hasUpdate(truckEntry, 'dubai', 'exit')) {
      counts.exitedDubai += 1;
    }

    if (truckEntry.workflowStatus === 'completed') return;

    if (truckEntry.currentStatus === 'entry' && truckEntry.currentStop in counts.stops) {
      counts.stops[truckEntry.currentStop] += 1;
    }

    if (truckEntry.currentStatus === 'exit' || truckEntry.currentStatus === 'moving') {
      const routeKey = routeKeys[truckEntry.currentStop];
      const nextStop = getNextStop(truckEntry.currentStop);

      if (routeKey && nextStop) {
        counts.routes[routeKey] += 1;
        counts.moving += 1;
      }
    }

    activeTruckIdentities.add(getTruckIdentity(truckEntry));
  });

  if (!options.dateScoped) {
    counts.totalActive = activeTruckIdentities.size;
  }

  return counts;
};

const getPublicDashboardTruckEntries = async (req, res, next) => {
  try {
    const query = {
      isDeleted: { $ne: true },
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
  serializePublicTruckEntry,
};
