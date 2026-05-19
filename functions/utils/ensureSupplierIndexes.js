const Supplier = require('../models/Supplier');

const ensureSupplierIndexes = async () => {
  try {
    await Supplier.collection.dropIndex('supplierNameKey_1');
  } catch (error) {
    if (error.codeName !== 'IndexNotFound') throw error;
  }
  await Supplier.collection.createIndex({ supplierNameKey: 1 }, { name: 'supplierNameKey_1' });
  await Supplier.collection.createIndex({ isActive: 1, supplierName: 1 }, { name: 'isActive_1_supplierName_1' });
};

module.exports = ensureSupplierIndexes;
