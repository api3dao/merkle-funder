import { ethers } from 'ethers';
import { computeMerkleFunderDepositoryAddress, decodeRevertString } from '.';
import { generateRandomAddress, generateRandomBytes32 } from '../test/test-utils';
import { MerkleFunderDepository__factory } from '../typechain-types';

describe('computeMerkleFunderDepositoryAddress', () => {
  it('should compute the correct MerkleFunderDepository address', async () => {
    const merkleFunderAddress = generateRandomAddress();
    const owner = generateRandomAddress();
    const root = generateRandomBytes32();

    const expectedAddress = ethers.utils.getCreate2Address(
      merkleFunderAddress,
      ethers.constants.HashZero,
      ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ['bytes', 'bytes'],
          [
            MerkleFunderDepository__factory.bytecode,
            ethers.utils.defaultAbiCoder.encode(['address', 'bytes32'], [owner, root]),
          ]
        )
      )
    );

    const result = await computeMerkleFunderDepositoryAddress(merkleFunderAddress, owner, root);
    expect(result).toEqual(expectedAddress);
  });
});

describe('decodeRevertString', () => {
  it('should decode the revert string from the returndata', () => {
    const returndata =
      '0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000156d6f636b65642d7265766572742d6d6573736167650000000000000000000000';

    const expectedRevertString = 'mocked-revert-message';

    const result = decodeRevertString(returndata);
    expect(result).toEqual(expectedRevertString);
  });

  it('should return "No revert string" when the returndata is invalid', () => {
    const returndata = '0xInvalidData';

    const expectedRevertString = 'No revert string';

    const result = decodeRevertString(returndata);
    expect(result).toEqual(expectedRevertString);
  });
});
