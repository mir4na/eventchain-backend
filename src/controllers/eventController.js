const eventService = require('../services/eventService');
const { successResponse, errorResponse } = require('../utils/response');

class EventController {
  async getAllEvents(req, res) {
    try {
      const filters = {
        status: req.query.status,
        location: req.query.location,
        search: req.query.search,
        sortBy: req.query.sortBy,
        order: req.query.order
      };

      const events = await eventService.getAllEvents(filters);
      return successResponse(res, events, 'Events retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }

  async getEventById(req, res) {
    try {
      const { eventId } = req.params;
      const event = await eventService.getEventById(eventId);
      return successResponse(res, event, 'Event retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message, 404);
    }
  }

  async getEventsByCreator(req, res) {
    try {
      const { address } = req.params;
      const events = await eventService.getEventsByCreator(address);
      return successResponse(res, events, 'Creator events retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }

  async getEventStatistics(req, res) {
    try {
      const { eventId } = req.params;
      const stats = await eventService.getEventStatistics(eventId);
      return successResponse(res, stats, 'Event statistics retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message, 404);
    }
  }

  async toggleFavorite(req, res) {
    try {
      const { eventId } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return errorResponse(res, 'User ID is required', 400);
      }

      const result = await eventService.toggleFavorite(userId, eventId);
      return successResponse(res, result, 'Favorite toggled successfully');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }

  async getUserFavorites(req, res) {
    try {
      const { userId } = req.params;
      const favorites = await eventService.getUserFavorites(userId);
      return successResponse(res, favorites, 'Favorites retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }
}

module.exports = new EventController();