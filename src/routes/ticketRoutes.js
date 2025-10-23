const express = require('express');
const { authenticateUser, requireRole } = require('../middleware/auth');
const {
  getUserTickets,
  getTicketById,
  listForResale,
  buyResaleTicket,
  cancelResaleListing,
  getResaleTickets,
  useTicket,
  getTicketHistory
} = require('../controllers/ticketController');

const router = express.Router();

// Public routes
router.get('/resale', getResaleTickets);
router.get('/:id', getTicketById);
router.get('/:id/history', getTicketHistory);

// Protected routes
router.get('/user/:address', getUserTickets);
router.post('/resale/list', authenticateUser, listForResale);
router.post('/resale/buy', authenticateUser, buyResaleTicket);
router.delete('/resale/:ticketId', authenticateUser, cancelResaleListing);

// EO routes (for ticket usage)
router.post('/:ticketId/use', authenticateUser, requireRole(['EO']), useTicket);

module.exports = router;
