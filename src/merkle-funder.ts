import { getGasPrice } from '@api3/airnode-utilities';
import { go } from '@api3/promise-utils';
import { ethers } from 'ethers';
import { decodeRevertString } from './evm';
import buildMerkleTree from './merkle-tree';
import { ChainConfig } from './types';

export const fundChainRecipients = async (
  chainConfig: Pick<ChainConfig, 'options' | 'merkleFunderDepositories'>,
  merkleFunderContract: ethers.Contract
) => {
  let nonce: number | null = null;
  for (const { owner, values } of chainConfig.merkleFunderDepositories) {
    // Build merkle tree
    const tree = buildMerkleTree(values);
    console.log('Merkle tree:\n', tree.render());

    const getBlockNumberCalldata = merkleFunderContract.interface.encodeFunctionData('getBlockNumber()');

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
    console.log('Expected number of calldatas to be sent: ', multicallCalldata.length);

    const tryStaticMulticallResult = await go(() =>
      merkleFunderContract.callStatic.tryMulticall([getBlockNumberCalldata, ...multicallCalldata])
    );
    if (!tryStaticMulticallResult.success) {
      console.log(
        'Failed to call merkleFunderContract.callStatic.tryMulticall:',
        tryStaticMulticallResult.error.message
      );
      continue;
    }

    const {
      successes: [getBlockNumberSuccess, ...remainingSuccesses],
      returndata: [getBlockNumberReturndata, ...remainingRetunrdata],
    } = tryStaticMulticallResult.data;

    // Get block number to use as argument when fetching the transaction count
    if (!getBlockNumberSuccess) {
      console.log('Failded to fetch block number:', decodeRevertString(getBlockNumberReturndata));
      continue;
    }
    const blockNumber = ethers.BigNumber.from(getBlockNumberReturndata);
    console.log('Block number:', blockNumber.toString());

    // Filter out calldata that failed to be sent
    const successfulMulticallCalldata = (remainingSuccesses as boolean[]).reduce((acc, success, index) => {
      if (!success) {
        console.log(`Calldata #${index + 1} reverted with message:`, decodeRevertString(remainingRetunrdata[index]));
        return acc;
      }
      return [...acc, multicallCalldata[index]];
    }, [] as string[]);

    // Try to send the calldatas
    // TODO: A potential improvement here is to batch these calls
    console.log('Actual number of calldatas to be sent: ', successfulMulticallCalldata.length);
    if (successfulMulticallCalldata.length > 0) {
      nonce = nonce ?? (await merkleFunderContract.signer.getTransactionCount(blockNumber.toNumber()));
      console.log('Nonce:', nonce);

      // Get the latest gas price
      const [logs, gasTarget] = await getGasPrice(merkleFunderContract.provider, chainConfig.options);
      logs.forEach((log) => console.log(log.error ? log.error.message : log.message));

      // We still tryMulticall in case a recipient is funded by someone else in the meantime
      const tryMulticallResult = await go(() =>
        merkleFunderContract.tryMulticall(successfulMulticallCalldata, { nonce, ...gasTarget })
      );
      if (!tryMulticallResult.success) {
        console.log('Failed to call merkleFunderContract.tryMulticall:', tryMulticallResult.error.message);
        continue;
      }
      console.log(
        `Sent tx with hash ${tryMulticallResult.data.hash} that will send funds to ${successfulMulticallCalldata.length} recipients`
      );
      nonce++;
    }
  }
};
