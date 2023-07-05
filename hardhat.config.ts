import * as api3Chains from '@api3/chains';
import '@nomicfoundation/hardhat-toolbox';
import dotenv from 'dotenv';
import 'hardhat-deploy';
import { HardhatUserConfig } from 'hardhat/config';

dotenv.config();

const accounts = { mnemonic: process.env.MNEMONIC || '' };

const networks = api3Chains.CHAINS.reduce((acc, { alias: chainName, id }) => {
  const url = process.env[`RPC_URL_${chainName.replace(/-/g, '_').toUpperCase()}`];
  if (!url) {
    return acc;
  }

  return {
    ...acc,
    [chainName]: { url, chainId: parseInt(id), accounts },
  };
}, {});

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
