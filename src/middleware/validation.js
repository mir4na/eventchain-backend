const { ethers } = require('ethers');
const { errorResponse } = require('../utils/response');

const validateAdmin = (req, res, next) => {
    if (req.body.adminAddress && !ethers.isAddress(req.body.adminAddress)) {
        return errorResponse(res, 400, 'Invalid admin address format');
    }

    if (req.params.eventId && isNaN(req.params.eventId)) {
        return errorResponse(res, 400, 'Invalid event ID format');
    }

    next();
};

module.exports = {
    validateAdmin,
    // TODO: Add other validators here
};