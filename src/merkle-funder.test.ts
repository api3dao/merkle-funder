import { ethers } from 'ethers';

const getGasPriceMock = jest.fn().mockResolvedValue([
  [{ message: 'mocked-get-gas-price-message' }],
  {
    type: 0,
    gasPrice: ethers.BigNumber.from(10_000_000_000),
    gasLimit: ethers.BigNumber.from(200_000),
  },
]);

import { LogOptions, logger } from '@api3/airnode-utilities';
import * as evmModule from './evm';
import { fundChainRecipients } from './merkle-funder';
import buildMerkleTree from './merkle-tree';
import { ChainOptions, MerkleFunderDepositories, NamedUnits } from './types';
import { generateRandomAddress } from '../test/test-utils';

jest.mock('@api3/airnode-utilities', () => ({
  getGasPrice: getGasPriceMock,
  logger: {
    info: (message: string) => console.log(message),
    error: (message: string) => console.error(message),
    debug: (message: string) => console.debug(message),
  },
}));

jest.mock('./merkle-tree', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const logOptions: LogOptions = {
  format: 'plain',
  level: 'INFO',
  meta: { 'CHAIN-ID': '31337', PROVIDER: 'provider1', DEPOSITORY: expect.any(String) },
};

describe('fundChainRecipients', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fund recipients', async () => {
    const owner = '0x123456789abcdef';
    const values = [
      {
        recipient: '0xrecipient1',
        lowThreshold: { value: 10, unit: 'ether' as NamedUnits },
        highThreshold: { value: 20, unit: 'ether' as NamedUnits },
      },
      {
        recipient: '0xrecipient2',
        lowThreshold: { value: 5, unit: 'ether' as NamedUnits },
        highThreshold: { value: 15, unit: 'ether' as NamedUnits },
      },
    ];
    const treeRoot = '0xmerkleroot';
    const proof1 = ['0xproof1'];
    const proof2 = ['0xproof2'];
    const staticMulticallCalldata = ['0xgetBlockNumberCalldata', '0xcalldata1', '0xcalldata2'];
    const successes = [true, true, true];
    const returndata = [
      ethers.utils.hexlify(10),
      ethers.utils.hexlify(ethers.utils.toUtf8Bytes('')),
      ethers.utils.hexlify(ethers.utils.toUtf8Bytes('')),
    ];
    const tryMulticallResult = {
      hash: '0xhash',
    };

    (buildMerkleTree as jest.Mock).mockImplementation(() => ({
      root: treeRoot,
      getProof: jest.fn().mockReturnValueOnce(proof1).mockReturnValueOnce(proof2),
      render: jest.fn().mockReturnValue('mocked-merkle-tree-render'),
    }));

    jest
      .spyOn(evmModule, 'computeMerkleFunderDepositoryAddress')
      .mockReturnValue(Promise.resolve(generateRandomAddress()));

    const encodeFunctionDataMock = jest
      .fn()
      .mockReturnValueOnce(staticMulticallCalldata[0])
      .mockReturnValueOnce(staticMulticallCalldata[1])
      .mockReturnValueOnce(staticMulticallCalldata[2]);

    const mockContractCallStaticTryMulticall = jest.fn().mockResolvedValueOnce({ successes, returndata });

    const mockContractTryMulticall = jest.fn().mockResolvedValueOnce(tryMulticallResult);

    const mockGetTransactionCount = jest.fn().mockImplementation(() => Promise.resolve(1));

    const mockContract = {
      address: '0x04d2B3DdCdb2790571Ca01F4768e3cC98FCb0D2B',
      interface: {
        encodeFunctionData: encodeFunctionDataMock,
      },
      callStatic: {
        tryMulticall: mockContractCallStaticTryMulticall,
      },
      tryMulticall: mockContractTryMulticall,
      signer: { getTransactionCount: mockGetTransactionCount },
    };

    const options: ChainOptions = {
      gasPriceOracle: [
        {
          gasPriceStrategy: 'providerRecommendedGasPrice',
          recommendedGasPriceMultiplier: 1.2,
        },
        {
          gasPriceStrategy: 'constantGasPrice',
          gasPrice: {
            value: 10,
            unit: 'gwei',
          },
        },
      ],
      fulfillmentGasLimit: 200000,
    };

    const merkleFunderDepositories: MerkleFunderDepositories = [
      {
        owner,
        values,
      },
    ];

    // Capture console outputs
    const loggerInfoSpy = jest.spyOn(logger, 'info');
    const loggerErrorSpy = jest.spyOn(logger, 'error');

    await fundChainRecipients('31337', { options, merkleFunderDepositories }, mockContract as any, logOptions);

    expect(buildMerkleTree).toHaveBeenCalledTimes(1);
    expect(buildMerkleTree).toHaveBeenCalledWith(values);
    expect(loggerInfoSpy).toHaveBeenCalledWith('Processing 1 merkleFunderDepositories...', logOptions);
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith('getBlockNumber');
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith('fund', [
      owner,
      treeRoot,
      proof1,
      values[0].recipient,
      ethers.utils.parseEther('10'),
      ethers.utils.parseEther('20'),
    ]);
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith('fund', [
      owner,
      treeRoot,
      proof2,
      values[1].recipient,
      ethers.utils.parseEther('5'),
      ethers.utils.parseEther('15'),
    ]);
    const [, ...multicallCalldata] = staticMulticallCalldata;
    expect(mockContractCallStaticTryMulticall).toHaveBeenCalledWith(staticMulticallCalldata);
    expect(loggerErrorSpy).not.toHaveBeenCalledWith(
      'Failed to call merkleFunderContract.callStatic.tryMulticall:',
      expect.any(String),
      expect.any(Error),
      logOptions
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      'Block number fetched while testing funding of recipients: 10',
      logOptions
    );
    expect(loggerInfoSpy).not.toHaveBeenCalledWith('Failded to fetch block number:', expect.any(String), logOptions);
    expect(loggerInfoSpy).toHaveBeenCalledWith('Funding test of 0xrecipient1 succeeded', logOptions);
    expect(loggerInfoSpy).toHaveBeenCalledWith('Funding test of 0xrecipient2 succeeded', logOptions);
    expect(loggerInfoSpy).not.toHaveBeenCalledWith(
      'Funding test of 0xrecipient1 reverted with message:',
      evmModule.decodeRevertString(returndata[1]),
      logOptions
    );
    expect(loggerInfoSpy).not.toHaveBeenCalledWith(
      'Funding test of 0xrecipient2 reverted with message:',
      evmModule.decodeRevertString(returndata[2]),
      logOptions
    );
    expect(mockGetTransactionCount).toHaveBeenCalledTimes(1);
    expect(getGasPriceMock).toHaveBeenCalledTimes(1);
    expect(loggerInfoSpy).toHaveBeenCalledWith('mocked-get-gas-price-message');
    expect(mockContractTryMulticall).toHaveBeenCalledWith(multicallCalldata, expect.anything());
    expect(loggerErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Failed to call merkleFunderContract.tryMulticall:'),
      expect.any(Error),
      logOptions
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Sent tx with hash ${tryMulticallResult.hash}`, logOptions);
  });

  it('should handle failed callStatic.tryMulticall and log out the parsed custom error name', async () => {
    const owner = '0x123456789abcdef';
    const values = [
      {
        recipient: '0xrecipient1',
        lowThreshold: { value: 10, unit: 'ether' as NamedUnits },
        highThreshold: { value: 20, unit: 'ether' as NamedUnits },
      },
      {
        recipient: '0xrecipient2',
        lowThreshold: { value: 5, unit: 'ether' as NamedUnits },
        highThreshold: { value: 15, unit: 'ether' as NamedUnits },
      },
    ];
    const treeRoot = '0xmerkleroot';
    const proof1 = ['0xproof1'];
    const proof2 = ['0xproof2'];
    const staticMulticallCalldata = ['0xgetBlockNumberCalldata', '0xcalldata1', '0xcalldata2'];
    const successes = [true, false, true];
    const functionSelector = '0x08c379a0';
    const returndata = [
      ethers.utils.hexlify(10),
      functionSelector.concat(ethers.utils.defaultAbiCoder.encode(['string'], ['mocked-revert-string']).substring(2)),
      ethers.utils.hexlify(ethers.utils.toUtf8Bytes('')),
    ];
    const tryMulticallResult = {
      hash: '0xhash',
    };

    (buildMerkleTree as jest.Mock).mockReturnValueOnce({
      root: treeRoot,
      getProof: jest.fn().mockReturnValueOnce(proof1).mockReturnValueOnce(proof2),
      render: jest.fn().mockReturnValue('mocked-merkle-tree-render'),
    });

    const encodeFunctionDataMock = jest
      .fn()
      .mockReturnValueOnce(staticMulticallCalldata[0])
      .mockReturnValueOnce(staticMulticallCalldata[1])
      .mockReturnValueOnce(staticMulticallCalldata[2]);

    const mockContractCallStaticTryMulticall = jest.fn().mockResolvedValueOnce({
      successes,
      returndata,
    });

    const mockContractTryMulticall = jest.fn().mockResolvedValueOnce(tryMulticallResult);

    const mockGetTransactionCount = jest.fn().mockImplementation(() => Promise.resolve(1));

    const mockContract = {
      address: '0x04d2B3DdCdb2790571Ca01F4768e3cC98FCb0D2B',
      interface: {
        encodeFunctionData: encodeFunctionDataMock,
        parseError: () => ({ name: 'CustomError' }),
      },
      callStatic: {
        tryMulticall: mockContractCallStaticTryMulticall,
      },
      tryMulticall: mockContractTryMulticall,
      signer: { getTransactionCount: mockGetTransactionCount },
    };

    const options: ChainOptions = {
      gasPriceOracle: [
        {
          gasPriceStrategy: 'providerRecommendedGasPrice',
          recommendedGasPriceMultiplier: 1.2,
        },
        {
          gasPriceStrategy: 'constantGasPrice',
          gasPrice: {
            value: 10,
            unit: 'gwei',
          },
        },
      ],
      fulfillmentGasLimit: 200000,
    };

    const merkleFunderDepositories: MerkleFunderDepositories = [
      {
        owner,
        values,
      },
    ];

    // Capture console outputs
    const loggerInfoSpy = jest.spyOn(logger, 'info');
    const loggerErrorSpy = jest.spyOn(logger, 'error');

    await fundChainRecipients('31337', { options, merkleFunderDepositories }, mockContract as any, logOptions);

    expect(buildMerkleTree).toHaveBeenCalledTimes(1);
    expect(buildMerkleTree).toHaveBeenCalledWith(values);
    expect(loggerInfoSpy).toHaveBeenCalledWith('Processing 1 merkleFunderDepositories...', logOptions);
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith('getBlockNumber');
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith('fund', [
      owner,
      treeRoot,
      proof1,
      values[0].recipient,
      ethers.utils.parseEther('10'),
      ethers.utils.parseEther('20'),
    ]);
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith('fund', [
      owner,
      treeRoot,
      proof2,
      values[1].recipient,
      ethers.utils.parseEther('5'),
      ethers.utils.parseEther('15'),
    ]);
    expect(mockContractCallStaticTryMulticall).toHaveBeenCalledWith(staticMulticallCalldata);
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      'Block number fetched while testing funding of recipients: 10',
      logOptions
    );
    expect(loggerErrorSpy).not.toHaveBeenCalledWith(
      'Failded to fetch block number:',
      expect.any(String),
      expect.any(Error),
      logOptions
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      'Funding test of 0xrecipient1 reverted with message: CustomError',
      logOptions
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith('Funding test of 0xrecipient2 succeeded', logOptions);
    expect(mockGetTransactionCount).toHaveBeenCalledTimes(1);
    expect(getGasPriceMock).toHaveBeenCalledTimes(1);
    expect(loggerInfoSpy).toHaveBeenCalledWith('mocked-get-gas-price-message');
    expect(mockContractTryMulticall).toHaveBeenCalledWith([staticMulticallCalldata[2]], expect.anything());
    expect(loggerErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Failed to call merkleFunderContract.tryMulticall:'),
      expect.any(Error),
      logOptions
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Sent tx with hash ${tryMulticallResult.hash}`, logOptions);
  });

  it('should handle failed callStatic.tryMulticall and log out the decoded revert string', async () => {
    const owner = '0x123456789abcdef';
    const values = [
      {
        recipient: '0xrecipient1',
        lowThreshold: { value: 10, unit: 'ether' as NamedUnits },
        highThreshold: { value: 20, unit: 'ether' as NamedUnits },
      },
      {
        recipient: '0xrecipient2',
        lowThreshold: { value: 5, unit: 'ether' as NamedUnits },
        highThreshold: { value: 15, unit: 'ether' as NamedUnits },
      },
    ];
    const treeRoot = '0xmerkleroot';
    const proof1 = ['0xproof1'];
    const proof2 = ['0xproof2'];
    const staticMulticallCalldata = ['0xgetBlockNumberCalldata', '0xcalldata1', '0xcalldata2'];
    const successes = [true, false, true];
    const functionSelector = '0x08c379a0';
    const returndata = [
      ethers.utils.hexlify(10),
      functionSelector.concat(ethers.utils.defaultAbiCoder.encode(['string'], ['mocked-revert-string']).substring(2)),
      ethers.utils.hexlify(ethers.utils.toUtf8Bytes('')),
    ];
    const tryMulticallResult = {
      hash: '0xhash',
    };

    (buildMerkleTree as jest.Mock).mockReturnValueOnce({
      root: treeRoot,
      getProof: jest.fn().mockReturnValueOnce(proof1).mockReturnValueOnce(proof2),
      render: jest.fn().mockReturnValue('mocked-merkle-tree-render'),
    });

    const encodeFunctionDataMock = jest
      .fn()
      .mockReturnValueOnce(staticMulticallCalldata[0])
      .mockReturnValueOnce(staticMulticallCalldata[1])
      .mockReturnValueOnce(staticMulticallCalldata[2]);

    const mockContractCallStaticTryMulticall = jest.fn().mockResolvedValueOnce({
      successes,
      returndata,
    });

    const mockContractTryMulticall = jest.fn().mockResolvedValueOnce(tryMulticallResult);

    const mockGetTransactionCount = jest.fn().mockImplementation(() => Promise.resolve(1));

    const mockContract = {
      interface: {
        encodeFunctionData: encodeFunctionDataMock,
        parseError: () => null,
      },
      callStatic: {
        tryMulticall: mockContractCallStaticTryMulticall,
      },
      tryMulticall: mockContractTryMulticall,
      signer: { getTransactionCount: mockGetTransactionCount },
    };

    const options: ChainOptions = {
      gasPriceOracle: [
        {
          gasPriceStrategy: 'providerRecommendedGasPrice',
          recommendedGasPriceMultiplier: 1.2,
        },
        {
          gasPriceStrategy: 'constantGasPrice',
          gasPrice: {
            value: 10,
            unit: 'gwei',
          },
        },
      ],
      fulfillmentGasLimit: 200000,
    };

    const merkleFunderDepositories: MerkleFunderDepositories = [
      {
        owner,
        values,
      },
    ];

    // Capture console outputs
    const loggerInfoSpy = jest.spyOn(logger, 'info');
    const loggerErrorSpy = jest.spyOn(logger, 'error');

    await fundChainRecipients('31337', { options, merkleFunderDepositories }, mockContract as any, logOptions);

    expect(buildMerkleTree).toHaveBeenCalledTimes(1);
    expect(buildMerkleTree).toHaveBeenCalledWith(values);
    expect(loggerInfoSpy).toHaveBeenCalledWith('Processing 1 merkleFunderDepositories...', logOptions);
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith('getBlockNumber');
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith('fund', [
      owner,
      treeRoot,
      proof1,
      values[0].recipient,
      ethers.utils.parseEther('10'),
      ethers.utils.parseEther('20'),
    ]);
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith('fund', [
      owner,
      treeRoot,
      proof2,
      values[1].recipient,
      ethers.utils.parseEther('5'),
      ethers.utils.parseEther('15'),
    ]);
    expect(mockContractCallStaticTryMulticall).toHaveBeenCalledWith(staticMulticallCalldata);
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      'Block number fetched while testing funding of recipients: 10',
      logOptions
    );
    expect(loggerErrorSpy).not.toHaveBeenCalledWith(
      'Failded to fetch block number:',
      expect.any(String),
      expect.any(Error),
      logOptions
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      'Funding test of 0xrecipient1 reverted with message: mocked-revert-string',
      logOptions
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith('Funding test of 0xrecipient2 succeeded', logOptions);
    expect(mockGetTransactionCount).toHaveBeenCalledTimes(1);
    expect(getGasPriceMock).toHaveBeenCalledTimes(1);
    expect(loggerInfoSpy).toHaveBeenCalledWith('mocked-get-gas-price-message');
    expect(mockContractTryMulticall).toHaveBeenCalledWith([staticMulticallCalldata[2]], expect.anything());
    expect(loggerErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Failed to call merkleFunderContract.tryMulticall:'),
      expect.any(Error),
      logOptions
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Sent tx with hash ${tryMulticallResult.hash}`, logOptions);
  });

  it('should handle failed tryMulticall', async () => {
    const owner = '0x123456789abcdef';
    const values = [
      {
        recipient: '0xrecipient1',
        lowThreshold: { value: 10, unit: 'ether' as NamedUnits },
        highThreshold: { value: 20, unit: 'ether' as NamedUnits },
      },
    ];
    const treeRoot = '0xmerkleroot';
    const proof1 = ['0xproof1'];
    const staticMulticallCalldata = ['0xgetBlockNumberCalldata', '0xcalldata'];
    const successes = [true, true];
    const returndata = [ethers.utils.hexlify(10), ethers.utils.hexlify(ethers.utils.toUtf8Bytes(''))];

    (buildMerkleTree as jest.Mock).mockReturnValueOnce({
      root: treeRoot,
      getProof: jest.fn().mockReturnValueOnce(proof1),
      render: jest.fn().mockReturnValue('mocked-merkle-tree-render'),
    });

    const encodeFunctionDataMock = jest
      .fn()
      .mockReturnValueOnce(staticMulticallCalldata[0])
      .mockReturnValueOnce(staticMulticallCalldata[1]);

    const mockContractCallStaticTryMulticall = jest.fn().mockResolvedValueOnce({
      successes,
      returndata,
    });

    const mockContractTryMulticall = jest.fn().mockRejectedValue('mocked-error-message');

    const mockGetTransactionCount = jest.fn().mockImplementation(() => Promise.resolve(1));

    const mockContract = {
      address: '0x04d2B3DdCdb2790571Ca01F4768e3cC98FCb0D2B',
      interface: {
        encodeFunctionData: encodeFunctionDataMock,
      },
      callStatic: {
        tryMulticall: mockContractCallStaticTryMulticall,
      },
      tryMulticall: mockContractTryMulticall,
      signer: { getTransactionCount: mockGetTransactionCount },
    };

    const options: ChainOptions = {
      gasPriceOracle: [
        {
          gasPriceStrategy: 'providerRecommendedGasPrice',
          recommendedGasPriceMultiplier: 1.2,
        },
        {
          gasPriceStrategy: 'constantGasPrice',
          gasPrice: {
            value: 10,
            unit: 'gwei',
          },
        },
      ],
      fulfillmentGasLimit: 200000,
    };

    const merkleFunderDepositories: MerkleFunderDepositories = [
      {
        owner,
        values,
      },
    ];

    // Capture console outputs
    const loggerInfoSpy = jest.spyOn(logger, 'info');
    const loggerErrorSpy = jest.spyOn(logger, 'error');

    await fundChainRecipients('31337', { options, merkleFunderDepositories }, mockContract as any, logOptions);

    expect(buildMerkleTree).toHaveBeenCalledTimes(1);
    expect(buildMerkleTree).toHaveBeenCalledWith(values);
    expect(loggerInfoSpy).toHaveBeenCalledWith('Processing 1 merkleFunderDepositories...', logOptions);
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith('fund', [
      owner,
      treeRoot,
      proof1,
      values[0].recipient,
      ethers.utils.parseEther('10'),
      ethers.utils.parseEther('20'),
    ]);
    const [, ...multicallCalldata] = staticMulticallCalldata;
    expect(loggerInfoSpy).toHaveBeenCalledWith('Funding test of 0xrecipient1 succeeded', logOptions);
    expect(mockContractCallStaticTryMulticall).toHaveBeenCalledWith(staticMulticallCalldata);
    expect(loggerInfoSpy).not.toHaveBeenCalledWith(
      `Failed to call merkleFunderContract.callStatic.tryMulticall:`,
      expect.any(String),
      logOptions
    );
    expect(mockGetTransactionCount).toHaveBeenCalledTimes(1);
    expect(getGasPriceMock).toHaveBeenCalledTimes(1);
    expect(loggerInfoSpy).toHaveBeenCalledWith('mocked-get-gas-price-message');
    expect(mockContractTryMulticall).toHaveBeenCalledWith(multicallCalldata, expect.anything());
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Failed to call merkleFunderContract.tryMulticall: mocked-error-message',
      expect.any(Error),
      logOptions
    );
  });
});
