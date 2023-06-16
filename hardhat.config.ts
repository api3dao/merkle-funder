import fs from 'fs';
import { HardhatUserConfig } from 'hardhat/config';
import 'hardhat-deploy';
import '@nomicfoundation/hardhat-toolbox';
import loadCredentials from './src/credentials';

let networks = {};
if (fs.existsSync('./config/credentials.json')) {
  ({ networks } = loadCredentials());
}

const config: HardhatUserConfig = {
  networks,
  solidity: {
    version: '0.8.17',
    settings: { optimizer: { enabled: true, runs: 10_000 } },
  },
  namedAccounts: {
    deployer: 0,
  },
};

export default config;
