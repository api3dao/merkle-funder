import { Context, ScheduledEvent, ScheduledHandler } from 'aws-lambda';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import loadConfig from './config';
import { fundChainRecipients } from './merkle-funder';
import { ChainConfig } from './types';

const getMerkleFunderContract = (chainConfig: ChainConfig, rootPath: string, chainId: string) => {
  // Find the chain name where the chainId matches the .chainId file on /deployments folder
  const deploymentsPath = path.join(rootPath, 'deployments');
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(`Directory does not exist: ${deploymentsPath}`);
  }
  const chainDeployment = fs
    .readdirSync(deploymentsPath, { withFileTypes: true })
    .find((item) => fs.readFileSync(path.join(deploymentsPath, item.name, '.chainId'), 'utf-8') === chainId);
  if (!chainDeployment) {
    throw new Error(`No deployment found for chainId: ${chainId}`);
  }

  // Read the MerkleFunder.json deployment file
  const merkleFunderDeployment = JSON.parse(
    fs.readFileSync(path.join(deploymentsPath, chainDeployment.name, 'MerkleFunder.json'), 'utf-8')
  );

  // Connect to the network and get the signer
  const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpcUrl);
  const signer = new ethers.Wallet(chainConfig.privateKey).connect(provider);

  // Return the merkleFunder contract
  return new ethers.Contract(merkleFunderDeployment.address, merkleFunderDeployment.abi, signer);
};

export const run: ScheduledHandler = async (_event: ScheduledEvent, _context: Context): Promise<void> => {
  const startedAt = new Date();
  const config = loadConfig();

  // TODO: replace with Promise.all? In the logs I see that handler finishes before printing all messages
  try {
    await Promise.all(
      Object.entries(config).map(async ([chainId, chainConfig]) => {
        const merkleFunderContract = getMerkleFunderContract(chainConfig, path.join(__dirname, '../'), chainId);
        await fundChainRecipients(chainConfig.merkleFunderDepositories, merkleFunderContract);
      })
    );
  } catch (err) {
    const error = err as Error;
    console.error(error.message);
  }

  const endedAt = new Date();
  console.log(`Scheduled task finished running. Run delta: ${(endedAt.getTime() - startedAt.getTime()) / 1000} s`);
};
