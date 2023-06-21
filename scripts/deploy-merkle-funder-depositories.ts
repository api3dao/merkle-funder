import { go, goSync } from '@api3/promise-utils';
import * as hre from 'hardhat';
import { computeMerkleFunderDepositoryAddress } from '../src';
import loadConfig from '../src/config';
import buildMerkleTree from '../src/merkle-tree';

async function main() {
  const chainName = process.env.NETWORK;
  console.log('Chain name:', chainName);

  const chainId = parseInt(await hre.getChainId());
  console.log('Chain ID:', chainId);

  const merkleFunderDeployment = await hre.deployments.get('MerkleFunder');
  console.log('MerkleFunder address:', merkleFunderDeployment.address);

  const { deployer: deployerAddress } = await hre.getNamedAccounts();
  console.log('Deployer address:', deployerAddress);

  const deployer = await hre.ethers.getSigner(deployerAddress);
  const merkleFunder = new hre.ethers.Contract(merkleFunderDeployment.address, merkleFunderDeployment.abi, deployer);

  const loadConfigResult = goSync(() => loadConfig());
  if (!loadConfigResult.success) {
    console.log('Failed to load config:\n', loadConfigResult.error.message);
    return;
  }

  const chainMerkleFunderDepositories = loadConfigResult.data.merkleFunderDepositories[chainId];
  if (!chainMerkleFunderDepositories) {
    console.log('No merkleFunderDepositories for chain: ', chainName, chainId);
    return;
  }

  await Promise.all(
    chainMerkleFunderDepositories.map(async ({ owner, values }) => {
      // Build merkle tree
      const tree = buildMerkleTree(values);
      console.log('Merkle tree:\n', tree.render());

      // Compute MerkleFunderFepository address and check if it is already deployed
      const merkleFunderDepositoryAddress = await computeMerkleFunderDepositoryAddress(
        merkleFunder.address,
        owner,
        tree.root
      );

      if ((await hre.ethers.provider.getCode(merkleFunderDepositoryAddress)) === '0x') {
        await merkleFunder.deployMerkleFunderDepository(owner, tree.root);
        console.log('MerkleFunderDepository is deployed at', merkleFunderDepositoryAddress);
      } else {
        console.log('MerkleFunderDepository is already deployed at', merkleFunderDepositoryAddress);
      }

      // Get MerkleFunderDepository balance
      const getBalanceResult = await go(() => hre.ethers.provider.getBalance(merkleFunderDepositoryAddress), {
        totalTimeoutMs: 10_000,
        retries: 1,
        attemptTimeoutMs: 4_900,
      });
      if (!getBalanceResult.success) {
        console.log('Failed to get MerkleFunderDepository balance:', getBalanceResult.error.message);
        return;
      }

      // If balance is lower than target balance then send funds
      const balance = getBalanceResult.data || hre.ethers.constants.Zero;
      console.log('MerkleFunderDepository current balance:', hre.ethers.utils.formatEther(balance));
      const targetBalance = hre.ethers.utils.parseUnits('100', 'ether');
      if (balance.lt(targetBalance)) {
        const sendTransactionResult = await go(
          () =>
            deployer.sendTransaction({
              to: merkleFunderDepositoryAddress,
              value: targetBalance.sub(balance),
            }),
          { totalTimeoutMs: 5_000 }
        );
        if (!sendTransactionResult.success) {
          console.log('Failed to send funds to MerkleFunderDepository:', sendTransactionResult.error.message);
          return;
        }

        console.log(`Topped the MerkleFunderDepository at ${merkleFunderDepositoryAddress} up to 100 ETH`);
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
