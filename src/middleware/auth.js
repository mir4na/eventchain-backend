const { ethers } = require('ethers');
const contractService = require('../services/blockchainService');
const { errorResponse } = require('../utils/response');

const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return errorResponse(res, 401, 'No authorization header');
        }

        const address = authHeader.split(' ')[1];
        if (!ethers.isAddress(address)) {
            return errorResponse(res, 401, 'Invalid address');
        }

        const contract = await contractService.getContract();
        const isAdmin = await contract.isAdmin(address);
        
        if (!isAdmin) {
            return errorResponse(res, 403, 'Not authorized as admin');
        }

        req.adminAddress = address;
        next();
    } catch (error) {
        return errorResponse(res, 500, 'Authentication failed');
    }
};

module.exports = {
    auth
};