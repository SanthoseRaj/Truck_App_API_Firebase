const User = require('../models/User');

const defaultUsers = [
  { name: 'Owner', username: 'owner', role: 'owner' },
  { name: 'Admin', username: 'admin', role: 'admin' },
  { name: 'Yard', username: 'yard', role: 'yard' },
  { name: 'Gate', username: 'gate', role: 'gate' },
  { name: 'Port', username: 'port', role: 'port' },
  { name: 'Clearence', username: 'clearence', role: 'clearence' },
  { name: 'Dubai', username: 'dubai', role: 'dubai' },
];

const seedUsers = async () => {
  for (const user of defaultUsers) {
    const exists = await User.exists({ username: user.username });
    if (!exists) {
      await User.create({ ...user, password: '123456', isActive: true });
      console.log(`Seeded user: ${user.username}`);
    }
  }
};

module.exports = seedUsers;
