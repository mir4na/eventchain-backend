const { ethers } = require('ethers');

const helpers = {
    validateAddress(address) {
        return ethers.isAddress(address);
    },

    formatEther(wei) {
        return ethers.formatEther(wei);
    },

    parseEther(ether) {
        return ethers.parseEther(ether.toString());
    },

    calculateMaxResalePrice(originalPrice) {
        return (originalPrice * 120) / 100;
    },

    isValidDate(timestamp) {
        return timestamp > Math.floor(Date.now() / 1000);
    },

    calculateRevenueShares(amount, percentages) {
        return percentages.map(percentage => {
            return (amount * percentage) / 10000;
        });
    }
};

module.exports = helpers;