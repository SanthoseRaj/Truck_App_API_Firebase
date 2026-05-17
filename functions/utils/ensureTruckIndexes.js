const Truck = require('../models/Truck');

const HEAD_TRUCK_NUMBER_INDEX = 'headTruckNumber_1';
const LEGACY_TRUCK_NUMBER_INDEX = 'truckNumber_1';

const ensureTruckIndexes = async () => {
  const indexes = await Truck.collection.indexes();
  const legacyTruckNumberIndex = indexes.find((index) => index.name === LEGACY_TRUCK_NUMBER_INDEX);
  const headTruckNumberIndex = indexes.find((index) => index.name === HEAD_TRUCK_NUMBER_INDEX);

  if (legacyTruckNumberIndex) {
    await Truck.collection.dropIndex(LEGACY_TRUCK_NUMBER_INDEX);
  }

  if (headTruckNumberIndex && !headTruckNumberIndex.unique) {
    await Truck.collection.dropIndex(HEAD_TRUCK_NUMBER_INDEX);
  }

  await Truck.collection.createIndex(
    { headTruckNumber: 1 },
    {
      name: HEAD_TRUCK_NUMBER_INDEX,
      unique: true,
    }
  );
};

module.exports = ensureTruckIndexes;
