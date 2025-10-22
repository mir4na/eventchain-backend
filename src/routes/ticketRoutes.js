const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');

router.get('/user/:address', ticketController.getUserTickets);
router.get('/resale', ticketController.getResaleTickets);
router.get('/:ticketId', ticketController.getTicketById);
router.get('/:ticketId/history', ticketController.getTicketTransactionHistory);

router.get('/availability/:eventId/:typeId', ticketController.getTicketTypeAvailability);
router.get('/eligibility/:address/:eventId', ticketController.checkPurchaseEligibility);

module.exports = router;