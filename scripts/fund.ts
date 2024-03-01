import { LogLevel, LogOptions, logger } from '@api3/airnode-utilities';
import { go } from '@api3/promise-utils';
import * as hre from 'hardhat';
import { MerkleFunder__factory } from '../src';
import { loadConfig } from '../src/config';
import { fundChainRecipients } from '../src/merkle-funder';

async function main() {
  const chainId = await hre.getChainId();

  const logOptions: LogOptions = {
    format: 'plain',
    level: (process.env.LOG_LEVEL as LogLevel) || 'INFO',
    meta: {
      'CHAIN-ID': chainId,
      NETWORK: hre.network.name,
    },
  };

  const loadConfigResult = await go(() => loadConfig());
  if (!loadConfigResult.success) {
    logger.error(`Failed to load config:\n${loadConfigResult.error.message}`, null, logOptions);
    return;
  }

  const merkleFunderDeployment = await hre.deployments.get('MerkleFunder');
  logger.info(`MerkleFunder address: ${merkleFunderDeployment.address}`, logOptions);

  const deployerAddress = (await hre.getUnnamedAccounts())[0];
  logger.info(`Deployer address: ${deployerAddress}`, logOptions);

  const deployer = await hre.ethers.getSigner(deployerAddress);

  const merkleFunderContract = MerkleFunder__factory.connect(merkleFunderDeployment.address, deployer);

  const chainConfig = loadConfigResult.data[parseInt(chainId)];
  if (!chainConfig.merkleFunderDepositories) {
    logger.error(`No MerkleFunderDepositories found for chain ID: ${chainId}`, null, logOptions);
    return;
  }

  await fundChainRecipients(chainId, chainConfig, merkleFunderContract, logOptions);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
