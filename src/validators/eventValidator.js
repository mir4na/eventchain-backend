const { ethers } = require('ethers');
const { errorResponse } = require('../utils/response');

const validateEvent = (req, res, next) => {
    const { 
        eventName, 
        eventURI, 
        documentURI, 
        eventDate, 
        revenueBeneficiaries, 
        percentages 
    } = req.body;

    if (!eventName || !eventURI || !eventDate) {
        return errorResponse(res, 400, 'Missing required event fields');
    }

    if (eventDate <= Math.floor(Date.now() / 1000)) {
        return errorResponse(res, 400, 'Event date must be in the future');
    }

    if (revenueBeneficiaries && percentages) {
        if (revenueBeneficiaries.length !== percentages.length) {
            return errorResponse(res, 400, 'Revenue beneficiaries and percentages must match');
        }

        if (!revenueBeneficiaries.every(addr => ethers.isAddress(addr))) {
            return errorResponse(res, 400, 'Invalid beneficiary address');
        }

        const totalPercentage = percentages.reduce((sum, p) => sum + p, 0);
        if (totalPercentage !== 10000) {
            return errorResponse(res, 400, 'Total percentage must equal 100%');
        }
    }

    next();
};

module.exports = {
    validateEvent
};