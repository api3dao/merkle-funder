import { HardhatUserConfig } from 'hardhat/config';
import 'hardhat-deploy';
import '@nomicfoundation/hardhat-toolbox';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.17',
    settings: { optimizer: { enabled: true, runs: 10_000 } },
  },
  namedAccounts: {
    deployer: 0,
  },
};

export default config;
