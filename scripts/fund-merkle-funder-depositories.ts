import { go, goSync } from '@api3/promise-utils';
import * as hre from 'hardhat';
import { computeMerkleFunderDepositoryAddress } from '../src';
import loadConfig from '../src/config';
import buildMerkleTree from '../src/merkle-tree';

async function main() {
  const chainName = hre.network.name;
  console.log('Chain name:', chainName);

  // Funding MerkleFunderDepository contracts is only allowed on localhost
  if (chainName.toLowerCase() !== 'localhost' && chainName.toLowerCase() !== 'hardhat') {
    console.log('Funding MerkleFunderDepository contracts is only allowed on localhost and hardhat networks');
    return;
  }

  const chainId = parseInt(await hre.getChainId());
  console.log('Chain ID:', chainId);

  const merkleFunderDeployment = await hre.deployments.get('MerkleFunder');
  console.log('MerkleFunder address:', merkleFunderDeployment.address);

  const deployerAddress = (await hre.getUnnamedAccounts())[0];
  console.log('Deployer address:', deployerAddress);

  const deployer = await hre.ethers.getSigner(deployerAddress);

  const loadConfigResult = goSync(() => loadConfig());
  if (!loadConfigResult.success) {
    console.log('Failed to load config:\n', loadConfigResult.error.message);
    return;
  }

  const chainMerkleFunderDepositories = loadConfigResult.data[chainId].merkleFunderDepositories;
  if (!chainMerkleFunderDepositories) {
    console.log('No merkleFunderDepositories for chain: ', chainName, chainId);
    return;
  }

  for (const { owner, values } of chainMerkleFunderDepositories) {
    // Build merkle tree
    const tree = buildMerkleTree(values);
    console.log('Merkle tree:\n', tree.render());

    // Compute MerkleFunderFepository address and check if it is already deployed
    const merkleFunderDepositoryAddress = await computeMerkleFunderDepositoryAddress(
      merkleFunderDeployment.address,
      owner,
      tree.root
    );

    if ((await hre.ethers.provider.getCode(merkleFunderDepositoryAddress)) === '0x') {
      console.log('MerkleFunderDepository has not been deployed at', merkleFunderDepositoryAddress);
      continue;
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

    // TODO: this target seems chain dependant and should not be hardcoded here
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
      const receipt = await sendTransactionResult.data.wait();
      console.log('Transaction hash:', receipt.transactionHash);
      console.log('Gas used:', hre.ethers.utils.formatUnits(receipt.gasUsed, 'gwei'));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
