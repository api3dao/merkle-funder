const getGasPriceMock = jest.fn().mockResolvedValue([
  [{ message: 'mocked-get-gas-price-message' }],
  {
    type: 0,
    gasPrice: {
      type: 'BigNumber',
      hex: '0x02540be400',
    },
    gasLimit: {
      type: 'BigNumber',
      hex: '0x030d40',
    },
  },
]);

import { ethers } from 'ethers';
import { decodeRevertString } from './evm';
import { fundChainRecipients } from './merkle-funder';
import buildMerkleTree from './merkle-tree';
import { ChainOptions, MerkleFunderDepositories, NamedUnits } from './types';

jest.mock('@api3/airnode-utilities', () => ({
  getGasPrice: getGasPriceMock,
}));

jest.mock('./merkle-tree', () => ({
  __esModule: true,
  default: jest.fn(),
}));

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

    const encodeFunctionDataMock = jest
      .fn()
      .mockReturnValueOnce(staticMulticallCalldata[0])
      .mockReturnValueOnce(staticMulticallCalldata[1])
      .mockReturnValueOnce(staticMulticallCalldata[2]);

    const mockContractCallStaticTryMulticall = jest.fn().mockResolvedValueOnce({ successes, returndata });

    const mockContractTryMulticall = jest.fn().mockResolvedValueOnce(tryMulticallResult);

    const mockGetTransactionCount = jest.fn().mockImplementation(() => Promise.resolve(1));

    const mockContract = {
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

    // Capture console.log outputs
    const consoleLogSpy = jest.spyOn(console, 'log');

    await fundChainRecipients({ options, merkleFunderDepositories }, mockContract as unknown as ethers.Contract);

    expect(buildMerkleTree).toHaveBeenCalledTimes(1);
    expect(buildMerkleTree).toHaveBeenCalledWith(values);
    expect(consoleLogSpy).toHaveBeenCalledWith('Merkle tree:\n', 'mocked-merkle-tree-render');
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith('getBlockNumber()');
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith(
      'fund(address,bytes32,bytes32[],address,uint256,uint256)',
      [owner, treeRoot, proof1, values[0].recipient, ethers.utils.parseEther('10'), ethers.utils.parseEther('20')]
    );
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith(
      'fund(address,bytes32,bytes32[],address,uint256,uint256)',
      [owner, treeRoot, proof2, values[1].recipient, ethers.utils.parseEther('5'), ethers.utils.parseEther('15')]
    );
    const [, ...multicallCalldata] = staticMulticallCalldata;
    expect(consoleLogSpy).toHaveBeenCalledWith('Expected number of calldatas to be sent: ', multicallCalldata.length);
    expect(mockContractCallStaticTryMulticall).toHaveBeenCalledWith(staticMulticallCalldata);
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      `Failed to call merkleFunderContract.callStatic.tryMulticall:`,
      expect.any(String)
    );
    expect(consoleLogSpy).toHaveBeenCalledWith('Block number:', '10');
    expect(consoleLogSpy).not.toHaveBeenCalledWith('Failded to fetch block number:', expect.any(String));
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      `Calldata #${1} reverted with message:`,
      decodeRevertString(returndata[1])
    );
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      `Calldata #${2} reverted with message:`,
      decodeRevertString(returndata[2])
    );
    expect(mockGetTransactionCount).toHaveBeenCalledTimes(1);
    expect(getGasPriceMock).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith('mocked-get-gas-price-message');
    expect(mockContractTryMulticall).toHaveBeenCalledWith(multicallCalldata, expect.anything());
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      `Failed to call merkleFunderContract.tryMulticall:`,
      expect.any(String)
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Sent tx with hash ${tryMulticallResult.hash} that will send funds to ${multicallCalldata.length} recipients`
    );
    expect(consoleLogSpy).not.toHaveBeenCalledWith('All recipients are already funded');
  });

  it('should handle failed callStatic.tryMulticall', async () => {
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

    // Capture console.log outputs
    const consoleLogSpy = jest.spyOn(console, 'log');

    await fundChainRecipients({ options, merkleFunderDepositories }, mockContract as unknown as ethers.Contract);

    expect(buildMerkleTree).toHaveBeenCalledTimes(1);
    expect(buildMerkleTree).toHaveBeenCalledWith(values);
    expect(consoleLogSpy).toHaveBeenCalledWith('Merkle tree:\n', 'mocked-merkle-tree-render');
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith('getBlockNumber()');
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith(
      'fund(address,bytes32,bytes32[],address,uint256,uint256)',
      [owner, treeRoot, proof1, values[0].recipient, ethers.utils.parseEther('10'), ethers.utils.parseEther('20')]
    );
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith(
      'fund(address,bytes32,bytes32[],address,uint256,uint256)',
      [owner, treeRoot, proof2, values[1].recipient, ethers.utils.parseEther('5'), ethers.utils.parseEther('15')]
    );
    const [, ...multicallCalldata] = staticMulticallCalldata;
    expect(consoleLogSpy).toHaveBeenCalledWith('Expected number of calldatas to be sent: ', multicallCalldata.length);
    expect(mockContractCallStaticTryMulticall).toHaveBeenCalledWith(staticMulticallCalldata);
    expect(consoleLogSpy).toHaveBeenCalledWith('Block number:', '10');
    expect(consoleLogSpy).not.toHaveBeenCalledWith('Failded to fetch block number:', expect.any(String));
    expect(consoleLogSpy).toHaveBeenCalledWith(`Calldata #${1} reverted with message:`, 'mocked-revert-string');
    expect(mockGetTransactionCount).toHaveBeenCalledTimes(1);
    expect(getGasPriceMock).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith('mocked-get-gas-price-message');
    expect(mockContractTryMulticall).toHaveBeenCalledWith([staticMulticallCalldata[2]], expect.anything());
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      `Failed to call merkleFunderContract.tryMulticall:`,
      expect.any(String)
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Sent tx with hash ${tryMulticallResult.hash} that will send funds to 1 recipients`
    );
    expect(consoleLogSpy).not.toHaveBeenCalledWith('All recipients are already funded');
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

    // Capture console.log outputs
    const consoleLogSpy = jest.spyOn(console, 'log');

    await fundChainRecipients({ options, merkleFunderDepositories }, mockContract as unknown as ethers.Contract);

    expect(buildMerkleTree).toHaveBeenCalledTimes(1);
    expect(buildMerkleTree).toHaveBeenCalledWith(values);
    expect(consoleLogSpy).toHaveBeenCalledWith('Merkle tree:\n', 'mocked-merkle-tree-render');
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith(
      'fund(address,bytes32,bytes32[],address,uint256,uint256)',
      [owner, treeRoot, proof1, values[0].recipient, ethers.utils.parseEther('10'), ethers.utils.parseEther('20')]
    );
    const [, ...multicallCalldata] = staticMulticallCalldata;
    expect(consoleLogSpy).toHaveBeenCalledWith('Expected number of calldatas to be sent: ', multicallCalldata.length);
    expect(mockContractCallStaticTryMulticall).toHaveBeenCalledWith(staticMulticallCalldata);
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      `Failed to call merkleFunderContract.callStatic.tryMulticall:`,
      expect.any(String)
    );
    expect(mockGetTransactionCount).toHaveBeenCalledTimes(1);
    expect(getGasPriceMock).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith('mocked-get-gas-price-message');
    expect(mockContractTryMulticall).toHaveBeenCalledWith(multicallCalldata, expect.anything());
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Failed to call merkleFunderContract.tryMulticall:',
      'mocked-error-message'
    );
  });
});
