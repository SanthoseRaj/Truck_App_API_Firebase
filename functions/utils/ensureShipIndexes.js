const Ship = require('../models/Ship');

const SHIP_NUMBER_INDEX = 'shipNumber_1';
const SHIP_NUMBER_PARTIAL_FILTER = { shipNumber: { $type: 'string', $gt: '' } };

const ensureShipIndexes = async () => {
  const indexes = await Ship.collection.indexes();
  const shipNumberIndex = indexes.find((index) => index.name === SHIP_NUMBER_INDEX);
  const expectedFilter = JSON.stringify(SHIP_NUMBER_PARTIAL_FILTER);
  const currentFilter = JSON.stringify(shipNumberIndex && shipNumberIndex.partialFilterExpression);

  if (shipNumberIndex && (!shipNumberIndex.unique || currentFilter !== expectedFilter)) {
    await Ship.collection.dropIndex(SHIP_NUMBER_INDEX);
  }

  await Ship.collection.createIndex(
    { shipNumber: 1 },
    {
      name: SHIP_NUMBER_INDEX,
      unique: true,
      partialFilterExpression: SHIP_NUMBER_PARTIAL_FILTER,
    }
  );
};

module.exports = ensureShipIndexes;
