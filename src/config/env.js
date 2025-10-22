require('dotenv').config();

const requiredEnvVars = [
  'DATABASE_URL',
  'RPC_URL',
  'CONTRACT_ADDRESS',
  'PORT'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL,
  RPC_URL: process.env.RPC_URL,
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS,
  START_BLOCK: process.env.START_BLOCK || 0,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 15,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100
};