const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      required: true,
      enum: ['owner', 'admin', 'yard', 'gate', 'port', 'clearence', 'dubai'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    entryTeam: {
      id: { type: String, trim: true },
      name: { type: String, trim: true },
      stop: { type: String, trim: true },
      role: { type: String, trim: true },
      order: { type: Number },
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
