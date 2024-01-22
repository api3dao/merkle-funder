import { ethers } from 'ethers';
import { generateRandomAddress, generateRandomBytes32 } from '../test/test-utils';
import { MerkleFunderDepository__factory } from './contracts';
import { computeMerkleFunderDepositoryAddress, decodeRevertString, estimateMulticallGasLimit } from './evm';

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

describe('estimateMulticallGasLimit', () => {
  let mockContract: any;

  beforeEach(() => {
    mockContract = {
      estimateGas: {
        multicall: jest.fn(),
      },
    };
  });

  it('should estimate gas limit successfully', async () => {
    const calldatas = ['0xabcdef', '0x123456'];
    const fallbackGasLimit = ethers.BigNumber.from(3_000_000);

    const estimatedGas = ethers.BigNumber.from(2500000);
    mockContract.estimateGas.multicall.mockResolvedValueOnce(estimatedGas);

    const result = await estimateMulticallGasLimit(mockContract, calldatas, fallbackGasLimit);

    expect(mockContract.estimateGas.multicall).toHaveBeenCalledWith(calldatas);

    const expectedGasLimit = estimatedGas
      .mul(ethers.BigNumber.from(Math.round(1.1 * 100)))
      .div(ethers.BigNumber.from(100));
    expect(result).toEqual(expectedGasLimit);
  });

  it('should fallback to provided gas limit if estimation fails', async () => {
    const calldatas = ['0xabcdef', '0x123456'];
    const fallbackGasLimit = ethers.BigNumber.from(3_000_000);

    mockContract.estimateGas.multicall.mockRejectedValueOnce(new Error('Estimation failed'));

    const result = await estimateMulticallGasLimit(mockContract, calldatas, fallbackGasLimit);

    expect(mockContract.estimateGas.multicall).toHaveBeenCalledWith(calldatas);

    expect(result).toEqual(fallbackGasLimit);
  });

  it('should throw an error if estimation fails and no fallbackGasLimit is provided', async () => {
    const calldatas = ['0xabcdef', '0x123456'];

    mockContract.estimateGas.multicall.mockRejectedValueOnce(new Error('Estimation failed'));

    await expect(estimateMulticallGasLimit(mockContract, calldatas, undefined)).rejects.toThrowError(
      'Unable to estimate gas limit'
    );
  });
});
