const express = require('express');
const { authenticateUser, requireRole } = require('../middleware/auth');
const {
  createEvent,
  getEvents,
  getEventById,
  addTicketType,
  purchaseTickets,
  getEventStatistics,
  toggleFavorite
} = require('../controllers/eventController');

const router = express.Router();

// Public routes
router.get('/', getEvents);
router.get('/:id', getEventById);
router.get('/:id/statistics', getEventStatistics);

// Protected routes
router.post('/favorites/:eventId', authenticateUser, toggleFavorite);

// EO routes
router.post('/', authenticateUser, requireRole(['EO']), createEvent);
router.post('/:id/ticket-types', authenticateUser, requireRole(['EO']), addTicketType);

// Purchase tickets (any authenticated user)
router.post('/:id/purchase', authenticateUser, purchaseTickets);

module.exports = router;
