import { go, goSync } from '@api3/promise-utils';
import * as hre from 'hardhat';
import { computeMerkleFunderDepositoryAddress } from '../src';
import loadConfig from '../src/config';
import buildMerkleTree from '../src/merkle-tree';

async function main() {
  const chainName = hre.network.name;
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

  const chainMerkleFunderDepositories = loadConfigResult.data[chainId].merkleFunderDepositories;
  if (!chainMerkleFunderDepositories) {
    console.log('No merkleFunderDepositories for chain: ', chainName, chainId);
    return;
  }

  let nonce: number | null = null;
  for (const { owner, values } of chainMerkleFunderDepositories) {
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
      nonce = nonce ?? (await merkleFunder.signer.getTransactionCount());
      await merkleFunder.deployMerkleFunderDepository(owner, tree.root);
      nonce++;
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

    // TODO: For now, funding MerkleFunderDepository is only available on localhost
    if (chainName.toLowerCase() !== 'localhost') {
      continue;
    }

    // TODO: this target seems chain dependant and should not be hardcoded here
    const targetBalance = hre.ethers.utils.parseUnits('100', 'ether');

    if (balance.lt(targetBalance)) {
      nonce = nonce ?? (await merkleFunder.signer.getTransactionCount());
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
      nonce++;
      console.log(`Topped the MerkleFunderDepository at ${merkleFunderDepositoryAddress} up to 100 ETH`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
