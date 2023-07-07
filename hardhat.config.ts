import '@nomicfoundation/hardhat-toolbox';
import { HardhatUserConfig } from 'hardhat/config';
import 'hardhat-deploy';
import { hardhatConfig } from '@api3/chains';
import dotenv from 'dotenv';

dotenv.config();

const config: HardhatUserConfig = {
  etherscan: hardhatConfig.etherscan(),
  networks: hardhatConfig.networks(),
  solidity: {
    version: '0.8.17',
    settings: { optimizer: { enabled: true, runs: 1000 } },
  },
};

export default config;
