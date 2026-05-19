const assert = require('assert');
const Truck = require('../models/Truck');
const {
  createTruck,
  updateTruck,
  serializeTruck,
  validateTruckInput,
} = require('../controllers/truckController');

const validUserId = '507f1f77bcf86cd799439099';
const validTruckId = '507f1f77bcf86cd799439010';

const makeRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

const makeCreateBody = (truckModel) => ({
  headTruckNumber: ' ht-100 ',
  tailTrailerNumber: ' tt-100 ',
  truckModel,
});

const callCreateTruck = async (truckModel) => {
  const originalFindOne = Truck.findOne;
  const originalCreate = Truck.create;
  const res = makeRes();
  let createdPayload = null;
  let nextError = null;

  Truck.findOne = async () => null;
  Truck.create = async (payload) => {
    createdPayload = payload;
    return { _id: validTruckId, ...payload };
  };

  try {
    await createTruck(
      { body: makeCreateBody(truckModel), user: { _id: validUserId } },
      res,
      (error) => {
        nextError = error;
      }
    );
  } finally {
    Truck.findOne = originalFindOne;
    Truck.create = originalCreate;
  }

  assert.strictEqual(nextError, null);
  return { res, createdPayload };
};

const callUpdateTruck = async (truckModel) => {
  const originalFindByIdAndUpdate = Truck.findByIdAndUpdate;
  const res = makeRes();
  let updatePayload = null;
  let nextError = null;

  Truck.findByIdAndUpdate = async (_id, updates) => {
    updatePayload = updates;
    return {
      _id: validTruckId,
      headTruckNumber: 'HT-100',
      tailTrailerNumber: 'TT-100',
      ...updates,
    };
  };

  try {
    await updateTruck(
      { params: { id: validTruckId }, body: { truckModel } },
      res,
      (error) => {
        nextError = error;
      }
    );
  } finally {
    Truck.findByIdAndUpdate = originalFindByIdAndUpdate;
  }

  assert.strictEqual(nextError, null);
  return { res, updatePayload };
};

(async () => {
  const acceptedModels = [
    ['threeAxis', '2 Axle'],
    ['fourAxis', '3 Axle'],
    ['sixAxis', '6 Wheel'],
    ['2 Axle', '2 Axle'],
    ['3 Axle', '3 Axle'],
    ['6 Wheel', '6 Wheel'],
  ];

  for (const [submitted, expected] of acceptedModels) {
    assert.strictEqual(validateTruckInput(makeCreateBody(submitted), { requireAll: true }), null);

    const created = await callCreateTruck(submitted);
    assert.strictEqual(created.res.statusCode, 201);
    assert.strictEqual(created.createdPayload.truckModel, expected);
    assert.strictEqual(created.res.body.truck.truckModel, expected);

    const updated = await callUpdateTruck(submitted);
    assert.strictEqual(updated.res.statusCode, 200);
    assert.strictEqual(updated.updatePayload.truckModel, expected);
    assert.strictEqual(updated.res.body.truck.truckModel, expected);
  }

  assert.strictEqual(serializeTruck({ _id: validTruckId, truckModel: 'threeAxis' }).truckModel, '2 Axle');
  assert.strictEqual(serializeTruck({ _id: validTruckId, truckModel: 'fourAxis' }).truckModel, '3 Axle');
  assert.strictEqual(serializeTruck({ _id: validTruckId, truckModel: 'sixAxis' }).truckModel, '6 Wheel');

  assert.strictEqual(
    validateTruckInput(makeCreateBody('fiveAxis'), { requireAll: true }),
    'truckModel must be one of 2 Axle, 3 Axle, or 6 Wheel'
  );

  console.log('truck controller tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
