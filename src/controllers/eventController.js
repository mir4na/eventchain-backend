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

  async toggleBookmark(req, res) {
    try {
      const { eventId } = req.params;
      const { userId } = req.user;

      const result = await eventService.toggleBookmark(userId, eventId);
      return successResponse(res, result, 'Bookmark toggled successfully');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }

  async getUserBookmarks(req, res) {
    try {
      const { userId } = req.user;
      const bookmarks = await eventService.getUserBookmarks(userId);
      return successResponse(res, bookmarks, 'Bookmarks retrieved successfully');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }

  async isEventBookmarked(req, res) {
    try {
      const { eventId } = req.params;
      const { userId } = req.user;
      
      const isBookmarked = await eventService.isEventBookmarked(userId, eventId);
      return successResponse(res, { isBookmarked }, 'Bookmark status retrieved');
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }
}

module.exports = new EventController();