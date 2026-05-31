const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ROUTE_MARKERS, STOP_ROLE_MAP } = require('../constants/stops');

const entryTeams = ROUTE_MARKERS.map((marker) => ({
  id: STOP_ROLE_MAP[marker.stop],
  name: `${marker.stop} Entry Team`,
  stop: marker.stop,
  role: STOP_ROLE_MAP[marker.stop],
  assignedStop: STOP_ROLE_MAP[marker.stop],
  order: marker.order,
  lat: marker.lat,
  lng: marker.lng,
}));
const entryTeamRoles = entryTeams.map((team) => team.role);
const memberRoles = ['yard', 'gate', ...entryTeamRoles.filter((role) => role !== 'yard')];
const normalizeRoleForApi = (role) => (role === 'gate' ? 'port' : role);
const normalizeEntryTeamForApi = (entryTeam, role) => {
  if (role === 'gate') {
    return entryTeams.find((team) => team.role === 'port') || entryTeam;
  }

  return entryTeam;
};

const buildToken = (user) =>
  jwt.sign({ id: user._id, role: normalizeRoleForApi(user.role) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const publicUser = (user) => {
  const role = normalizeRoleForApi(user.role);
  const entryTeam = normalizeEntryTeamForApi(user.entryTeam, user.role);

  return {
    id: user._id,
    name: user.name,
    username: user.username,
    mobileNumber: user.mobileNumber,
    role,
    assignedStop: entryTeam?.assignedStop || entryTeam?.role || role,
    entryTeam,
  };
};

const fullUser = (user) => ({
  ...publicUser(user),
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const normalizeUsername = (username) => username.toLowerCase().trim();

const buildDeletedUsername = (username, id) => `${username}__deleted__${id}`;

const releaseInactiveUsername = async (username) => {
  const inactiveUsers = await User.find({
    username,
    isActive: false,
  });

  if (!inactiveUsers.length) return;

  await User.bulkWrite(
    inactiveUsers.map((user) => {
      const deletedUsername = buildDeletedUsername(user.username, user._id);

      return {
        updateOne: {
          filter: { _id: user._id },
          update: { $set: { username: deletedUsername } },
        },
      };
    })
  );
};

const getMemberById = async (id) =>
  User.findOne({
    _id: id,
    role: { $in: memberRoles },
  });

const getAdminById = async (id) =>
  User.findOne({
    _id: id,
    role: 'admin',
  });

const normalizeEntryTeamValue = (value) => {
  if (value === undefined || value === null) return undefined;

  const normalized = value.toString().toLowerCase().trim();
  if (normalized.replace(/[\s_-]+/g, '') === 'gate') return 'port';
  return normalized.replace(/[\s_-]+/g, '') === 'dubaifreezone' ? 'dubai' : normalized;
};

const findEntryTeam = ({ entryTeamId, entryTeamName, entryTeamStop, assignedStop }) => {
  const normalizedId = normalizeEntryTeamValue(entryTeamId);
  const normalizedName = entryTeamName?.toLowerCase().trim();
  const legacyGateName = normalizedName === 'gate entry team';
  const normalizedStop = normalizeEntryTeamValue(entryTeamStop);
  const normalizedAssignedStop = normalizeEntryTeamValue(assignedStop);

  return entryTeams.find(
    (team) =>
      team.id === normalizedId ||
      team.name.toLowerCase() === normalizedName ||
      (legacyGateName && team.role === 'port') ||
      normalizeEntryTeamValue(team.stop) === normalizedStop ||
      team.assignedStop === normalizedAssignedStop ||
      team.role === normalizedAssignedStop
  );
};

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const user = await User.findOne({ username: normalizeUsername(username) }).select('+password');

    if (!user || !user.isActive || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    return res.json({
      success: true,
      token: buildToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const getEntryTeams = async (req, res, next) => {
  try {
    return res.json({ success: true, entryTeams });
  } catch (error) {
    next(error);
  }
};

const createAdmin = async (req, res, next) => {
  try {
    const { name, mobileNumber, username, password } = req.body;

    if (!name || !mobileNumber || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Admin name, mobile number, username, and password are required',
      });
    }

    const normalizedUsername = normalizeUsername(username);
    const exists = await User.exists({ username: normalizedUsername });

    if (exists) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    const admin = await User.create({
      name: name.trim(),
      mobileNumber: mobileNumber.trim(),
      username: normalizedUsername,
      password,
      role: 'admin',
      isActive: true,
    });

    return res.status(201).json({ success: true, user: publicUser(admin) });
  } catch (error) {
    next(error);
  }
};

const getAdmins = async (req, res, next) => {
  try {
    const admins = await User.find({ role: 'admin' }).sort({ name: 1 });

    return res.json({
      success: true,
      count: admins.length,
      admins: admins.map(publicUser),
    });
  } catch (error) {
    next(error);
  }
};

const getAdminProfile = async (req, res, next) => {
  try {
    const admin = await getAdminById(req.params.id);

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    return res.json({ success: true, admin: fullUser(admin) });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid admin id' });
    }

    next(error);
  }
};

const updateAdmin = async (req, res, next) => {
  try {
    const admin = await getAdminById(req.params.id);

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    const { name, mobileNumber, username, password, isActive } = req.body;

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ success: false, message: 'Admin name cannot be empty' });
      }

      admin.name = name.trim();
    }

    if (mobileNumber !== undefined) {
      admin.mobileNumber = mobileNumber.trim();
    }

    if (username !== undefined) {
      if (!username.trim()) {
        return res.status(400).json({ success: false, message: 'Username cannot be empty' });
      }

      const normalizedUsername = normalizeUsername(username);
      const exists = await User.exists({
        _id: { $ne: admin._id },
        username: normalizedUsername,
      });

      if (exists) {
        return res.status(409).json({ success: false, message: 'Username already exists' });
      }

      admin.username = normalizedUsername;
    }

    if (password !== undefined) {
      if (!password || password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      }

      admin.password = password;
    }

    if (isActive !== undefined) {
      admin.isActive = Boolean(isActive);
    }

    await admin.save();

    return res.json({ success: true, admin: fullUser(admin) });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid admin id' });
    }

    next(error);
  }
};

