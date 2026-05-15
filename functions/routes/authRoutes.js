const express = require('express');
const {
  login,
  profile,
  getEntryTeams,
  createAdmin,
  createMember,
  getMembers,
  getMemberProfile,
  updateMember,
  deleteMember,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with username and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: owner
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', login);

/**
 * @swagger
 * /api/auth/entry-teams:
 *   get:
 *     summary: List entry teams available for member assignment
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Entry team list
 *       401:
 *         description: Unauthorized
 */
router.get('/entry-teams', protect, allowRoles('owner', 'admin'), getEntryTeams);

/**
 * @swagger
 * /api/auth/admins:
 *   post:
 *     summary: Create an admin user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAdminInput'
 *     responses:
 *       201:
 *         description: Admin created
 *       400:
 *         description: Missing or invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Username already exists
 */
router.post('/admins', protect, allowRoles('owner'), createAdmin);

/**
 * @swagger
 * /api/auth/members:
 *   post:
 *     summary: Create an entry team member user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMemberInput'
 *     responses:
 *       201:
 *         description: Member created
 *       400:
 *         description: Missing or invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Username already exists
 */
router.post('/members', protect, allowRoles('owner', 'admin'), createMember);

/**
 * @swagger
 * /api/auth/members:
 *   get:
 *     summary: List entry team member users
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: entryTeamId
 *         schema:
 *           type: string
 *           enum: [yard, gate, port, clearence, dubai]
 *         required: false
 *         description: Filter members by entry team id
 *       - in: query
 *         name: entryTeamStop
 *         schema:
 *           type: string
 *           enum: [Yard, Gate, Port Loading, Custom Clearence, Dubai / Free Zone]
 *         required: false
 *         description: Filter members by entry team stop
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [yard, gate, port, clearence, dubai]
 *         required: false
 *         description: Filter members by role
 *     responses:
 *       200:
 *         description: Member list
 *       400:
 *         description: Invalid filter
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/members', protect, allowRoles('owner', 'admin'), getMembers);

/**
 * @swagger
 * /api/auth/members/{id}:
 *   get:
 *     summary: Get full entry team member profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Member user id
 *     responses:
 *       200:
 *         description: Member profile details
 *       400:
 *         description: Invalid member id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Member not found
 */
router.get('/members/:id', protect, allowRoles('owner', 'admin'), getMemberProfile);

/**
 * @swagger
 * /api/auth/members/{id}:
 *   put:
 *     summary: Update an entry team member profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Member user id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateMemberInput'
 *     responses:
 *       200:
 *         description: Member updated
 *       400:
 *         description: Missing or invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Member not found
 *       409:
 *         description: Username already exists
 */
router.put('/members/:id', protect, allowRoles('owner', 'admin'), updateMember);

/**
 * @swagger
 * /api/auth/members/{id}:
 *   delete:
 *     summary: Delete an entry team member user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Member user id
 *     responses:
 *       200:
 *         description: Member deleted
 *       400:
 *         description: Invalid member id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Member not found
 */
router.delete('/members/:id', protect, allowRoles('owner', 'admin'), deleteMember);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get authenticated user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user profile
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', protect, profile);

module.exports = router;
