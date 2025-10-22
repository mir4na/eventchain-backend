const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const eventService = require('../services/eventService');
const ticketService = require('../services/ticketService');

router.get('/:address/tickets', ticketController.getUserTickets);

router.get('/:address/transactions', ticketController.getUserTransactionHistory);

router.get('/:address/events', async (req, res) => {
  try {
    const events = await eventService.getEventsByCreator(req.params.address);
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:address/purchases', async (req, res) => {
  try {
    const purchases = await ticketService.getUserTransactionHistory(
      req.params.address,
      { type: 'TICKET_PURCHASE' }
    );
    res.json({ success: true, data: purchases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:address/resales', async (req, res) => {
  try {
    const resales = await ticketService.getUserTransactionHistory(
      req.params.address,
      { type: 'TICKET_RESALE' }
    );
    res.json({ success: true, data: resales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;