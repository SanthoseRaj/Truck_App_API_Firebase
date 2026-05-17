const mongoose = require('mongoose');

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
        values: ['sixAxis', 'fourAxis'],
        message: 'truckModel must be either sixAxis or fourAxis',
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
