const mongoose = require('mongoose');
const { STOPS } = require('../constants/stops');

const tripSchema = new mongoose.Schema(
  {
    truck: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Truck',
      required: true,
    },
    routeStops: {
      type: [String],
      enum: STOPS,
      default: STOPS,
    },
    currentStop: {
      type: String,
      enum: STOPS,
      required: true,
      default: STOPS[0],
    },
    nextStop: {
      type: String,
      enum: STOPS,
      default: STOPS[1],
    },
    status: {
      type: String,
      enum: ['waiting', 'entered', 'exited', 'in_transit', 'completed'],
      default: 'waiting',
    },
    entryTime: Date,
    exitTime: Date,
    startedAt: Date,
    completedAt: Date,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

tripSchema.index({ truck: 1, createdAt: -1 });

module.exports = mongoose.model('Trip', tripSchema);
