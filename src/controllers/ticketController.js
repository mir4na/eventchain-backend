const ticketService = require('../services/ticketService');
const { successResponse, errorResponse } = require('../utils/response');

class TicketController {
  async getUserTickets(req, res) {
    try {
      const { address } = req.params;
      const filters = {
        status: req.query.status,
        eventId: req.query.eventId
      };

      const tickets = await ticketService.getUserTickets(address, filters);
      return successResponse(res, tickets, 'User tickets retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }

  async getTicketById(req, res) {
    try {
      const { ticketId } = req.params;
      const ticket = await ticketService.getTicketById(ticketId);
      return successResponse(res, ticket, 'Ticket retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message, 404);
    }
  }

  async getResaleTickets(req, res) {
    try {
      const filters = {
        eventId: req.query.eventId,
        minPrice: req.query.minPrice,
        maxPrice: req.query.maxPrice
      };

      const tickets = await ticketService.getResaleTickets(filters);
      return successResponse(res, tickets, 'Resale tickets retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }

  async getTicketTransactionHistory(req, res) {
    try {
      const { ticketId } = req.params;
      const history = await ticketService.getTicketTransactionHistory(ticketId);
      return successResponse(res, history, 'Transaction history retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }

  async getUserTransactionHistory(req, res) {
    try {
      const { address } = req.params;
      const filters = {
        type: req.query.type,
        eventId: req.query.eventId
      };

      const history = await ticketService.getUserTransactionHistory(address, filters);
      return successResponse(res, history, 'User transaction history retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }

  async checkPurchaseEligibility(req, res) {
    try {
      const { address, eventId } = req.params;
      const { quantity } = req.query;

      const eligibility = await ticketService.checkPurchaseEligibility(
        address,
        eventId,
        parseInt(quantity) || 1
      );

      return successResponse(res, eligibility, 'Eligibility checked successfully');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }

  async getTicketTypeAvailability(req, res) {
    try {
      const { eventId, typeId } = req.params;
      const availability = await ticketService.getTicketTypeAvailability(eventId, typeId);
      return successResponse(res, availability, 'Availability retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message, 404);
    }
  }
}

module.exports = new TicketController();