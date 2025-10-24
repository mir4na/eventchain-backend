const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const logger = require('../utils/logger');

class PinataService {
  constructor() {
    this.apiKey = process.env.PINATA_API_KEY;
    this.secretKey = process.env.PINATA_SECRET_KEY;
    this.jwt = process.env.PINATA_JWT;
    this.baseUrl = 'https://api.pinata.cloud';
  }

  async uploadFile(file, metadata = {}) {
    try {
      if (!this.jwt) {
        throw new Error('Pinata JWT not configured');
      }

      const formData = new FormData();
      formData.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });

      const pinataMetadata = JSON.stringify({
        name: file.originalname,
        keyvalues: {
          type: 'event-poster',
          uploadedAt: new Date().toISOString(),
          ...metadata
        }
      });
      formData.append('pinataMetadata', pinataMetadata);

      const pinataOptions = JSON.stringify({
        cidVersion: 1,
      });
      formData.append('pinataOptions', pinataOptions);

      const response = await axios.post(
        `${this.baseUrl}/pinning/pinFileToIPFS`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.jwt}`,
            ...formData.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      if (response.data && response.data.IpfsHash) {
        const ipfsUrl = `https://bronze-cheerful-barracuda-21.mypinata.cloud/ipfs/${response.data.IpfsHash}`;
        logger.info(`File uploaded to IPFS: ${ipfsUrl}`);
        return ipfsUrl;
      } else {
        throw new Error('Invalid response from Pinata');
      }
    } catch (error) {
      logger.error('Error uploading to Pinata:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  async uploadFromBuffer(buffer, filename, contentType, metadata = {}) {
    try {
      if (!this.jwt) {
        throw new Error('Pinata JWT not configured');
      }

      const formData = new FormData();
      formData.append('file', buffer, {
        filename: filename,
        contentType: contentType
      });

      const pinataMetadata = JSON.stringify({
        name: filename,
        keyvalues: {
          type: 'event-poster',
          uploadedAt: new Date().toISOString(),
          ...metadata
        }
      });
      formData.append('pinataMetadata', pinataMetadata);

      const pinataOptions = JSON.stringify({
        cidVersion: 1,
      });
      formData.append('pinataOptions', pinataOptions);

      const response = await axios.post(
        `${this.baseUrl}/pinning/pinFileToIPFS`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.jwt}`,
            ...formData.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      if (response.data && response.data.IpfsHash) {
        const ipfsUrl = `https://bronze-cheerful-barracuda-21.mypinata.cloud/ipfs/${response.data.IpfsHash}`;
        logger.info(`File uploaded to IPFS: ${ipfsUrl}`);
        return ipfsUrl;
      } else {
        throw new Error('Invalid response from Pinata');
      }
    } catch (error) {
      logger.error('Error uploading to Pinata:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/data/testAuthentication`, {
        headers: {
          'Authorization': `Bearer ${this.jwt}`
        }
      });
      return response.data.authenticated;
    } catch (error) {
      logger.error('Pinata connection test failed:', error);
      return false;
    }
  }
}

module.exports = new PinataService();