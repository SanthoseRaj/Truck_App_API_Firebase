require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { backfillRegisteredTruckSuppliers } = require('../services/truckSupplierBackfillService');

const main = async () => {
  const dryRun = process.argv.includes('--dry-run');
  await connectDB();

  const summary = await backfillRegisteredTruckSuppliers({ dryRun });
  console.log(JSON.stringify(summary, null, 2));
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
