import { go } from '@api3/promise-utils';
import * as hre from 'hardhat';
import loadConfig from '../src/config';
import { fundChainRecipients } from '../src/funder';

async function main() {
  const loadConfigResult = await go(() => loadConfig());
  if (!loadConfigResult.success) {
    console.log('Failed to load config:\n', loadConfigResult.error.message);
    return;
  }

  const funderDeployment = await hre.deployments.get('Funder');
  console.log('Funder address:', funderDeployment.address);

  const { deployer: deployerAddress } = await hre.getNamedAccounts();
  console.log('Deployer address:', deployerAddress);

  const deployer = await hre.ethers.getSigner(deployerAddress);

  const funderContract = new hre.ethers.Contract(funderDeployment.address, funderDeployment.abi, deployer);

  const chainId = await hre.getChainId();
  console.log('Chain ID:', chainId);

  const chainFunderDepositories = loadConfigResult.data.funderDepositories[parseInt(chainId)];
  if (!chainFunderDepositories) {
    console.log('No funderDepositories for chain ID: ', chainId);
    return;
  }

  await fundChainRecipients(chainFunderDepositories, funderContract);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
