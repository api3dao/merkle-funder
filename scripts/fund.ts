import { go } from '@api3/promise-utils';
import * as hre from 'hardhat';
import { loadConfig } from '../src/config';
import { fundChainRecipients } from '../src/merkle-funder';
import { logger, setLogOptions } from '@api3/airnode-utilities';

async function main() {
  const chainId = await hre.getChainId();

  setLogOptions({
    format: 'plain', //config.nodeSettings.logFormat,
    level: 'INFO', //config.nodeSettings.logLevel,
    meta: {
      'CHAIN-ID': chainId,
      NETWORK: hre.network.name,
    },
  });

  const loadConfigResult = await go(() => loadConfig());
  if (!loadConfigResult.success) {
    logger.error(`Failed to load config:\n${loadConfigResult.error.message}`);
    return;
  }

  const merkleFunderDeployment = await hre.deployments.get('MerkleFunder');
  logger.info(`MerkleFunder address: ${merkleFunderDeployment.address}`);

  const deployerAddress = (await hre.getUnnamedAccounts())[0];
  logger.info(`Deployer address: ${deployerAddress}`);

  const deployer = await hre.ethers.getSigner(deployerAddress);

  const merkleFunderContract = new hre.ethers.Contract(
    merkleFunderDeployment.address,
    merkleFunderDeployment.abi,
    deployer
  );

  const chainConfig = loadConfigResult.data[parseInt(chainId)];
  if (!chainConfig.merkleFunderDepositories) {
    logger.error(`No MerkleFunderDepositories found for chain ID: ${chainId}`);
    return;
  }

  await fundChainRecipients(chainId, chainConfig, merkleFunderContract);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
