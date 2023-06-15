import hre from 'hardhat';
import { FunderDepository__factory } from '../typechain-types';

export const computeFunderDepositoryAddress = async (funderAddress: string, owner: string, root: string) => {
  //   console.log( "FunderDepository__factory.bytecode:", FunderDepository__factory.bytecode);

  //   const artifact = await hre.artifacts.readArtifact("FunderDepository");
  //   console.log("artifact.bytecode:", artifact.bytecode);
  //   console.log("artifact.deployedBytecode:", artifact.deployedBytecode);

  const initcode = hre.ethers.utils.solidityPack(
    ['bytes', 'bytes'],
    [FunderDepository__factory.bytecode, hre.ethers.utils.defaultAbiCoder.encode(['address', 'bytes32'], [owner, root])]
  );

  return hre.ethers.utils.getCreate2Address(
    funderAddress,
    hre.ethers.constants.HashZero,
    hre.ethers.utils.keccak256(initcode)
  );
};
