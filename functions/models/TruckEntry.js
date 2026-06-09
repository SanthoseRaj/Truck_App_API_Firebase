const mongoose = require('mongoose');
const { TRUCK_MODEL_DISPLAY_VALUES } = require('../utils/truckModel');

const truckEntryUpdateSchema = new mongoose.Schema(
  {
    stop: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      trim: true,
    },
    destination: {
      type: String,
      enum: ['dubai', 'freezone', 'freeZone', 'freezoneDubai'],
      trim: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    teamName: {
      type: String,
      trim: true,
    },
    memberName: {
      type: String,
      trim: true,
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const truckEntrySchema = new mongoose.Schema(
  {
    truckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Truck',
      required: [true, 'Truck is required'],
    },
    headTruckNumber: {
      type: String,
      required: [true, 'Head truck number is required'],
      uppercase: true,
      trim: true,
    },
    tailTrailerNumber: {
      type: String,
      required: [true, 'Tail trailer number is required'],
      uppercase: true,
      trim: true,
    },
    supplierName: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
    },
    shipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ship',
      required: [true, 'Ship is required'],
    },
    shipName: {
      type: String,
      required: [true, 'Ship name is required'],
      trim: true,
    },
    shipNumber: {
      type: String,
      required: [true, 'Ship number is required'],
      uppercase: true,
      trim: true,
    },
    tripNumber: {
      type: String,
      required: [true, 'Trip number is required'],
      trim: true,
    },
    tripTime: {
      type: Number,
      required: [true, 'Trip time is required'],
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
    driverTdCardNumber: {
      type: String,
      required: [true, 'Driver TD card number is required'],
      trim: true,
    },
    truckModel: {
      type: String,
      enum: {
        values: TRUCK_MODEL_DISPLAY_VALUES,
        message: 'truckModel must be one of 2 Axle, 3 Axle, 6 Wheel, or Flat Trailer',
      },
      required: [true, 'Truck model is required'],
    },
    destination: {
      type: String,
      enum: ['dubai', 'freezone', 'freeZone', 'freezoneDubai'],
      trim: true,
    },
    originStop: {
      type: String,
      enum: ['yard', 'gate', 'port', 'portLoading'],
      default: 'yard',
      trim: true,
    },
    updates: [truckEntryUpdateSchema],
    workflowStatus: {
      type: String,
      enum: ['pending', 'completed', 'canceled'],
      trim: true,
    },
    currentStatus: {
      type: String,
      enum: ['entry', 'exit', 'completed', 'moving', 'canceled'],
      trim: true,
    },
    currentAction: {
      type: String,
      enum: ['entry', 'exit', null],
      default: undefined,
    },
    currentAllowedRole: {
      type: String,
      trim: true,
      default: undefined,
    },
    currentAllowedStop: {
      type: String,
      trim: true,
      default: undefined,
    },
    nextRole: {
      type: String,
      trim: true,
      default: undefined,
    },
    nextStop: {
      type: String,
      trim: true,
      default: undefined,
    },
    movementStatus: {
      type: String,
      trim: true,
      default: undefined,
    },
    canceledAt: Date,
    completedAt: Date,
    completedLocation: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TruckEntry', truckEntrySchema);
