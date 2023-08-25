import { LogLevel, addMetadata, logger, removeMetadata, setLogOptions } from '@api3/airnode-utilities';
import { Context, ScheduledEvent, ScheduledHandler } from 'aws-lambda';
import { ethers } from 'ethers';
import * as references from '../deployments/references.json';
import { loadConfig } from './config';
import { MerkleFunder__factory } from './contracts';
import { fundChainRecipients } from './merkle-funder';

const getMerkleFunderContract = (funderMnemonic: string, providerUrl: string, chainId: string) => {
  // Read MerkleFunder address from deployments/references.json
  const merkleFunderAddress = (references.MerkleFunder as Record<string, string>)[chainId];
  if (!merkleFunderAddress) {
    throw new Error(`No MerkleFunder address found for chain ID: ${chainId}`);
  }

  // Connect to the network and get the signer
  const provider = new ethers.providers.JsonRpcProvider(providerUrl);
  const signer = ethers.Wallet.fromMnemonic(funderMnemonic).connect(provider);

  // Return the merkleFunder contract
  return new ethers.Contract(merkleFunderAddress, MerkleFunder__factory.abi, signer);
};

export const run: ScheduledHandler = async (_event: ScheduledEvent, _context: Context): Promise<void> => {
  const consoleTimeLabel = 'Scheduled task finished running. Time elapsed';
  console.time(consoleTimeLabel);

  const config = loadConfig();

  setLogOptions({
    format: 'plain',
    level: (process.env.LOG_LEVEL as LogLevel) || 'INFO',
  });

  const chainFundingResults = await Promise.allSettled(
    Object.entries(config).flatMap(([chainId, { providers, funderMnemonic, ...chainConfig }]) =>
      Object.entries(providers).map(async ([providerName, provider]) => {
        addMetadata({ 'CHAIN-ID': chainId, PROVIDER: providerName });
        const merkleFunderContract = getMerkleFunderContract(funderMnemonic, provider.url, chainId);
        await fundChainRecipients(chainId, chainConfig, merkleFunderContract);
      })
    )
  );

  chainFundingResults.forEach((result) => {
    removeMetadata(['CHAIN-ID', 'PROVIDER']);
    if (result.status === 'rejected') {
      logger.error(result.reason.message);
      logger.debug(result.reason.stack);
    }
  });

  console.timeEnd(consoleTimeLabel);
};
