const assert = require('assert');
const User = require('../models/User');
const { createMember, deleteMember } = require('../controllers/authController');

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

const callController = async (controller, req) => {
  const res = makeRes();
  let nextError = null;

  await controller(req, res, (error) => {
    nextError = error;
  });

  assert.strictEqual(nextError, null);
  return res;
};

const originalExists = User.exists;
const originalFind = User.find;
const originalBulkWrite = User.bulkWrite;
const originalCreate = User.create;
const originalFindOne = User.findOne;

(async () => {
  let archivedInactiveUsers = null;
  let createdPayload = null;

  User.exists = async (query) => {
    assert.deepStrictEqual(query, { username: 'yarduser', isActive: true });
    return null;
  };
  User.find = async (query) => {
    assert.deepStrictEqual(query, { username: 'yarduser', isActive: false });
    return [{ _id: 'deleted-member-id', username: 'yarduser' }];
  };
  User.bulkWrite = async (operations) => {
    archivedInactiveUsers = operations;
  };
  User.create = async (payload) => {
    createdPayload = payload;
    return { _id: 'new-member-id', ...payload };
  };

  const createRes = await callController(createMember, {
    body: {
      name: 'Yard Member',
      mobileNumber: '971500000000',
      username: ' YardUser ',
      password: 'secret1',
      entryTeamId: 'yard',
    },
  });

  assert.strictEqual(createRes.statusCode, 201);
  assert.strictEqual(createdPayload.username, 'yarduser');
  assert.deepStrictEqual(archivedInactiveUsers, [
    {
      updateOne: {
        filter: { _id: 'deleted-member-id' },
        update: { $set: { username: 'yarduser__deleted__deleted-member-id' } },
      },
    },
  ]);

  User.exists = async () => ({ _id: 'active-member-id' });
  User.find = async () => {
    throw new Error('inactive usernames should not be released when an active username exists');
  };

  const duplicateRes = await callController(createMember, {
    body: {
      name: 'Yard Member',
      mobileNumber: '971500000000',
      username: 'yarduser',
      password: 'secret1',
      entryTeamId: 'yard',
    },
  });

  assert.strictEqual(duplicateRes.statusCode, 409);
  assert.strictEqual(duplicateRes.body.message, 'Username already exists');

  const memberToDelete = {
    _id: 'member-to-delete',
    name: 'Gate Member',
    username: 'gateuser',
    mobileNumber: '971500000001',
    role: 'gate',
    entryTeam: { assignedStop: 'gate' },
    isActive: true,
    deleteOneCalled: false,
    async deleteOne() {
      this.deleteOneCalled = true;
      return this;
    },
  };

  User.findOne = async (query) => {
    assert.deepStrictEqual(query, {
      _id: 'member-to-delete',
      role: { $in: ['yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'] },
    });
    return memberToDelete;
  };

  const deleteRes = await callController(deleteMember, { params: { id: 'member-to-delete' } });

  assert.strictEqual(deleteRes.body.success, true);
  assert.strictEqual(memberToDelete.isActive, true);
  assert.strictEqual(memberToDelete.username, 'gateuser');
  assert.strictEqual(memberToDelete.deleteOneCalled, true);

  console.log('auth controller tests passed');
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    User.exists = originalExists;
    User.find = originalFind;
    User.bulkWrite = originalBulkWrite;
    User.create = originalCreate;
    User.findOne = originalFindOne;
  });
