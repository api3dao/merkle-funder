import { go, goSync } from '@api3/promise-utils';
import * as hre from 'hardhat';
import loadConfig from '../src/config';
import buildMerkleTree from '../src/merkle-tree';

const decodeRevertString = (returndata: string) => {
  // Refer to https://ethereum.stackexchange.com/a/83577

  // Skip the funciton selector from the returned encoded data
  // and only decode the revert reason string.
  // Function selector is 4 bytes long and that is why we skip
  // the first 2 bytes (0x) and the rest 8 bytes is the function selector
  // return ethers.utils.defaultAbiCoder.decode(['string'], `0x${callData.substring(2 + 4 * 2)}`)[0];
  const goDecode = goSync(
    () => hre.ethers.utils.defaultAbiCoder.decode(['string'], `0x${returndata.substring(2 + 4 * 2)}`)[0]
  );
  if (!goDecode.success) return 'No revert string';

  return goDecode.data;
};

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

  const loadConfigResult = await go(() => loadConfig());
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

      const multicallCalldata = values.map(({ recipient, lowThreshold, highThreshold }, treeValueIndex) => {
        return funder.interface.encodeFunctionData('fund(address,bytes32,bytes32[],address,uint256,uint256)', [
          owner,
          tree.root,
          tree.getProof(treeValueIndex),
          recipient,
          hre.ethers.utils.parseUnits(lowThreshold.value.toString(), lowThreshold.unit),
          hre.ethers.utils.parseUnits(highThreshold.value.toString(), highThreshold.unit),
        ]);
      });
      console.log('Number of calldatas to be sent: ', multicallCalldata.length);

      // TODO: A potential improvement here is to batch these calls
      const tryStaticMulticallResult = await go(() => funder.callStatic.tryMulticall(multicallCalldata));
      if (!tryStaticMulticallResult.success) {
        console.log('Failed to call funder.callStatic.tryMulticall:', tryStaticMulticallResult.error.message);
        return;
      }

      // Filter out calldata that failed to be sent
      const { successes, returndata } = tryStaticMulticallResult.data;
      const successfulMulticallCalldata = (successes as boolean[]).reduce((acc, success, index) => {
        if (!success) {
          console.log(`Calldata #${index + 1} reverted with message:`, decodeRevertString(returndata[index]));
          return acc;
        }
        return [...acc, multicallCalldata[index]];
      }, [] as string[]);

      // Try to send the calldatas
      if (successfulMulticallCalldata.length > 0) {
        // We still tryMulticall in case a recipient is funded by someone else in the meantime
        const tryMulticallResult = await go(() => funder.tryMulticall(successfulMulticallCalldata));
        if (!tryMulticallResult.success) {
          console.log('Failed to call funder.tryMulticall:', tryMulticallResult.error.message);
          return;
        }
        console.log(`Funded ${successfulMulticallCalldata.length} recipients`);
      } else {
        console.log('Recipients are already funded');
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
