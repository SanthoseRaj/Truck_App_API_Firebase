const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema(
  {
    driverName: {
      type: String,
      required: [true, 'Driver name is required'],
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    idNumber: {
      type: String,
      required: [true, 'ID number is required'],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

driverSchema.index({ mobileNumber: 1 }, { unique: true });
driverSchema.index({ idNumber: 1 }, { unique: true });
driverSchema.index({ driverName: 1 });

module.exports = mongoose.model('Driver', driverSchema);
