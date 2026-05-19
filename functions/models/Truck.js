const mongoose = require('mongoose');
const { TRUCK_MODEL_DISPLAY_VALUES } = require('../utils/truckModel');

const truckSchema = new mongoose.Schema(
  {
    headTruckNumber: {
      type: String,
      required: [true, 'Head truck number is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    tailTrailerNumber: {
      type: String,
      required: [true, 'Tail trailer number is required'],
      uppercase: true,
      trim: true,
    },
    truckModel: {
      type: String,
      required: [true, 'Truck model is required'],
      enum: {
        values: TRUCK_MODEL_DISPLAY_VALUES,
        message: 'truckModel must be one of 2 Axle, 3 Axle, or 6 Wheel',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Truck', truckSchema);
