import { go } from '@api3/promise-utils';
import { ChainConfig, decodeRevertString } from '../src';
import buildMerkleTree from '../src/merkle-tree';
import { ethers } from 'ethers';

export const fundChainRecipients = async (chainFunderDepositories: ChainConfig[], funderContract: ethers.Contract) => {
  await Promise.all(
    chainFunderDepositories.map(async ({ owner, values }) => {
      // Build merkle tree
      const tree = buildMerkleTree(values);
      console.log('Merkle tree:\n', tree.render());

      const multicallCalldata = values.map(({ recipient, lowThreshold, highThreshold }, treeValueIndex) => {
        return funderContract.interface.encodeFunctionData('fund(address,bytes32,bytes32[],address,uint256,uint256)', [
          owner,
          tree.root,
          tree.getProof(treeValueIndex),
          recipient,
          ethers.utils.parseUnits(lowThreshold.value.toString(), lowThreshold.unit),
          ethers.utils.parseUnits(highThreshold.value.toString(), highThreshold.unit),
        ]);
      });
      console.log('Number of calldatas to be sent: ', multicallCalldata.length);

      // TODO: A potential improvement here is to batch these calls
      const tryStaticMulticallResult = await go(() => funderContract.callStatic.tryMulticall(multicallCalldata));
      if (!tryStaticMulticallResult.success) {
        console.log('Failed to call funderContract.callStatic.tryMulticall:', tryStaticMulticallResult.error.message);
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
        const tryMulticallResult = await go(() => funderContract.tryMulticall(successfulMulticallCalldata));
        if (!tryMulticallResult.success) {
          console.log('Failed to call funderContract.tryMulticall:', tryMulticallResult.error.message);
          return;
        }
        console.log(`Funded ${successfulMulticallCalldata.length} recipients`);
      } else {
        console.log('Recipients are already funded');
      }
    })
  );
};
