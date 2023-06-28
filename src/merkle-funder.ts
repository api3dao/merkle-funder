import { getGasPrice } from '@api3/airnode-utilities';
import { go } from '@api3/promise-utils';
import { ethers } from 'ethers';
import { ChainConfig, buildMerkleTree, decodeRevertString } from './';

export const fundChainRecipients = async (
  chainConfig: Pick<ChainConfig, 'options' | 'merkleFunderDepositories'>,
  merkleFunderContract: ethers.Contract
) => {
  for (const { owner, values } of chainConfig.merkleFunderDepositories) {
    // Build merkle tree
    const tree = buildMerkleTree(values);
    console.log('Merkle tree:\n', tree.render());

    const multicallCalldata = values.map(({ recipient, lowThreshold, highThreshold }, treeValueIndex) =>
      merkleFunderContract.interface.encodeFunctionData('fund(address,bytes32,bytes32[],address,uint256,uint256)', [
        owner,
        tree.root,
        tree.getProof(treeValueIndex),
        recipient,
        ethers.utils.parseUnits(lowThreshold.value.toString(), lowThreshold.unit),
        ethers.utils.parseUnits(highThreshold.value.toString(), highThreshold.unit),
      ])
    );
    console.log('Number of calldatas to be sent: ', multicallCalldata.length);

    // TODO: A potential improvement here is to batch these calls
    const tryStaticMulticallResult = await go(() => merkleFunderContract.callStatic.tryMulticall(multicallCalldata));
    if (!tryStaticMulticallResult.success) {
      console.log(
        'Failed to call merkleFunderContract.callStatic.tryMulticall:',
        tryStaticMulticallResult.error.message
      );
      continue;
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
      // Get the latest gas price
      const [logs, gasTarget] = await getGasPrice(merkleFunderContract.provider, chainConfig.options);
      logs.forEach((log) => console.log(log.error ? log.error.message : log.message));

      // We still tryMulticall in case a recipient is funded by someone else in the meantime
      const tryMulticallResult = await go(() =>
        merkleFunderContract.tryMulticall(successfulMulticallCalldata, { ...gasTarget })
      );
      if (!tryMulticallResult.success) {
        console.log('Failed to call merkleFunderContract.tryMulticall:', tryMulticallResult.error.message);
        continue;
      }
      console.log(
        `Sent tx with hash ${tryMulticallResult.data.hash} that will send funds to ${successfulMulticallCalldata.length} recipients`
      );
    } else {
      console.log('No tx was sent. All recipients are already funded');
    }
  }
};
