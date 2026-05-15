const Driver = require('../models/Driver');

const ensureDriverIndexes = async () => {
  await Driver.collection.createIndex({ mobileNumber: 1 }, { name: 'mobileNumber_1', unique: true });
  await Driver.collection.createIndex({ idNumber: 1 }, { name: 'idNumber_1', unique: true });
  await Driver.collection.createIndex({ driverName: 1 }, { name: 'driverName_1' });
};

module.exports = ensureDriverIndexes;
