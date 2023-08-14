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
  const startedAt = new Date();
  const config = loadConfig();

  const chainFundingResults = await Promise.allSettled(
    Object.entries(config).flatMap(([chainId, { providers, funderMnemonic, ...chainConfig }]) =>
      Object.entries(providers).map(async ([providerName, provider]) => {
        console.log(`Funding recipients on chain with ID: ${chainId} using provider: ${providerName}`);

        const merkleFunderContract = getMerkleFunderContract(funderMnemonic, provider.url, chainId);
        await fundChainRecipients(chainConfig, merkleFunderContract);
      })
    )
  );

  chainFundingResults.forEach((result) => {
    if (result.status === 'rejected') {
      console.log(result.reason);
    }
  });

  const endedAt = new Date();
  console.log(`Scheduled task finished running. Run delta: ${(endedAt.getTime() - startedAt.getTime()) / 1000} s`);
};
