const Truck = require('../models/Truck');
const TruckEntry = require('../models/TruckEntry');

const normalizeUpper = (value) => (value || '').toString().trim().toUpperCase();
const trimString = (value) => (value || '').toString().trim();

const hasSupplierAssigned = (truck = {}) =>
  Boolean(trimString(truck.supplierId) || trimString(truck.supplierName));

const hasTripSupplier = (trip = {}) =>
  Boolean(trimString(trip.supplierId) || trimString(trip.supplierName));

const objectIdString = (value) => {
  if (!value) return '';
  if (value._id) return String(value._id);
  return String(value);
};

const datesForTrip = (trip = {}) => [
  trip.updatedAt,
  trip.createdAt,
  ...(trip.updates || []).map((update) => update.updatedAt),
].filter(Boolean);

const tripActivityTime = (trip = {}) => {
  const times = datesForTrip(trip)
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));

  return times.length ? Math.max(...times) : 0;
};

const isCanceledTrip = (trip = {}) => {
  const statuses = [
    trip.workflowStatus,
    trip.currentStatus,
    ...(trip.updates || []).map((update) => update.status),
  ];

  return statuses.some((status) => trimString(status).toLowerCase() === 'canceled');
};

const tailsMatchWhenBothPresent = (truck = {}, trip = {}) => {
  const truckTail = normalizeUpper(truck.tailTrailerNumber);
  const tripTail = normalizeUpper(trip.tailTrailerNumber);
  return !truckTail || !tripTail || truckTail === tripTail;
};

const tripMatchesTruckId = (truck = {}, trip = {}) =>
  objectIdString(trip.truckId) && objectIdString(trip.truckId) === objectIdString(truck._id);

const tripMatchesHeadNumber = (truck = {}, trip = {}) =>
  !objectIdString(trip.truckId) &&
  normalizeUpper(trip.headTruckNumber) &&
  normalizeUpper(trip.headTruckNumber) === normalizeUpper(truck.headTruckNumber);

const latestTrip = (trips = []) =>
  [...trips].sort((a, b) => tripActivityTime(b) - tripActivityTime(a))[0] || null;

const findLatestSupplierTripForTruck = (truck = {}, trips = []) => {
  const usableTrips = trips.filter((trip) => !isCanceledTrip(trip) && tailsMatchWhenBothPresent(truck, trip));
  const truckIdMatches = usableTrips.filter((trip) => tripMatchesTruckId(truck, trip));

  if (truckIdMatches.length) return latestTrip(truckIdMatches);

  return latestTrip(usableTrips.filter((trip) => tripMatchesHeadNumber(truck, trip)));
};

const supplierAssignmentFromTrip = (trip) => {
  if (!trip) return null;
  if (!hasTripSupplier(trip)) return null;

  return {
    supplierId: trimString(trip.supplierId) ? trip.supplierId : null,
    supplierName: trimString(trip.supplierName),
  };
};

const unassignedSupplierQuery = () => ({
  $expr: {
    $or: [
      { $eq: [{ $ifNull: ['$supplierId', null] }, null] },
      { $eq: [{ $toString: '$supplierId' }, ''] },
    ],
  },
  supplierName: { $in: [null, ''] },
});

const buildTruckTripLookupQuery = (truck = {}) => ({
  $or: [
    { truckId: truck._id },
    {
      truckId: { $exists: false },
      headTruckNumber: normalizeUpper(truck.headTruckNumber),
    },
    {
      truckId: null,
      headTruckNumber: normalizeUpper(truck.headTruckNumber),
    },
  ],
  workflowStatus: { $ne: 'canceled' },
  currentStatus: { $ne: 'canceled' },
  'updates.status': { $ne: 'canceled' },
});

const backfillRegisteredTruckSupplier = async (truck, options = {}) => {
  const { TruckEntryModel = TruckEntry, TruckModel = Truck, dryRun = false } = options;

  if (hasSupplierAssigned(truck)) return { updated: false, reason: 'supplier-already-assigned' };

  const trips = await TruckEntryModel.find(buildTruckTripLookupQuery(truck)).sort('-updatedAt -createdAt');
  const latestMatchingTrip = findLatestSupplierTripForTruck(truck, trips);
  const assignment = supplierAssignmentFromTrip(latestMatchingTrip);

  if (!latestMatchingTrip) return { updated: false, reason: 'no-matching-trip' };
  if (!assignment) return { updated: false, reason: 'latest-trip-has-no-supplier', trip: latestMatchingTrip };

  if (!dryRun) {
    await TruckModel.updateOne(
      {
        _id: truck._id,
        ...unassignedSupplierQuery(),
      },
      { $set: assignment }
    );
  }

  return { updated: true, assignment, trip: latestMatchingTrip };
};

const backfillRegisteredTruckSuppliers = async (options = {}) => {
  const { TruckModel = Truck, TruckEntryModel = TruckEntry, dryRun = false } = options;
  const trucks = await TruckModel.find(unassignedSupplierQuery()).sort('headTruckNumber');

  const summary = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    dryRun,
    results: [],
  };

  for (const truck of trucks) {
    summary.scanned += 1;
    const result = await backfillRegisteredTruckSupplier(truck, { TruckModel, TruckEntryModel, dryRun });
    if (result.updated) summary.updated += 1;
    else summary.skipped += 1;

    summary.results.push({
      truckId: objectIdString(truck._id),
      headTruckNumber: truck.headTruckNumber,
      updated: result.updated,
      reason: result.reason,
      supplierName: result.assignment?.supplierName,
      supplierId: result.assignment?.supplierId ? objectIdString(result.assignment.supplierId) : null,
      tripId: result.trip?._id ? objectIdString(result.trip._id) : null,
    });
  }

  return summary;
};

module.exports = {
  backfillRegisteredTruckSupplier,
  backfillRegisteredTruckSuppliers,
  buildTruckTripLookupQuery,
  findLatestSupplierTripForTruck,
  hasSupplierAssigned,
  hasTripSupplier,
  isCanceledTrip,
  supplierAssignmentFromTrip,
  tripActivityTime,
  unassignedSupplierQuery,
};
