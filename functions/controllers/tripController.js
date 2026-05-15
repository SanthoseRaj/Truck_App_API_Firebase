const Truck = require('../models/Truck');
const Trip = require('../models/Trip');
const ActivityLog = require('../models/ActivityLog');
const { STOPS, STOP_ROLE_MAP } = require('../constants/stops');

const getCurrentTrip = async (truckId) =>
  Trip.findOne({ truck: truckId }).sort('-createdAt').populate('updatedBy', 'name username role');

const nextStopFor = (stop) => {
  const index = STOPS.indexOf(stop);
  return index >= 0 && index < STOPS.length - 1 ? STOPS[index + 1] : undefined;
};

const canOperateAtStop = (user, stop) => {
  if (['admin'].includes(user.role)) return true;
  return STOP_ROLE_MAP[stop] === user.role;
};

const logActivity = (truck, user, action, stop, details = '') =>
  ActivityLog.create({ truck, user, action, stop, details });

const findActiveTruck = async (truckId) => Truck.findOne({ _id: truckId, isActive: true });

const markEntry = async (req, res, next) => {
  try {
    const truck = await findActiveTruck(req.params.truckId);
    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });
    if (!canOperateAtStop(req.user, truck.currentStop)) {
      return res.status(403).json({ success: false, message: `Only ${STOP_ROLE_MAP[truck.currentStop]} can mark entry here` });
    }

    const trip = await getCurrentTrip(truck._id);
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });

    const now = new Date();
    trip.status = 'entered';
    trip.entryTime = now;
    trip.updatedBy = req.user._id;
    trip.remarks = req.body.remarks || trip.remarks;
    truck.status = 'entered';

    await Promise.all([trip.save(), truck.save()]);
    await logActivity(truck._id, req.user._id, 'entry_marked', truck.currentStop, req.body.remarks || '');

    return res.json({ success: true, data: { truck, trip } });
  } catch (error) {
    next(error);
  }
};

const markExit = async (req, res, next) => {
  try {
    const truck = await findActiveTruck(req.params.truckId);
    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });
    if (!canOperateAtStop(req.user, truck.currentStop)) {
      return res.status(403).json({ success: false, message: `Only ${STOP_ROLE_MAP[truck.currentStop]} can mark exit here` });
    }

    const trip = await getCurrentTrip(truck._id);
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });

    const now = new Date();
    const isFinalStop = truck.currentStop === STOPS[STOPS.length - 1];
    trip.status = isFinalStop ? 'completed' : 'exited';
    trip.exitTime = now;
    trip.completedAt = isFinalStop ? now : trip.completedAt;
    trip.updatedBy = req.user._id;
    trip.remarks = req.body.remarks || trip.remarks;
    truck.status = trip.status;

    await Promise.all([trip.save(), truck.save()]);
    await logActivity(truck._id, req.user._id, 'exit_marked', truck.currentStop, req.body.remarks || '');

    return res.json({ success: true, data: { truck, trip } });
  } catch (error) {
    next(error);
  }
};

const moveNext = async (req, res, next) => {
  try {
    const truck = await findActiveTruck(req.params.truckId);
    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });

    if (!['admin', STOP_ROLE_MAP[truck.currentStop]].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You cannot move this truck from its current stop' });
    }

    const nextStop = nextStopFor(truck.currentStop);
    const trip = await getCurrentTrip(truck._id);
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });

    if (!nextStop) {
      const now = new Date();
      truck.status = 'completed';
      trip.status = 'completed';
      trip.completedAt = now;
      trip.updatedBy = req.user._id;
      await Promise.all([truck.save(), trip.save()]);
      await logActivity(truck._id, req.user._id, 'trip_completed', truck.currentStop, 'Trip completed');
      return res.json({ success: true, data: { truck, trip } });
    }

    const previousStop = truck.currentStop;
    truck.currentStop = nextStop;
    truck.status = 'in_transit';
    trip.currentStop = nextStop;
    trip.nextStop = nextStopFor(nextStop);
    trip.status = 'in_transit';
    trip.entryTime = undefined;
    trip.exitTime = undefined;
    trip.updatedBy = req.user._id;
    trip.remarks = req.body.remarks || trip.remarks;

    await Promise.all([truck.save(), trip.save()]);
    await logActivity(truck._id, req.user._id, 'moved_next', nextStop, `Moved from ${previousStop} to ${nextStop}`);

    return res.json({ success: true, data: { truck, trip, from: previousStop, to: nextStop } });
  } catch (error) {
    next(error);
  }
};

const getTripHistory = async (req, res, next) => {
  try {
    const truck = await Truck.findById(req.params.truckId);
    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });

    const [trips, activity] = await Promise.all([
      Trip.find({ truck: truck._id }).populate('updatedBy', 'name username role').sort('-createdAt'),
      ActivityLog.find({ truck: truck._id }).populate('user', 'name username role').sort('-createdAt'),
    ]);

    return res.json({ success: true, data: { truck, trips, activity } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  markEntry,
  markExit,
  moveNext,
  getTripHistory,
};
