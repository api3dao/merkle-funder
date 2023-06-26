import { ethers } from 'ethers';
import { fundChainRecipients } from './merkle-funder';
import { MerkleFunderDepositories, NamedUnits, decodeRevertString } from '.';
import buildMerkleTree from './merkle-tree';

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
    const multicallCalldata = ['0xcalldata1', '0xcalldata2'];
    const successes = [true, true];
    const returndata = [
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
      .mockReturnValueOnce(multicallCalldata[0])
      .mockReturnValueOnce(multicallCalldata[1]);

    const mockContractCallStaticTryMulticall = jest.fn().mockResolvedValueOnce({ successes, returndata });

    const mockContractTryMulticall = jest.fn().mockResolvedValueOnce(tryMulticallResult);

    const mockContract = {
      interface: {
        encodeFunctionData: encodeFunctionDataMock,
      },
      callStatic: {
        tryMulticall: mockContractCallStaticTryMulticall,
      },
      tryMulticall: mockContractTryMulticall,
    };

    const chainMerkleFunderDepositories: MerkleFunderDepositories = [
      {
        owner,
        values,
      },
    ];

    // Capture console.log outputs
    const consoleLogSpy = jest.spyOn(console, 'log');

    await fundChainRecipients(chainMerkleFunderDepositories, mockContract as unknown as ethers.Contract);

    expect(buildMerkleTree).toHaveBeenCalledTimes(1);
    expect(buildMerkleTree).toHaveBeenCalledWith(values);
    expect(consoleLogSpy).toHaveBeenCalledWith('Merkle tree:\n', 'mocked-merkle-tree-render');

    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith(
      'fund(address,bytes32,bytes32[],address,uint256,uint256)',
      [owner, treeRoot, proof1, values[0].recipient, ethers.utils.parseEther('10'), ethers.utils.parseEther('20')]
    );
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith(
      'fund(address,bytes32,bytes32[],address,uint256,uint256)',
      [owner, treeRoot, proof2, values[1].recipient, ethers.utils.parseEther('5'), ethers.utils.parseEther('15')]
    );
    expect(consoleLogSpy).toHaveBeenCalledWith('Number of calldatas to be sent: ', multicallCalldata.length);

    expect(mockContractCallStaticTryMulticall).toHaveBeenCalledWith(multicallCalldata);
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      `Failed to call merkleFunderContract.callStatic.tryMulticall:`,
      expect.any(String)
    );
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      `Calldata #${1} reverted with message:`,
      decodeRevertString(returndata[0])
    );
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      `Calldata #${2} reverted with message:`,
      decodeRevertString(returndata[1])
    );

    expect(mockContractTryMulticall).toHaveBeenCalledWith(multicallCalldata);
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      `Failed to call merkleFunderContract.tryMulticall:`,
      expect.any(String)
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Sent tx with hash ${tryMulticallResult.hash} that will send funds to ${successes.length} recipients`
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
    const multicallCalldata = ['0xcalldata1', '0xcalldata2'];
    const successes = [false, true];
    const functionSelector = '0x08c379a0';
    const returndata = [
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
      .mockReturnValueOnce(multicallCalldata[0])
      .mockReturnValueOnce(multicallCalldata[1]);

    const mockContractCallStaticTryMulticall = jest.fn().mockResolvedValueOnce({
      successes,
      returndata,
    });

    const mockContractTryMulticall = jest.fn().mockResolvedValueOnce(tryMulticallResult);

    const mockContract = {
      interface: {
        encodeFunctionData: encodeFunctionDataMock,
      },
      callStatic: {
        tryMulticall: mockContractCallStaticTryMulticall,
      },
      tryMulticall: mockContractTryMulticall,
    };

    const chainMerkleFunderDepositories: MerkleFunderDepositories = [
      {
        owner,
        values,
      },
    ];

    // Capture console.log outputs
    const consoleLogSpy = jest.spyOn(console, 'log');

    await fundChainRecipients(chainMerkleFunderDepositories, mockContract as unknown as ethers.Contract);

    expect(buildMerkleTree).toHaveBeenCalledTimes(1);
    expect(buildMerkleTree).toHaveBeenCalledWith(values);
    expect(consoleLogSpy).toHaveBeenCalledWith('Merkle tree:\n', 'mocked-merkle-tree-render');
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith(
      'fund(address,bytes32,bytes32[],address,uint256,uint256)',
      [owner, treeRoot, proof1, values[0].recipient, ethers.utils.parseEther('10'), ethers.utils.parseEther('20')]
    );
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith(
      'fund(address,bytes32,bytes32[],address,uint256,uint256)',
      [owner, treeRoot, proof2, values[1].recipient, ethers.utils.parseEther('5'), ethers.utils.parseEther('15')]
    );
    expect(consoleLogSpy).toHaveBeenCalledWith('Number of calldatas to be sent: ', multicallCalldata.length);
    expect(mockContractCallStaticTryMulticall).toHaveBeenCalledWith(multicallCalldata);
    expect(consoleLogSpy).toHaveBeenCalledWith(`Calldata #${1} reverted with message:`, 'mocked-revert-string');
    expect(mockContractTryMulticall).toHaveBeenCalledWith([multicallCalldata[1]]);
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
    const multicallCalldata = ['0xcalldata1'];
    const successes = [true];
    const returndata = [ethers.utils.hexlify(ethers.utils.toUtf8Bytes(''))];

    (buildMerkleTree as jest.Mock).mockReturnValueOnce({
      root: treeRoot,
      getProof: jest.fn().mockReturnValueOnce(proof1),
      render: jest.fn().mockReturnValue('mocked-merkle-tree-render'),
    });

    const encodeFunctionDataMock = jest.fn().mockReturnValueOnce(multicallCalldata[0]);

    const mockContractCallStaticTryMulticall = jest.fn().mockResolvedValueOnce({
      successes,
      returndata,
    });

    const mockContractTryMulticall = jest.fn().mockRejectedValue('mocked-error-message');

    const mockContract = {
      interface: {
        encodeFunctionData: encodeFunctionDataMock,
      },
      callStatic: {
        tryMulticall: mockContractCallStaticTryMulticall,
      },
      tryMulticall: mockContractTryMulticall,
    };

    const chainMerkleFunderDepositories: MerkleFunderDepositories = [
      {
        owner,
        values,
      },
    ];

    // Capture console.log outputs
    const consoleLogSpy = jest.spyOn(console, 'log');

    await fundChainRecipients(chainMerkleFunderDepositories, mockContract as unknown as ethers.Contract);

    expect(buildMerkleTree).toHaveBeenCalledTimes(1);
    expect(buildMerkleTree).toHaveBeenCalledWith(values);
    expect(consoleLogSpy).toHaveBeenCalledWith('Merkle tree:\n', 'mocked-merkle-tree-render');
    expect(mockContract.interface.encodeFunctionData).toHaveBeenCalledWith(
      'fund(address,bytes32,bytes32[],address,uint256,uint256)',
      [owner, treeRoot, proof1, values[0].recipient, ethers.utils.parseEther('10'), ethers.utils.parseEther('20')]
    );
    expect(consoleLogSpy).toHaveBeenCalledWith('Number of calldatas to be sent: ', multicallCalldata.length);
    expect(mockContractCallStaticTryMulticall).toHaveBeenCalledWith(multicallCalldata);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Failed to call merkleFunderContract.tryMulticall:',
      'mocked-error-message'
    );
  });
});
