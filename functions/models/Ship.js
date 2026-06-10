const mongoose = require('mongoose');

const shipSchema = new mongoose.Schema(
  {
    shipName: {
      type: String,
      required: [true, 'Ship name is required'],
      trim: true,
    },
    shipNumber: {
      type: String,
      uppercase: true,
      trim: true,
    },
    quantityOfCargoOnBoard: {
      type: Number,
      required: [true, 'Quantity of cargo on board is required'],
    },
    eta: {
      type: String,
      required: [true, 'ETA is required'],
      trim: true,
    },
    atb: {
      type: String,
      required: [true, 'ATB is required'],
      trim: true,
    },
    dailyDischargeRate: {
      type: Number,
      required: [true, 'Daily discharge rate is required'],
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

shipSchema.index({ createdAt: -1 });
shipSchema.index({ shipNumber: 1 }, { unique: true, sparse: true });
shipSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Ship', shipSchema);
