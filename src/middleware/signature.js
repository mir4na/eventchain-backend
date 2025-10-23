const { ethers } = require('ethers');
const logger = require('../utils/logger');

const BACKEND_SIGNER_PRIVATE_KEY = process.env.BACKEND_SIGNER_PRIVATE_KEY;

if (!BACKEND_SIGNER_PRIVATE_KEY) {
  logger.error('BACKEND_SIGNER_PRIVATE_KEY not configured!');
  throw new Error('BACKEND_SIGNER_PRIVATE_KEY must be set in environment variables');
}

const signer = new ethers.Wallet(BACKEND_SIGNER_PRIVATE_KEY);

logger.info(`Backend Signer Address: ${signer.address}`);

async function generateTicketUseSignature(ticketId, eventId, scannerAddress, nonce, deadline) {
  try {
    const chainId = parseInt(process.env.CHAIN_ID);
    
    const messageHash = ethers.solidityPackedKeccak256(
      ['uint256', 'uint256', 'address', 'uint256', 'uint256', 'uint256'],
      [ticketId, eventId, scannerAddress, nonce, deadline, chainId]
    );

    const messageBytes = ethers.getBytes(messageHash);
    const signature = await signer.signMessage(messageBytes);
    
    logger.info(`Generated signature for ticket ${ticketId}, signer: ${signer.address}`);
    return signature;
  } catch (error) {
    logger.error('Error generating ticket use signature:', error);
    throw error;
  }
}

async function verifyTicketUseSignature(ticketId, eventId, scannerAddress, nonce, deadline, signature) {
  try {
    const chainId = parseInt(process.env.CHAIN_ID);
    
    const messageHash = ethers.solidityPackedKeccak256(
      ['uint256', 'uint256', 'address', 'uint256', 'uint256', 'uint256'],
      [ticketId, eventId, scannerAddress, nonce, deadline, chainId]
    );

    const messageBytes = ethers.getBytes(messageHash);
    const recoveredAddress = ethers.verifyMessage(messageBytes, signature);
    
    const isValid = recoveredAddress.toLowerCase() === signer.address.toLowerCase();
    
    if (!isValid) {
      logger.warn(`Signature verification failed. Expected: ${signer.address}, Got: ${recoveredAddress}`);
    }
    
    return isValid;
  } catch (error) {
    logger.error('Error verifying signature:', error);
    return false;
  }
}

function generateNonce() {
  return Math.floor(Math.random() * 1000000000);
}

function generateDeadline(minutesFromNow = 5) {
  return Math.floor(Date.now() / 1000) + (minutesFromNow * 60);
}

module.exports = {
  generateTicketUseSignature,
  verifyTicketUseSignature,
  generateNonce,
  generateDeadline,
  signerAddress: signer.address
};