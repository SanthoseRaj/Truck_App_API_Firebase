const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema(
  {
    supplierName: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
    },
    supplierNameKey: {
      type: String,
      required: true,
      trim: true,
      select: false,
    },
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

supplierSchema.index({ supplierNameKey: 1 });
supplierSchema.index({ isActive: 1, supplierName: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
