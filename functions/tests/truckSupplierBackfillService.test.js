const assert = require('assert');
const {
  backfillRegisteredTruckSupplier,
  findLatestSupplierTripForTruck,
} = require('../services/truckSupplierBackfillService');

const truckId = '507f1f77bcf86cd799439010';
const supplierId = '507f1f77bcf86cd799439012';

const makeTruck = (overrides = {}) => ({
  _id: truckId,
  headTruckNumber: 'HT-100',
  tailTrailerNumber: 'TT-100',
  supplierId: null,
  supplierName: '',
  ...overrides,
});

const makeTrip = (overrides = {}) => ({
  _id: overrides._id || 'trip-1',
  truckId,
  headTruckNumber: 'HT-100',
  tailTrailerNumber: 'TT-100',
  supplierId,
  supplierName: 'Gulf Supplier',
  workflowStatus: 'pending',
  currentStatus: 'entry',
  createdAt: new Date('2026-05-01T08:00:00.000Z'),
  updatedAt: new Date('2026-05-01T09:00:00.000Z'),
  updates: [],
  ...overrides,
});

const runBackfill = async (truck, trips) => {
  let updatePayload = null;
  let updateFilter = null;

  const TruckEntryModel = {
    find() {
      return {
        sort: async () => trips,
      };
    },
  };
  const TruckModel = {
    updateOne: async (filter, payload) => {
      updateFilter = filter;
      updatePayload = payload;
      return { modifiedCount: 1 };
    },
  };

  const result = await backfillRegisteredTruckSupplier(truck, { TruckEntryModel, TruckModel });
  return { result, updateFilter, updatePayload };
};

(async () => {
  const latestSupplierTrip = makeTrip({
    _id: 'latest-supplier-trip',
    supplierName: 'Latest Supplier',
    updatedAt: new Date('2026-05-03T09:00:00.000Z'),
    updates: [{ status: 'entry', updatedAt: new Date('2026-05-03T10:00:00.000Z') }],
  });

  const updated = await runBackfill(makeTruck(), [
    makeTrip({ _id: 'older-trip', supplierName: 'Older Supplier', updatedAt: new Date('2026-05-02T09:00:00.000Z') }),
    latestSupplierTrip,
  ]);
  assert.strictEqual(updated.result.updated, true);
  assert.strictEqual(updated.updatePayload.$set.supplierId, supplierId);
  assert.strictEqual(updated.updatePayload.$set.supplierName, 'Latest Supplier');
  assert.strictEqual(updated.updateFilter._id, truckId);

  const noTrip = await runBackfill(makeTruck(), []);
  assert.strictEqual(noTrip.result.updated, false);
  assert.strictEqual(noTrip.result.reason, 'no-matching-trip');
  assert.strictEqual(noTrip.updatePayload, null);

  const alreadyAssigned = await runBackfill(
    makeTruck({ supplierId: '507f1f77bcf86cd799439099', supplierName: 'Existing Supplier' }),
    [latestSupplierTrip]
  );
  assert.strictEqual(alreadyAssigned.result.updated, false);
  assert.strictEqual(alreadyAssigned.result.reason, 'supplier-already-assigned');
  assert.strictEqual(alreadyAssigned.updatePayload, null);

  const canceledIgnored = await runBackfill(makeTruck(), [
    makeTrip({
      _id: 'canceled-newest',
      supplierName: 'Canceled Supplier',
      workflowStatus: 'canceled',
      updatedAt: new Date('2026-05-05T09:00:00.000Z'),
    }),
    makeTrip({
      _id: 'valid-older',
      supplierName: 'Valid Supplier',
      updatedAt: new Date('2026-05-04T09:00:00.000Z'),
    }),
  ]);
  assert.strictEqual(canceledIgnored.result.updated, true);
  assert.strictEqual(canceledIgnored.updatePayload.$set.supplierName, 'Valid Supplier');

  const truckIdPreferred = findLatestSupplierTripForTruck(makeTruck(), [
    makeTrip({
      _id: 'fallback-newer',
      truckId: null,
      supplierName: 'Fallback Newer Supplier',
      updatedAt: new Date('2026-05-06T09:00:00.000Z'),
    }),
    makeTrip({
      _id: 'truck-id-older',
      truckId,
      supplierName: 'Truck Id Supplier',
      updatedAt: new Date('2026-05-05T09:00:00.000Z'),
    }),
  ]);
  assert.strictEqual(truckIdPreferred._id, 'truck-id-older');
  assert.strictEqual(truckIdPreferred.supplierName, 'Truck Id Supplier');

  const fallbackHeadTail = await runBackfill(makeTruck({ _id: '507f1f77bcf86cd799439011' }), [
    makeTrip({
      _id: 'wrong-tail',
      truckId: null,
      headTruckNumber: 'HT-100',
      tailTrailerNumber: 'TT-999',
      supplierName: 'Wrong Tail Supplier',
      updatedAt: new Date('2026-05-07T09:00:00.000Z'),
    }),
    makeTrip({
      _id: 'matching-head-tail',
      truckId: null,
      headTruckNumber: ' ht-100 ',
      tailTrailerNumber: ' tt-100 ',
      supplierName: 'Fallback Supplier',
      updatedAt: new Date('2026-05-06T09:00:00.000Z'),
    }),
  ]);
  assert.strictEqual(fallbackHeadTail.result.updated, true);
  assert.strictEqual(fallbackHeadTail.updatePayload.$set.supplierName, 'Fallback Supplier');

  const emptySupplierLatest = await runBackfill(makeTruck(), [
    makeTrip({
      _id: 'empty-supplier-latest',
      supplierId: null,
      supplierName: '',
      updatedAt: new Date('2026-05-08T09:00:00.000Z'),
    }),
    makeTrip({
      _id: 'older-with-supplier',
      supplierName: 'Older Supplier',
      updatedAt: new Date('2026-05-07T09:00:00.000Z'),
    }),
  ]);
  assert.strictEqual(emptySupplierLatest.result.updated, false);
  assert.strictEqual(emptySupplierLatest.result.reason, 'latest-trip-has-no-supplier');
  assert.strictEqual(emptySupplierLatest.updatePayload, null);

  console.log('truck supplier backfill service tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
