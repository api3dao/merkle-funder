import { go } from '@api3/promise-utils';
import * as hre from 'hardhat';
import loadConfig from '../src/config';
import { fundChainRecipients } from '../src/merkle-funder';

async function main() {
  const loadConfigResult = await go(() => loadConfig());
  if (!loadConfigResult.success) {
    console.log('Failed to load config:\n', loadConfigResult.error.message);
    return;
  }

  const merkleFunderDeployment = await hre.deployments.get('MerkleFunder');
  console.log('MerkleFunder address:', merkleFunderDeployment.address);

  const { deployer: deployerAddress } = await hre.getNamedAccounts();
  console.log('Deployer address:', deployerAddress);

  const deployer = await hre.ethers.getSigner(deployerAddress);

  const merkleFunderContract = new hre.ethers.Contract(
    merkleFunderDeployment.address,
    merkleFunderDeployment.abi,
    deployer
  );

  const chainId = await hre.getChainId();
  console.log('Chain ID:', chainId);

  const chainMerkleFunderDepositories = loadConfigResult.data[parseInt(chainId)].merkleFunderDepositories;
  if (!chainMerkleFunderDepositories) {
    console.log('No merkleFunderDepositories for chain ID: ', chainId);
    return;
  }

  await fundChainRecipients(chainMerkleFunderDepositories, merkleFunderContract);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
