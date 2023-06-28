import { Context, ScheduledEvent, ScheduledHandler } from 'aws-lambda';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { ChainConfig, fundChainRecipients, loadConfig } from './';

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
  const signer = ethers.Wallet.fromMnemonic(chainConfig.funderMnemonic).connect(provider);

  // Return the merkleFunder contract
  return new ethers.Contract(merkleFunderDeployment.address, merkleFunderDeployment.abi, signer);
};

export const run: ScheduledHandler = async (_event: ScheduledEvent, _context: Context): Promise<void> => {
  const startedAt = new Date();
  const config = loadConfig();

  const chainFundingResults = await Promise.allSettled(
    Object.entries(config).map(async ([chainId, chainConfig]) => {
      const merkleFunderContract = getMerkleFunderContract(chainConfig, path.join(__dirname, '../'), chainId);
      await fundChainRecipients(chainConfig.merkleFunderDepositories, merkleFunderContract);
    })
  );

  chainFundingResults.forEach((result) => {
    if (result.status === 'rejected') {
      console.log(result.reason);
    }
  });

  const endedAt = new Date();
  console.log(`Scheduled task finished running. Run delta: ${(endedAt.getTime() - startedAt.getTime()) / 1000} s`);

  // Wait .5 sec for all logs to get printed before ending the lambda invocation
  await new Promise((resolve) => setTimeout(resolve, 500));
};
