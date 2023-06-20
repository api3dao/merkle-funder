import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const networkSchema = z.object({
  url: z.string().url(),
  chainId: z.number(),
  accounts: z.array(z.string()),
  timeout: z.number().int().nonnegative().optional(),
});

const credentialsSchema = z.object({
  networks: z.record(z.string(), networkSchema),
});

export const getMerkleFunderContract = (rootPath: string, chainId: string) => {
  // Find the chain name where the chainId matches the .chainId file on /deployments folder
  const deploymentsPath = path.join(rootPath, 'deployments');
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

  // Read config/credentials.json file
  const credentials = loadCredentials(path.join(rootPath, 'config', 'credentials.json'));

  // Connect to the network and get the signer
  const provider = new ethers.providers.JsonRpcProvider(credentials.networks[chainDeployment.name].url);
  const signer = new ethers.Wallet(credentials.networks[chainDeployment.name].accounts[0]).connect(provider);

  // Return the merkleFunder contract
  return new ethers.Contract(merkleFunderDeployment.address, merkleFunderDeployment.abi, signer);
};

const loadCredentials = (credentialsPath = './config/credentials.json') => {
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));

  return credentialsSchema.parse(credentials);
};

export default loadCredentials;
