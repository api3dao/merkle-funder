import { go, goSync } from '@api3/promise-utils';
import * as hre from 'hardhat';
import { computeFunderDepositoryAddress } from '../src';
import loadConfig from '../src/config';
import buildMerkleTree from '../src/merkle-tree';

async function main() {
  const chainName = process.env.NETWORK;
  console.log('Chain name:', chainName);

  const chainId = parseInt(await hre.getChainId());
  console.log('Chain ID:', chainId);

  const funderDeployment = await hre.deployments.get('Funder');
  console.log('Funder address:', funderDeployment.address);

  const { deployer: deployerAddress } = await hre.getNamedAccounts();
  console.log('Deployer address:', deployerAddress);

  const deployer = await hre.ethers.getSigner(deployerAddress);
  const funder = new hre.ethers.Contract(funderDeployment.address, funderDeployment.abi, deployer);

  const loadConfigResult = goSync(() => loadConfig());
  if (!loadConfigResult.success) {
    console.log('Failed to load config:\n', loadConfigResult.error.message);
    return;
  }

  const chainFunderDepositories = loadConfigResult.data.funderDepositories[chainId];
  if (!chainFunderDepositories) {
    console.log('No funderDepositories for chain: ', chainName, chainId);
    return;
  }

  await Promise.all(
    chainFunderDepositories.map(async ({ owner, values }) => {
      // Build merkle tree
      const tree = buildMerkleTree(values);
      console.log('Merkle tree:\n', tree.render());

      // Compute FunderFepository address and check if it is already deployed
      const funderDepositoryAddress = await computeFunderDepositoryAddress(funder.address, owner, tree.root);

      if ((await hre.ethers.provider.getCode(funderDepositoryAddress)) === '0x') {
        await funder.deployFunderDepository(owner, tree.root);
        console.log('FunderDepository is deployed at', funderDepositoryAddress);
      } else {
        console.log('FunderDepository is already deployed at', funderDepositoryAddress);
      }

      // Get FunderDepository balance
      const getBalanceResult = await go(() => hre.ethers.provider.getBalance(funderDepositoryAddress), {
        totalTimeoutMs: 10_000,
        retries: 1,
        attemptTimeoutMs: 4_900,
      });
      if (!getBalanceResult.success) {
        console.log('Failed to get FunderDepository balance:', getBalanceResult.error.message);
        return;
      }

      // If balance is lower than target balance then send funds
      const balance = getBalanceResult.data || hre.ethers.constants.Zero;
      console.log('FunderDepository current balance:', hre.ethers.utils.formatEther(balance));
      const targetBalance = hre.ethers.utils.parseUnits('100', 'ether');
      if (balance.lt(targetBalance)) {
        const sendTransactionResult = await go(
          () =>
            deployer.sendTransaction({
              to: funderDepositoryAddress,
              value: targetBalance.sub(balance),
            }),
          { totalTimeoutMs: 5_000 }
        );
        if (!sendTransactionResult.success) {
          console.log('Failed to send funds to FunderDepository:', sendTransactionResult.error.message);
          return;
        }

        console.log(`Topped the FunderDepository at ${funderDepositoryAddress} up to 100 ETH`);
      }
    })
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
