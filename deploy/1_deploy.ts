import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy, log } = deployments;

  const { deployer } = await getNamedAccounts();

  const merkleFunder = await deploy('MerkleFunder', {
    from: deployer,
    log: true,
    args: [],
    deterministicDeployment: process.env.DETERMINISTIC ? ethers.constants.HashZero : undefined,
  });

  log(`Deployed MerkleFunder at ${merkleFunder.address}`);
};

export default func;
func.tags = ['MerkleFunder'];
