import { HardhatUserConfig } from 'hardhat/config';
import 'hardhat-deploy';
import '@nomicfoundation/hardhat-toolbox';
import dotenv from 'dotenv';

dotenv.config();

const accounts = { mnemonic: process.env.FUNDER_MNEMONIC || '' };

const config: HardhatUserConfig = {
  networks: {
    localhost: {
      url: process.env.RPC_URL_LOCALHOST || '',
      chainId: 31337,
      accounts,
    },
    mainnet: {
      url: process.env.RPC_URL_MAINNET || '',
      chainId: 1,
      accounts,
    },
    goerli: {
      url: process.env.RPC_URL_GOERLI || '',
      chainId: 5,
      accounts,
    },
    sepolia: {
      url: process.env.RPC_URL_SEPOLIA || '',
      chainId: 11155111,
      accounts,
    },
    arbitrum: {
      url: process.env.RPC_URL_ARBITRUM || '',
      chainId: 42161,
      accounts,
    },
    'arbitrum-testnet': {
      url: process.env.RPC_URL_ARBITRUM_TESTNET || '',
      chainId: 421613,
      accounts,
    },
    avalanche: {
      url: process.env.RPC_URL_AVALANCHE || '',
      chainId: 43114,
      accounts,
    },
    'avalanche-testnet': {
      url: process.env.RPC_URL_AVALANCHE_TESTNET || '',
      chainId: 43113,
      accounts,
    },
    bsc: {
      url: process.env.RPC_URL_BSC || '',
      chainId: 56,
      accounts,
    },
    'bsc-testnet': {
      url: process.env.RPC_URL_BSC_TESTNET || '',
      chainId: 97,
      accounts,
    },
    fantom: {
      url: process.env.RPC_URL_FANTOM || '',
      chainId: 250,
      accounts,
    },
    'fantom-testnet': {
      url: process.env.RPC_URL_FANTOM_TESTNET || '',
      chainId: 4002,
      accounts,
    },
    gnosis: {
      url: process.env.RPC_URL_GNOSIS || '',
      chainId: 100,
      accounts,
    },
    'gnosis-testnet': {
      url: process.env.RPC_URL_GNOSIS_TESTNET || '',
      chainId: 10200,
      accounts,
    },
    metis: {
      url: process.env.RPC_URL_METIS || '',
      chainId: 1088,
      accounts,
    },
    'metis-testnet': {
      url: process.env.RPC_URL_METIS_TESTNET || '',
      chainId: 599,
      accounts,
    },
    milkomeda: {
      url: process.env.RPC_URL_MILKOMEDA || '',
      chainId: 2001,
      accounts,
    },
    'milkomeda-testnet': {
      url: process.env.RPC_URL_MILKOMEDA_TESTNET || '',
      chainId: 200101,
      accounts,
    },
    moonbeam: {
      url: process.env.RPC_URL_MOONBEAM || '',
      chainId: 1284,
      accounts,
    },
    'moonbeam-testnet': {
      url: process.env.RPC_URL_MOONBEAM_TESTNET || '',
      chainId: 1287,
      accounts,
    },
    moonriver: {
      url: process.env.RPC_URL_MOONRIVER || '',
      chainId: 1285,
      accounts,
    },
    optimism: {
      url: process.env.RPC_URL_OPTIMISM || '',
      chainId: 10,
      accounts,
    },
    'optimism-testnet': {
      url: process.env.RPC_URL_OPTIMISM_TESTNET || '',
      chainId: 420,
      accounts,
    },
    polygon: {
      url: process.env.RPC_URL_POLYGON || '',
      chainId: 137,
      accounts,
    },
    'polygon-testnet': {
      url: process.env.RPC_URL_POLYGON_TESTNET || '',
      chainId: 80001,
      accounts,
    },
    rsk: {
      url: process.env.RPC_URL_RSK || '',
      chainId: 30,
      accounts,
    },
    'rsk-testnet': {
      url: process.env.RPC_URL_RSK_TESTNET || '',
      chainId: 31,
      accounts,
    },
    zkevm: {
      url: process.env.RPC_URL_ZKEVM || '',
      chainId: 1101,
      accounts,
    },
    'zkevm-testnet': {
      url: process.env.RPC_URL_ZKEVM_TESTNET || '',
      chainId: 1442,
      accounts,
    },
    zksync: {
      url: process.env.RPC_URL_ZKSYNC || '',
      chainId: 324,
      accounts,
    },
    'zksync-goerli-testnet': {
      url: process.env.RPC_URL_ZKSYNC_GOERLI_TESTNET || '',
      chainId: 280,
      accounts,
    },
  },
  solidity: {
    version: '0.8.17',
    settings: { optimizer: { enabled: true, runs: 10_000 } },
  },
  namedAccounts: {
    deployer: 0,
  },
};

export default config;