const deleteAdmin = async (req, res, next) => {
  try {
    const admin = await getAdminById(req.params.id);

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    await admin.deleteOne();

    return res.json({
      success: true,
      message: 'Admin deleted successfully',
      admin: fullUser(admin),
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid admin id' });
    }

    next(error);
  }
};

const createMember = async (req, res, next) => {
  try {
    const { name, mobileNumber, username, password, entryTeamId, entryTeamName, entryTeamStop, assignedStop } =
      req.body;

    if (!name || !mobileNumber || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Member name, mobile number, username, and password are required',
      });
    }

    const entryTeam = findEntryTeam({ entryTeamId, entryTeamName, entryTeamStop, assignedStop });

    if (!entryTeam) {
      return res.status(400).json({
        success: false,
        message: 'Valid entry team id, name, or stop is required',
      });
    }

    const normalizedUsername = normalizeUsername(username);
    const exists = await User.exists({ username: normalizedUsername, isActive: true });

    if (exists) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    await releaseInactiveUsername(normalizedUsername);

    const member = await User.create({
      name: name.trim(),
      mobileNumber: mobileNumber.trim(),
      username: normalizedUsername,
      password,
      role: entryTeam.role,
      entryTeam,
      isActive: true,
    });

    return res.status(201).json({ success: true, user: publicUser(member) });
  } catch (error) {
    next(error);
  }
};

const getMembers = async (req, res, next) => {
  try {
    const { entryTeamId, entryTeamStop, role, assignedStop } = req.query;
    const query = {
      role: { $in: memberRoles },
      isActive: true,
    };

    const entryTeam = findEntryTeam({ entryTeamId, entryTeamStop, assignedStop });

    if (entryTeam) {
      query.role = entryTeam.role === 'port' ? { $in: ['port', 'gate'] } : entryTeam.role;
    } else if (role) {
      const normalizedRole = normalizeEntryTeamValue(role);

      if (!entryTeamRoles.includes(normalizedRole)) {
        return res.status(400).json({
          success: false,
          message: 'Valid member role is required',
        });
      }

      query.role = normalizedRole === 'port' ? { $in: ['port', 'gate'] } : normalizedRole;
    }

    const members = await User.find(query).sort({ 'entryTeam.order': 1, name: 1 });

    return res.json({
      success: true,
      count: members.length,
      members: members.map(publicUser),
    });
  } catch (error) {
    next(error);
  }
};

const getMemberProfile = async (req, res, next) => {
  try {
    const member = await getMemberById(req.params.id);

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    return res.json({ success: true, member: fullUser(member) });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid member id' });
    }

    next(error);
  }
};

const updateMember = async (req, res, next) => {
  try {
    const member = await getMemberById(req.params.id);

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const {
      name,
      mobileNumber,
      username,
      password,
      entryTeamId,
      entryTeamName,
      entryTeamStop,
      assignedStop,
      isActive,
    } = req.body;

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ success: false, message: 'Member name cannot be empty' });
      }

      member.name = name.trim();
    }

    if (mobileNumber !== undefined) {
      member.mobileNumber = mobileNumber.trim();
    }

    if (username !== undefined) {
      if (!username.trim()) {
        return res.status(400).json({ success: false, message: 'Username cannot be empty' });
      }

      const normalizedUsername = normalizeUsername(username);
      const exists = await User.exists({
        _id: { $ne: member._id },
        username: normalizedUsername,
      });

      if (exists) {
        return res.status(409).json({ success: false, message: 'Username already exists' });
      }

      member.username = normalizedUsername;
    }

    if (password !== undefined) {
      if (!password || password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      }

      member.password = password;
    }

    if (
      entryTeamId !== undefined ||
      entryTeamName !== undefined ||
      entryTeamStop !== undefined ||
      assignedStop !== undefined
    ) {
      const entryTeam = findEntryTeam({ entryTeamId, entryTeamName, entryTeamStop, assignedStop });

      if (!entryTeam) {
        return res.status(400).json({
          success: false,
          message: 'Valid entry team id, name, or stop is required',
        });
      }

      member.role = entryTeam.role;
      member.entryTeam = entryTeam;
    }

    if (isActive !== undefined) {
      member.isActive = Boolean(isActive);
    }

    await member.save();

    return res.json({ success: true, member: fullUser(member) });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid member id' });
    }

    next(error);
  }
};

const deleteMember = async (req, res, next) => {
  try {
    const member = await getMemberById(req.params.id);

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    await member.deleteOne();

    return res.json({
      success: true,
      message: 'Member deleted successfully',
      member: fullUser(member),
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid member id' });
    }

    next(error);
  }
};

const profile = async (req, res, next) => {
  try {
    return res.json({ success: true, user: publicUser(req.user) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  profile,
  getEntryTeams,
  createAdmin,
  getAdmins,
  getAdminProfile,
  updateAdmin,
  deleteAdmin,
  createMember,
  getMembers,
  getMemberProfile,
  updateMember,
  deleteMember,
};
