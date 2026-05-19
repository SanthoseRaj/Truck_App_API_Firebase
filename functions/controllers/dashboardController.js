const Truck = require('../models/Truck');
const Trip = require('../models/Trip');
const TruckEntry = require('../models/TruckEntry');
const { STOPS, ROUTE_MARKERS, ROUTE_LINES } = require('../constants/stops');
const { serializeTruckEntry } = require('./truckEntryController');
const { getDashboardRouteLabelsForTruckEntry } = require('../utils/dashboardRouteGrouping');

const getRouteForTruckEntry = (truckEntry) => {
  if (!['exit', 'moving'].includes(truckEntry.currentStatus)) return null;

  return getDashboardRouteLabelsForTruckEntry(truckEntry);
};

const getActiveTruckEntries = () =>
  TruckEntry.find({
    isDeleted: { $ne: true },
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  }).sort('-createdAt');

const buildRouteStatsFromTruckEntries = (truckEntries) =>
  ROUTE_LINES.map(({ from, to }) => {
    const trucks = truckEntries.filter((truckEntry) => {
      const route = getRouteForTruckEntry(truckEntry);
      return route?.from === from && route?.to === to;
    });

    return {
      from,
      to,
      count: trucks.length,
      truckNumbers: trucks.map((truck) => truck.headTruckNumber),
      trucks,
    };
  });

const buildRouteStats = async () => {
  const truckEntries = (await getActiveTruckEntries()).map(serializeTruckEntry);
  return buildRouteStatsFromTruckEntries(truckEntries);
};

const getSummary = async (req, res, next) => {
  try {
    const [totalTrucks, completedTrips, groupedStops, routes] = await Promise.all([
      Truck.countDocuments({ isActive: true }),
      Trip.countDocuments({ status: 'completed' }),
      Truck.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$currentStop', count: { $sum: 1 } } },
      ]),
      buildRouteStats(),
    ]);

    const trucksByStop = STOPS.reduce((acc, stop) => {
      const item = groupedStops.find((group) => group._id === stop);
      acc[stop] = item ? item.count : 0;
      return acc;
    }, {});

    return res.json({
      success: true,
      data: {
        totalTrucks,
        movingTrucks: routes.reduce((total, route) => total + route.count, 0),
        completedTrips,
        trucksByStop,
        trucksInTransit: routes.reduce((total, route) => total + route.count, 0),
        routes,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMap = async (req, res, next) => {
  try {
    const [trucks, routes] = await Promise.all([
      Truck.find({ isActive: true }).select('truckNumber currentStop status driverName driverMobile'),
      buildRouteStats(),
    ]);

    return res.json({
      success: true,
      data: {
        markers: ROUTE_MARKERS.map((marker) => ({
          ...marker,
          trucks: trucks.filter((truck) => truck.currentStop === marker.stop),
        })),
        routeLines: ROUTE_LINES,
        trucksBetweenStops: routes.filter((route) => route.count > 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getRouteTrucks = async (req, res, next) => {
  try {
    const { from, to } = req.params;
    if (!STOPS.includes(from) || !STOPS.includes(to)) {
      return res.status(400).json({ success: false, message: 'Invalid from or to stop' });
    }

    const routes = await buildRouteStats();
    const route = routes.find((item) => item.from === from && item.to === to);
    const trucks = route?.trucks || [];

    return res.json({
      success: true,
      data: {
        from,
        to,
        count: trucks.length,
        trucks,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSummary,
  getMap,
  getRouteTrucks,
  buildRouteStatsFromTruckEntries,
  getRouteForTruckEntry,
};
