import { HardhatUserConfig } from 'hardhat/config';
import 'hardhat-deploy';
import '@nomicfoundation/hardhat-toolbox';
import dotenv from 'dotenv';

dotenv.config({ ...(process.env.ENV && { path: `.env.${process.env.ENV}` }) });

const config: HardhatUserConfig = {
  networks: {
    localhost: {
      url: process.env.RPC_URL_LOCALHOST || '',
      chainId: 31337,
      accounts: process.env.PRIVATE_KEY_LOCALHOST ? [process.env.PRIVATE_KEY_LOCALHOST] : [],
    },
    mainnet: {
      url: process.env.RPC_URL_MAINNET || '',
      chainId: 1,
      accounts: process.env.PRIVATE_KEY_MAINNET ? [process.env.PRIVATE_KEY_MAINNET] : [],
    },
    goerli: {
      url: process.env.RPC_URL_GOERLI || '',
      chainId: 5,
      accounts: process.env.PRIVATE_KEY_GOERLI ? [process.env.PRIVATE_KEY_GOERLI] : [],
    },
    sepolia: {
      url: process.env.RPC_URL_SEPOLIA || '',
      chainId: 11155111,
      accounts: process.env.PRIVATE_KEY_SEPOLIA ? [process.env.PRIVATE_KEY_SEPOLIA] : [],
    },
    arbitrum: {
      url: process.env.RPC_URL_ARBITRUM || '',
      chainId: 42161,
      accounts: process.env.PRIVATE_KEY_ARBITRUM ? [process.env.PRIVATE_KEY_ARBITRUM] : [],
    },
    'arbitrum-testnet': {
      url: process.env.RPC_URL_ARBITRUM_TESTNET || '',
      chainId: 421613,
      accounts: process.env.PRIVATE_KEY_ARBITRUM_TESTNET ? [process.env.PRIVATE_KEY_ARBITRUM_TESTNET] : [],
    },
    avalanche: {
      url: process.env.RPC_URL_AVALANCHE || '',
      chainId: 43114,
      accounts: process.env.PRIVATE_KEY_AVALANCHE ? [process.env.PRIVATE_KEY_AVALANCHE] : [],
    },
    'avalanche-testnet': {
      url: process.env.RPC_URL_AVALANCHE_TESTNET || '',
      chainId: 43113,
      accounts: process.env.PRIVATE_KEY_AVALANCHE_TESTNET ? [process.env.PRIVATE_KEY_AVALANCHE_TESTNET] : [],
    },
    bsc: {
      url: process.env.RPC_URL_BSC || '',
      chainId: 56,
      accounts: process.env.PRIVATE_KEY_BSC ? [process.env.PRIVATE_KEY_BSC] : [],
    },
    'bsc-testnet': {
      url: process.env.RPC_URL_BSC_TESTNET || '',
      chainId: 97,
      accounts: process.env.PRIVATE_KEY_BSC_TESTNET ? [process.env.PRIVATE_KEY_BSC_TESTNET] : [],
    },
    fantom: {
      url: process.env.RPC_URL_FANTOM || '',
      chainId: 250,
      accounts: process.env.PRIVATE_KEY_FANTOM ? [process.env.PRIVATE_KEY_FANTOM] : [],
    },
    'fantom-testnet': {
      url: process.env.RPC_URL_FANTOM_TESTNET || '',
      chainId: 4002,
      accounts: process.env.PRIVATE_KEY_FANTOM_TESTNET ? [process.env.PRIVATE_KEY_FANTOM_TESTNET] : [],
    },
    gnosis: {
      url: process.env.RPC_URL_GNOSIS || '',
      chainId: 100,
      accounts: process.env.PRIVATE_KEY_GNOSIS ? [process.env.PRIVATE_KEY_GNOSIS] : [],
    },
    'gnosis-testnet': {
      url: process.env.RPC_URL_GNOSIS_TESTNET || '',
      chainId: 10200,
      accounts: process.env.PRIVATE_KEY_GNOSIS_TESTNET ? [process.env.PRIVATE_KEY_GNOSIS_TESTNET] : [],
    },
    metis: {
      url: process.env.RPC_URL_METIS || '',
      chainId: 1088,
      accounts: process.env.PRIVATE_KEY_METIS ? [process.env.PRIVATE_KEY_METIS] : [],
    },
    'metis-testnet': {
      url: process.env.RPC_URL_METIS_TESTNET || '',
      chainId: 599,
      accounts: process.env.PRIVATE_KEY_METIS_TESTNET ? [process.env.PRIVATE_KEY_METIS_TESTNET] : [],
    },
    milkomeda: {
      url: process.env.RPC_URL_MILKOMEDA || '',
      chainId: 2001,
      accounts: process.env.PRIVATE_KEY_MILKOMEDA ? [process.env.PRIVATE_KEY_MILKOMEDA] : [],
    },
    'milkomeda-testnet': {
      url: process.env.RPC_URL_MILKOMEDA_TESTNET || '',
      chainId: 200101,
      accounts: process.env.PRIVATE_KEY_MILKOMEDA_TESTNET ? [process.env.PRIVATE_KEY_MILKOMEDA_TESTNET] : [],
    },
    moonbeam: {
      url: process.env.RPC_URL_MOONBEAM || '',
      chainId: 1284,
      accounts: process.env.PRIVATE_KEY_MOONBEAM ? [process.env.PRIVATE_KEY_MOONBEAM] : [],
    },
    'moonbeam-testnet': {
      url: process.env.RPC_URL_MOONBEAM_TESTNET || '',
      chainId: 1287,
      accounts: process.env.PRIVATE_KEY_MOONBEAM_TESTNET ? [process.env.PRIVATE_KEY_MOONBEAM_TESTNET] : [],
    },
    moonriver: {
      url: process.env.RPC_URL_MOONRIVER || '',
      chainId: 1285,
      accounts: process.env.PRIVATE_KEY_MOONRIVER ? [process.env.PRIVATE_KEY_MOONRIVER] : [],
    },
    optimism: {
      url: process.env.RPC_URL_OPTIMISM || '',
      chainId: 10,
      accounts: process.env.PRIVATE_KEY_OPTIMISM ? [process.env.PRIVATE_KEY_OPTIMISM] : [],
    },
    'optimism-testnet': {
      url: process.env.RPC_URL_OPTIMISM_TESTNET || '',
      chainId: 420,
      accounts: process.env.PRIVATE_KEY_OPTIMISM_TESTNET ? [process.env.PRIVATE_KEY_OPTIMISM_TESTNET] : [],
    },
    polygon: {
      url: process.env.RPC_URL_POLYGON || '',
      chainId: 137,
      accounts: process.env.PRIVATE_KEY_POLYGON ? [process.env.PRIVATE_KEY_POLYGON] : [],
    },
    'polygon-testnet': {
      url: process.env.RPC_URL_POLYGON_TESTNET || '',
      chainId: 80001,
      accounts: process.env.PRIVATE_KEY_POLYGON_TESTNET ? [process.env.PRIVATE_KEY_POLYGON_TESTNET] : [],
    },
    rsk: {
      url: process.env.RPC_URL_RSK || '',
      chainId: 30,
      accounts: process.env.PRIVATE_KEY_RSK ? [process.env.PRIVATE_KEY_RSK] : [],
    },
    'rsk-testnet': {
      url: process.env.RPC_URL_RSK_TESTNET || '',
      chainId: 31,
      accounts: process.env.PRIVATE_KEY_RSK_TESTNET ? [process.env.PRIVATE_KEY_RSK_TESTNET] : [],
    },
    zkevm: {
      url: process.env.RPC_URL_ZKEVM || '',
      chainId: 1101,
      accounts: process.env.PRIVATE_KEY_ZKEVM ? [process.env.PRIVATE_KEY_ZKEVM] : [],
    },
    'zkevm-testnet': {
      url: process.env.RPC_URL_ZKEVM_TESTNET || '',
      chainId: 1442,
      accounts: process.env.PRIVATE_KEY_ZKEVM_TESTNET ? [process.env.PRIVATE_KEY_ZKEVM_TESTNET] : [],
    },
    zksync: {
      url: process.env.RPC_URL_ZKSYNC || '',
      chainId: 324,
      accounts: process.env.PRIVATE_KEY_ZKSYNC ? [process.env.PRIVATE_KEY_ZKSYNC] : [],
    },
    'zksync-goerli-testnet': {
      url: process.env.RPC_URL_ZKSYNC_GOERLI_TESTNET || '',
      chainId: 280,
      accounts: process.env.PRIVATE_KEY_ZKSYNC_GOERLI_TESTNET ? [process.env.PRIVATE_KEY_ZKSYNC_GOERLI_TESTNET] : [],
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
