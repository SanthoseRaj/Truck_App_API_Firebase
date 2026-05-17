const Supplier = require('../models/Supplier');

const ensureSupplierIndexes = async () => {
  await Supplier.collection.createIndex({ supplierNameKey: 1 }, { name: 'supplierNameKey_1', unique: true });
  await Supplier.collection.createIndex({ isActive: 1, supplierName: 1 }, { name: 'isActive_1_supplierName_1' });
};

module.exports = ensureSupplierIndexes;
