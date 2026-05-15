const Truck = require('../models/Truck');
const Trip = require('../models/Trip');
const { STOPS, ROUTE_MARKERS, ROUTE_LINES } = require('../constants/stops');

const buildRouteStats = async () => {
  const routes = await Promise.all(
    ROUTE_LINES.map(async ({ from, to }) => {
      const trucks = await Truck.find({
        isActive: true,
        currentStop: to,
        status: 'in_transit',
      }).select('truckNumber currentStop status');

      return {
        from,
        to,
        count: trucks.length,
        truckNumbers: trucks.map((truck) => truck.truckNumber),
      };
    })
  );

  return routes;
};

const getSummary = async (req, res, next) => {
  try {
    const [totalTrucks, movingTrucks, completedTrips, groupedStops, routes] = await Promise.all([
      Truck.countDocuments({ isActive: true }),
      Truck.countDocuments({ isActive: true, status: 'in_transit' }),
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
        movingTrucks,
        completedTrips,
        trucksByStop,
        trucksInTransit: movingTrucks,
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

    const trucks = await Truck.find({
      isActive: true,
      currentStop: to,
      status: 'in_transit',
    });

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
};
