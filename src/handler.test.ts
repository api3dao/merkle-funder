import { Callback, Context, ScheduledEvent } from 'aws-lambda';
import { ethers } from 'ethers';
import { MerkleFunder__factory } from './contracts';
import { run } from './handler';
import { fundChainRecipients } from './merkle-funder';

jest.mock('./merkle-funder', () => ({
  fundChainRecipients: jest.fn(),
}));

jest.mock('../deployments/references.json', () => ({
  MerkleFunder: {
    '31337': '0x04d2B3DdCdb2790571Ca01F4768e3cC98FCb0D2B',
  },
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
  loadConfig: jest.fn(() => mockConfig),
}));

describe('run', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call fundChainRecipients for each provider in the config', async () => {
    const merkleFunderContractAddress = '0x04d2B3DdCdb2790571Ca01F4768e3cC98FCb0D2B';
    const signerAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

    await run(null as unknown as ScheduledEvent, null as unknown as Context, null as unknown as Callback<void>);

    expect(fundChainRecipients).toHaveBeenCalledTimes(2);
    expect(fundChainRecipients).toHaveBeenNthCalledWith(
      1,
      '31337',
      expect.anything(),
      expect.objectContaining({
        address: merkleFunderContractAddress,
        signer: expect.objectContaining({
          address: signerAddress,
          provider: expect.objectContaining({ connection: expect.objectContaining({ url: 'http://provider1.com' }) }),
        }),
        interface: expect.objectContaining(new ethers.utils.Interface(MerkleFunder__factory.abi)),
      }),
      expect.objectContaining({ format: 'plain', level: 'INFO', meta: { 'CHAIN-ID': '31337', PROVIDER: 'provider1' } })
    );
    expect(fundChainRecipients).toHaveBeenNthCalledWith(
      2,
      '31337',
      expect.anything(),
      expect.objectContaining({
        address: merkleFunderContractAddress,
        signer: expect.objectContaining({
          address: signerAddress,
          provider: expect.objectContaining({ connection: expect.objectContaining({ url: 'http://provider2.com' }) }),
        }),
        interface: expect.objectContaining(new ethers.utils.Interface(MerkleFunder__factory.abi)),
      }),
      expect.objectContaining({ format: 'plain', level: 'INFO', meta: { 'CHAIN-ID': '31337', PROVIDER: 'provider2' } })
    );
  });
});
