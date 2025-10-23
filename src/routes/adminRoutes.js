const express = require('express');
const { authenticateUser, requireRole } = require('../middleware/auth');
const {
  approveEvent,
  rejectEvent,
  getPendingEvents,
  getAdminStats,
  addAdmin,
  removeAdmin,
  getAdmins
} = require('../controllers/adminController');

const router = express.Router();

// All admin routes require admin role
router.use(authenticateUser, requireRole(['ADMIN']));

// Event management
router.get('/events/pending', getPendingEvents);
router.post('/events/:eventId/approve', approveEvent);
router.post('/events/:eventId/reject', rejectEvent);

// Statistics
router.get('/stats', getAdminStats);

// Admin management
router.get('/admins', getAdmins);
router.post('/admins', addAdmin);
router.delete('/admins/:adminAddress', removeAdmin);

module.exports = router;
