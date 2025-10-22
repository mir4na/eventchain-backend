const { ethers } = require('ethers');
const { errorResponse } = require('../utils/response');
const helpers = require('../utils/helpers');

const validateTicket = (req, res, next) => {
    const { eventId, typeId, quantity, address } = req.body;

    if (req.path.includes('/buy')) {
        if (!eventId || !typeId || !quantity || !address) {
            return errorResponse(res, 400, 'Missing required purchase fields');
        }

        if (!ethers.isAddress(address)) {
            return errorResponse(res, 400, 'Invalid buyer address');
        }

        if (quantity <= 0 || quantity > 5) {
            return errorResponse(res, 400, 'Invalid ticket quantity');
        }
    }

    if (req.path.includes('/resale/list')) {
        const { ticketId, resalePrice, resaleDeadline } = req.body;

        if (!ticketId || !resalePrice || !resaleDeadline) {
            return errorResponse(res, 400, 'Missing required resale fields');
        }

        if (!helpers.isValidDate(resaleDeadline)) {
            return errorResponse(res, 400, 'Invalid resale deadline');
        }

        // Note: Max resale price validation is handled by the smart contract
    }

    next();
};

module.exports = {
    validateTicket
};