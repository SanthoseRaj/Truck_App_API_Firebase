const mongoose = require('mongoose');
const { STOPS } = require('../constants/stops');

const truckSchema = new mongoose.Schema(
  {
    truckNumber: {
      type: String,
      required: [true, 'Truck number is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    supplierName: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
    },
    tripNumber: {
      type: String,
      required: [true, 'Trip number is required'],
      trim: true,
    },
    driverName: {
      type: String,
      required: [true, 'Driver name is required'],
      trim: true,
    },
    driverMobile: {
      type: String,
      required: [true, 'Driver mobile is required'],
      trim: true,
    },
    idCard: {
      type: String,
      required: [true, 'ID card is required'],
      trim: true,
    },
    truckModel: {
      type: String,
      required: [true, 'Truck model is required'],
      enum: ['3 axis', '6 axis'],
    },
    tripCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    currentStop: {
      type: String,
      enum: STOPS,
      default: STOPS[0],
    },
    status: {
      type: String,
      enum: ['waiting', 'entered', 'exited', 'in_transit', 'completed'],
      default: 'waiting',
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
