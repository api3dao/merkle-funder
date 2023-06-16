import { goSync } from '@api3/promise-utils';
import { ethers } from 'ethers';
import { FunderDepository__factory } from '../typechain-types';

export const computeFunderDepositoryAddress = async (funderAddress: string, owner: string, root: string) => {
  //   console.log( "FunderDepository__factory.bytecode:", FunderDepository__factory.bytecode);

  //   const artifact = await artifacts.readArtifact("FunderDepository");
  //   console.log("artifact.bytecode:", artifact.bytecode);
  //   console.log("artifact.deployedBytecode:", artifact.deployedBytecode);

  const initcode = ethers.utils.solidityPack(
    ['bytes', 'bytes'],
    [FunderDepository__factory.bytecode, ethers.utils.defaultAbiCoder.encode(['address', 'bytes32'], [owner, root])]
  );

  return ethers.utils.getCreate2Address(funderAddress, ethers.constants.HashZero, ethers.utils.keccak256(initcode));
};

export const decodeRevertString = (returndata: string) => {
  // Refer to https://ethereum.stackexchange.com/a/83577

  // Skip the funciton selector from the returned encoded data
  // and only decode the revert reason string.
  // Function selector is 4 bytes long and that is why we skip
  // the first 2 bytes (0x) and the rest 8 bytes is the function selector
  // return ethers.utils.defaultAbiCoder.decode(['string'], `0x${callData.substring(2 + 4 * 2)}`)[0];
  const goDecode = goSync(
    () => ethers.utils.defaultAbiCoder.decode(['string'], `0x${returndata.substring(2 + 4 * 2)}`)[0]
  );
  if (!goDecode.success) return 'No revert string';

  return goDecode.data;
};
