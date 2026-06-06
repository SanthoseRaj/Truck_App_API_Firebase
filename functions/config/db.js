const mongoose = require('mongoose');

let connectPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing. Add it to your .env file.');
  }

  if (!connectPromise) {
    connectPromise = mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
    });
  }

  await connectPromise;

  console.log(`MongoDB connected: ${mongoose.connection.host}`);

  return mongoose.connection;
};

module.exports = connectDB;