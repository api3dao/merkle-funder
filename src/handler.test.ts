import { Callback, Context, ScheduledEvent } from 'aws-lambda';
import { ethers } from 'ethers';
import fs, { Dirent, PathOrFileDescriptor } from 'fs';
import { run } from './handler';
import { fundChainRecipients } from './merkle-funder';

jest.mock('./merkle-funder', () => ({
  fundChainRecipients: jest.fn(),
}));

const mockConfig = {
  31337: {
    funderMnemonic: 'test test test test test test test test test test test junk',
    providers: {
      provider1: {
        url: 'http://provider1.com',
      },
      provider2: {
        url: 'http://provider2.com',
      },
    },
  },
};
jest.mock('./config', () => ({
  __esModule: true,
  default: jest.fn(() => mockConfig),
}));

describe('run', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call fundChainRecipients for each provider in the config', async () => {
    const merkleFunderContractAddress = '0x8ad9E9D79dE3a51f8132516C36C31AB6fe5bc1D0';
    const merkleFunderAbi = [
      {
        inputs: [],
        name: 'AmountZero',
        type: 'error',
      },
      {
        inputs: [],
        name: 'HighThresholdZero',
        type: 'error',
      },
      {
        inputs: [],
        name: 'InsufficientBalance',
        type: 'error',
      },
      {
        inputs: [],
        name: 'InvalidProof',
        type: 'error',
      },
      {
        inputs: [],
        name: 'LowThresholdHigherThanHigh',
        type: 'error',
      },
      {
        inputs: [],
        name: 'NoSuchMerkleFunderDepository',
        type: 'error',
      },
      {
        inputs: [],
        name: 'RecipientAddressZero',
        type: 'error',
      },
      {
        inputs: [],
        name: 'RecipientBalanceLargerThanLowThreshold',
        type: 'error',
      },
      {
        inputs: [],
        name: 'RootZero',
        type: 'error',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'merkleFunderDepository',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'bytes32',
            name: 'root',
            type: 'bytes32',
          },
        ],
        name: 'DeployedMerkleFunderDepository',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'merkleFunderDepository',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'address',
            name: 'recipient',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'Funded',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'merkleFunderDepository',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'address',
            name: 'recipient',
            type: 'address',
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'Withdrew',
        type: 'event',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            internalType: 'bytes32',
            name: 'root',
            type: 'bytes32',
          },
        ],
        name: 'computeMerkleFunderDepositoryAddress',
        outputs: [
          {
            internalType: 'address',
            name: 'merkleFunderDepository',
            type: 'address',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            internalType: 'bytes32',
            name: 'root',
            type: 'bytes32',
          },
        ],
        name: 'deployMerkleFunderDepository',
        outputs: [
          {
            internalType: 'address payable',
            name: 'merkleFunderDepository',
            type: 'address',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            internalType: 'bytes32',
            name: 'root',
            type: 'bytes32',
          },
          {
            internalType: 'bytes32[]',
            name: 'proof',
            type: 'bytes32[]',
          },
          {
            internalType: 'address',
            name: 'recipient',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'lowThreshold',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'highThreshold',
            type: 'uint256',
          },
        ],
        name: 'fund',
        outputs: [
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'bytes[]',
            name: 'data',
            type: 'bytes[]',
          },
        ],
        name: 'multicall',
        outputs: [
          {
            internalType: 'bytes[]',
            name: 'returndata',
            type: 'bytes[]',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'address',
            name: '',
            type: 'address',
          },
          {
            internalType: 'bytes32',
            name: '',
            type: 'bytes32',
          },
        ],
        name: 'ownerToRootToMerkleFunderDepositoryAddress',
        outputs: [
          {
            internalType: 'address payable',
            name: '',
            type: 'address',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'bytes[]',
            name: 'data',
            type: 'bytes[]',
          },
        ],
        name: 'tryMulticall',
        outputs: [
          {
            internalType: 'bool[]',
            name: 'successes',
            type: 'bool[]',
          },
          {
            internalType: 'bytes[]',
            name: 'returndata',
            type: 'bytes[]',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'bytes32',
            name: 'root',
            type: 'bytes32',
          },
          {
            internalType: 'address',
            name: 'recipient',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'withdraw',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          {
            internalType: 'bytes32',
            name: 'root',
            type: 'bytes32',
          },
          {
            internalType: 'address',
            name: 'recipient',
            type: 'address',
          },
        ],
        name: 'withdrawAll',
        outputs: [
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ];
    const signerAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readdirSync').mockReturnValue([{ name: 'localhost', isDirectory: () => true }] as Dirent[]);
    jest.spyOn(fs, 'readFileSync').mockImplementation((path: PathOrFileDescriptor) => {
      if (path.toString().endsWith('.chainId')) {
        return '31337';
      }
      if (path.toString().endsWith('MerkleFunder.json')) {
        return JSON.stringify({ address: merkleFunderContractAddress, abi: merkleFunderAbi });
      }
      return '';
    });

    await run(null as unknown as ScheduledEvent, null as unknown as Context, null as unknown as Callback<void>);

    expect(fundChainRecipients).toHaveBeenCalledTimes(2);
    expect(fundChainRecipients).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        address: merkleFunderContractAddress,
        signer: expect.objectContaining({
          address: signerAddress,
          provider: expect.objectContaining({ connection: expect.objectContaining({ url: 'http://provider1.com' }) }),
        }),
        interface: expect.objectContaining(new ethers.utils.Interface(merkleFunderAbi)),
      })
    );
    expect(fundChainRecipients).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        address: merkleFunderContractAddress,
        signer: expect.objectContaining({
          address: signerAddress,
          provider: expect.objectContaining({ connection: expect.objectContaining({ url: 'http://provider2.com' }) }),
        }),
        interface: expect.objectContaining(new ethers.utils.Interface(merkleFunderAbi)),
      })
    );
  });
});
