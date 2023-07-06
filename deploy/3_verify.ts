import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { buildMerkleTree } from '../src';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getUnnamedAccounts, ethers, network, run } = hre;

  if (network.name === 'localhost' || network.name === 'hardhat') {
    console.log('Skipping verification because network is localhost');
    return;
  }

  const MerkleFunder = await deployments.get('MerkleFunder');
  await run('verify:verify', {
    address: MerkleFunder.address,
  });

  const merkleFunder = new ethers.Contract(MerkleFunder.address, MerkleFunder.abi, (await ethers.getSigners())[0]);

  const tree = buildMerkleTree([
    {
      recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      lowThreshold: {
        value: 10010,
        unit: 'ether',
      },
      highThreshold: {
        value: 10020,
        unit: 'ether',
      },
    },
    {
      recipient: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      lowThreshold: {
        value: 9000,
        unit: 'ether',
      },
      highThreshold: {
        value: 10050,
        unit: 'ether',
      },
    },
  ]);
  const owner = (await getUnnamedAccounts())[0];
  const expectedMerkleFunderDepositoryAddress = await merkleFunder.computeMerkleFunderDepositoryAddress(
    owner,
    tree.root
  );

  await run('verify:verify', {
    address: expectedMerkleFunderDepositoryAddress,
    constructorArguments: [owner, tree.root],
  });
};

export default func;
