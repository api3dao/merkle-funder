import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import * as fs from 'fs';
import * as path from 'path';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { config } = hre;
  const networks = fs
    .readdirSync('deployments', { withFileTypes: true })
    .filter((item) => item.isDirectory() && item.name !== 'localhost')
    .map((item) => item.name);
  const contractNames = ['MerkleFunder'];
  const references: any = {};
  references.chainNames = {};
  for (const network of networks) {
    references.chainNames[config.networks[network].chainId!] = network;
  }
  for (const contractName of contractNames) {
    references[contractName] = {};
    for (const network of networks) {
      const deployment = JSON.parse(fs.readFileSync(path.join('deployments', network, `${contractName}.json`), 'utf8'));
      references[contractName][config.networks[network].chainId!] = deployment.address;
    }
  }
  const deploymentBlockNumbers: any = { chainNames: references.chainNames };
  for (const contractName of contractNames) {
    deploymentBlockNumbers[contractName] = {};
    for (const network of networks) {
      const deployment = JSON.parse(fs.readFileSync(path.join('deployments', network, `${contractName}.json`), 'utf8'));
      if (deployment.receipt) {
        deploymentBlockNumbers[contractName][config.networks[network].chainId!] = deployment.receipt.blockNumber;
      } else {
        deploymentBlockNumbers[contractName][config.networks[network].chainId!] = 'MISSING';
      }
    }
  }

  fs.writeFileSync(path.join('deployments', 'references.json'), JSON.stringify(references, null, 2));
  fs.writeFileSync(
    path.join('deployments', 'deployment-block-numbers.json'),
    JSON.stringify(deploymentBlockNumbers, null, 2)
  );
};

export default func;
