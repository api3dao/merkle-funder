/* eslint-disable @typescript-eslint/no-var-requires */
const dotenv = require('dotenv');

module.exports = async () => {
  return Object.entries(dotenv.config({ path: '.env' }).parsed).reduce((acc, [key, value]) => {
    if (!key.startsWith('ETHERSCAN_API_KEY')) {
      acc[key] = value;
    }
    return acc;
  }, {});
};
