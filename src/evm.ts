import { go, goSync } from '@api3/promise-utils';
import { ethers } from 'ethers';
import { MerkleFunderDepository__factory } from './contracts';
import { SelfMulticall } from '@api3/airnode-protocol-v1';

export const computeMerkleFunderDepositoryAddress = async (
  merkleFunderAddress: string,
  owner: string,
  root: string
) => {
  const initcode = ethers.utils.solidityPack(
    ['bytes', 'bytes'],
    [
      MerkleFunderDepository__factory.bytecode,
      ethers.utils.defaultAbiCoder.encode(['address', 'bytes32'], [owner, root]),
    ]
  );

  return ethers.utils.getCreate2Address(
    merkleFunderAddress,
    ethers.constants.HashZero,
    ethers.utils.keccak256(initcode)
  );
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

  if (!goDecode.success) {
    return 'No revert string';
  }

  return goDecode.data;
};

export const estimateMulticallGasLimit = async (
  contract: SelfMulticall,
  calldatas: string[],
  fallbackGasLimit: ethers.BigNumber | undefined
) => {
  const goEstimateGas = await go(async () => contract.estimateGas.multicall(calldatas));
  if (goEstimateGas.success) {
    // Adding a extra 10% because multicall consumes less gas than tryMulticall
    return goEstimateGas.data.mul(ethers.BigNumber.from(Math.round(1.1 * 100))).div(ethers.BigNumber.from(100));
  }

  return fallbackGasLimit ?? ethers.BigNumber.from(2_000_000);
};
