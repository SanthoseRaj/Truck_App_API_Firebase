const Truck = require('../models/Truck');
const Trip = require('../models/Trip');
const ActivityLog = require('../models/ActivityLog');
const { STOPS } = require('../constants/stops');

const createActivity = (truck, user, action, stop, details = '') =>
  ActivityLog.create({ truck, user, action, stop, details });

const getNextStop = (stop) => {
  const index = STOPS.indexOf(stop);
  return index >= 0 && index < STOPS.length - 1 ? STOPS[index + 1] : undefined;
};

const createTruck = async (req, res, next) => {
  try {
    const {
      truckNumber,
      supplierName,
      tripNumber,
      driverName,
      driverMobile,
      idCard,
      truckModel,
    } = req.body;

    if (!truckNumber || !supplierName || !tripNumber || !driverName || !driverMobile || !idCard || !truckModel) {
      return res.status(400).json({ success: false, message: 'All truck fields are required' });
    }

    const normalizedTruckNumber = truckNumber.toUpperCase().trim();
    let truck = await Truck.findOne({ truckNumber: normalizedTruckNumber });
    let created = false;

    if (truck) {
      truck.supplierName = supplierName;
      truck.tripNumber = tripNumber;
      truck.driverName = driverName;
      truck.driverMobile = driverMobile;
      truck.idCard = idCard;
      truck.truckModel = truckModel;
      truck.tripCount += 1;
      truck.currentStop = STOPS[0];
      truck.status = 'waiting';
      truck.isActive = true;
      await truck.save();
    } else {
      created = true;
      truck = await Truck.create({
        truckNumber: normalizedTruckNumber,
        supplierName,
        tripNumber,
        driverName,
        driverMobile,
        idCard,
        truckModel,
        currentStop: STOPS[0],
        status: 'waiting',
        createdBy: req.user._id,
      });
    }

    const trip = await Trip.create({
      truck: truck._id,
      routeStops: STOPS,
      currentStop: STOPS[0],
      nextStop: getNextStop(STOPS[0]),
      status: 'waiting',
      startedAt: new Date(),
      updatedBy: req.user._id,
    });

    await createActivity(
      truck._id,
      req.user._id,
      created ? 'truck_created' : 'truck_trip_incremented',
      STOPS[0],
      created ? 'Truck created at Yard' : `Truck reused for trip count ${truck.tripCount}`
    );

    return res.status(created ? 201 : 200).json({ success: true, data: { truck, trip } });
  } catch (error) {
    next(error);
  }
};

const getTrucks = async (req, res, next) => {
  try {
    const trucks = await Truck.find({ isActive: true }).populate('createdBy', 'name username role').sort('-createdAt');
    return res.json({ success: true, count: trucks.length, data: trucks });
  } catch (error) {
    next(error);
  }
};

const getTruckById = async (req, res, next) => {
  try {
    const truck = await Truck.findOne({ _id: req.params.id, isActive: true }).populate('createdBy', 'name username role');
    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });
    return res.json({ success: true, data: truck });
  } catch (error) {
    next(error);
  }
};

const getTruckByNumber = async (req, res, next) => {
  try {
    const truck = await Truck.findOne({
      truckNumber: req.params.truckNumber.toUpperCase().trim(),
      isActive: true,
    }).populate('createdBy', 'name username role');

    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });
    return res.json({ success: true, data: truck });
  } catch (error) {
    next(error);
  }
};

const updateTruck = async (req, res, next) => {
  try {
    const disallowed = ['truckNumber', 'tripCount', 'createdBy'];
    disallowed.forEach((field) => delete req.body[field]);

    const truck = await Truck.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      req.body,
      { new: true, runValidators: true }
    );

    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });
    await createActivity(truck._id, req.user._id, 'truck_updated', truck.currentStop, 'Truck details updated');
    return res.json({ success: true, data: truck });
  } catch (error) {
    next(error);
  }
};

const deleteTruck = async (req, res, next) => {
  try {
    const truck = await Truck.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });
    await createActivity(truck._id, req.user._id, 'truck_deleted', truck.currentStop, 'Truck soft deleted');
    return res.json({ success: true, message: 'Truck deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTruck,
  getTrucks,
  getTruckById,
  getTruckByNumber,
  updateTruck,
  deleteTruck,
};
