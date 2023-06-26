import fs from 'fs';
import { loadConfig } from './';
import { generateRandomAddress } from '../test/test-utils';

jest.mock('fs');

describe('loadConfig', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should load and parse the config file correctly', () => {
    const configPath = './config/config.json';
    const configData = {
      31337: {
        rpcUrl: 'https://example.com',
        funderMnemonic: 'test test test test test test test test test test test junk',
        merkleFunderDepositories: [
          {
            owner: generateRandomAddress(),
            values: [
              {
                recipient: generateRandomAddress(),
                lowThreshold: { value: 1, unit: 'wei' },
                highThreshold: { value: 10, unit: 'wei' },
              },
            ],
          },
        ],
      },
    };

    const mockedReadFileSync = jest.spyOn(fs, 'readFileSync').mockReturnValueOnce(JSON.stringify(configData));

    const result = loadConfig(configPath);

    expect(mockedReadFileSync).toHaveBeenCalledWith(configPath, 'utf-8');
    expect(result).toEqual(configData);
  });

  it('should throw an error if secrets interpolation fails', () => {
    const configPath = './config/config.json';
    const configData = {
      rpcUrl: 'https://${INVALID_ENV_VARIABLE}.com',
      funderMnemonic: 'test test test test test test test test test test test junk',
      merkleFunderDepositories: [],
    };

    jest.spyOn(fs, 'readFileSync').mockReturnValueOnce(JSON.stringify(configData));

    expect(() => {
      loadConfig(configPath);
    }).toThrowError('Secrets interpolation failed');
  });

  it('should interpolate variables in the config using the provided secrets', () => {
    const configPath = './config/config.json';
    const merkleFunderDepositories = [
      {
        owner: generateRandomAddress(),
        values: [
          {
            recipient: generateRandomAddress(),
            lowThreshold: { value: 1, unit: 'wei' },
            highThreshold: { value: 10, unit: 'wei' },
          },
        ],
      },
    ];
    const configData = {
      31337: {
        rpcUrl: 'https://${RPC_HOST}:${RPC_PORT}',
        funderMnemonic: '${FUNDER_MNEMONIC}',
        merkleFunderDepositories,
      },
    };
    const funderMnemonic = 'test test test test test test test test test test test junk';
    const secrets = {
      RPC_HOST: 'example.com',
      RPC_PORT: '8545',
      FUNDER_MNEMONIC: funderMnemonic,
    };
    const expectedInterpolatedConfig = {
      31337: {
        rpcUrl: 'https://example.com:8545',
        funderMnemonic,
        merkleFunderDepositories,
      },
    };

    const mockedReadFileSync = jest.spyOn(fs, 'readFileSync').mockReturnValueOnce(JSON.stringify(configData));

    const originalProcessEnv = { ...process.env }; // Backup original process.env

    process.env = { ...secrets }; // Mock process.env with secrets

    const result = loadConfig(configPath);

    expect(mockedReadFileSync).toHaveBeenCalledWith(configPath, 'utf-8');
    expect(result).toEqual(expectedInterpolatedConfig);

    process.env = originalProcessEnv; // Restore original process.env
  });
});
