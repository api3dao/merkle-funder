import { getGasPrice, logger } from '@api3/airnode-utilities';
import { go } from '@api3/promise-utils';
import { ethers } from 'ethers';
import { decodeRevertString } from './evm';
import buildMerkleTree from './merkle-tree';
import { ChainConfig } from './types';

export const fundChainRecipients = async (
  chainId: string,
  chainConfig: Pick<ChainConfig, 'options' | 'merkleFunderDepositories'>,
  merkleFunderContract: ethers.Contract
) => {
  logger.info(`Processing ${chainConfig.merkleFunderDepositories.length} merkleFunderDepositories...`);

  let nonce: number | null = null;
  for (const { owner, values } of chainConfig.merkleFunderDepositories) {
    // TODO: should we compute the MerkleFunderDepository address and log it?

    // Build merkle tree
    const tree = buildMerkleTree(values);
    logger.debug(`Merkle tree:\n${tree.render()}`);

    const getBlockNumberCalldata = merkleFunderContract.interface.encodeFunctionData('getBlockNumber()');

    const multicallCalldata = values.map(({ recipient, lowThreshold, highThreshold }, treeValueIndex) => {
      logger.debug(`Testing funding of ${recipient}`);
      logger.debug(JSON.stringify({ lowThreshold, highThreshold }, null, 2));
      return {
        recipient,
        calldata: merkleFunderContract.interface.encodeFunctionData(
          'fund(address,bytes32,bytes32[],address,uint256,uint256)',
          [
            owner,
            tree.root,
            tree.getProof(treeValueIndex),
            recipient,
            ethers.utils.parseUnits(lowThreshold.value.toString(), lowThreshold.unit),
            ethers.utils.parseUnits(highThreshold.value.toString(), highThreshold.unit),
          ]
        ),
      };
    });

    const tryStaticMulticallResult = await go(() =>
      merkleFunderContract.callStatic.tryMulticall([
        getBlockNumberCalldata,
        ...multicallCalldata.map((c) => c.calldata),
      ])
    );
    if (!tryStaticMulticallResult.success) {
      logger.info(
        `Failed to call merkleFunderContract.callStatic.tryMulticall: ${tryStaticMulticallResult.error.message}`
      );
      continue;
    }

    const {
      successes: [getBlockNumberSuccess, ...remainingSuccesses],
      returndata: [getBlockNumberReturndata, ...remainingRetunrdata],
    } = tryStaticMulticallResult.data;

    // Get block number to use as argument when fetching the transaction count
    if (!getBlockNumberSuccess) {
      logger.info(`Failded to fetch block number: ${decodeRevertString(getBlockNumberReturndata)}`);
      continue;
    }
    const blockNumber = ethers.BigNumber.from(getBlockNumberReturndata);
    logger.info(`Block number fetched while testing funding of recipients: ${blockNumber}`);

    // Filter out calldata that failed to be sent
    const successfulMulticallCalldata = (remainingSuccesses as boolean[]).reduce(
      (acc: { recipient: string; calldata: string }[], success, index) => {
        if (!success) {
          // TODO: how to handle custom errors since those cannot be decoded?
          logger.info(
            `Funding test of ${multicallCalldata[index].recipient} reverted with message: ${decodeRevertString(
              remainingRetunrdata[index]
            )}`
          );
          return acc;
        }

        logger.info(`Funding test of ${multicallCalldata[index].recipient} succeeded`);

        return [...acc, multicallCalldata[index]];
      },
      []
    );

    // Try to send the calldatas
    // TODO: A potential improvement here is to batch these calls
    if (successfulMulticallCalldata.length > 0) {
      nonce =
        nonce ??
        (await merkleFunderContract.signer.getTransactionCount(
          // HACK: Arbitrum returns the L1 block number so we need to fetch the L2 block number via provider RPC call
          chainId === '42161' ? await merkleFunderContract.provider.getBlockNumber() : blockNumber.toNumber()
        ));
      logger.info(`tryMulticall transaction nonce: ${nonce}`);

      // Get the latest gas price
      const [logs, gasTarget] = await getGasPrice(merkleFunderContract.provider, chainConfig.options);
      logs.forEach((log) => logger.info(log.error ? log.error.message : log.message));

      // We still tryMulticall in case a recipient is funded by someone else in the meantime
      const tryMulticallResult = await go(() =>
        merkleFunderContract.tryMulticall(
          successfulMulticallCalldata.map((c) => c.calldata),
          { nonce, ...gasTarget }
        )
      );
      if (!tryMulticallResult.success) {
        logger.error(`Failed to call merkleFunderContract.tryMulticall: ${tryMulticallResult.error.message}`);
        continue;
      }
      logger.info(`Sent tx with hash ${tryMulticallResult.data.hash}`);
      nonce++;
    }
  }
};
