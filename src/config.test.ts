import fs from 'fs';
import { loadConfig } from './';
import { generateRandomAddress, generateRandomBytes32 } from '../test/test-utils';

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
        privateKey: generateRandomBytes32(),
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
      privateKey: '0x1234567890abcdef',
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
        privateKey: '${PRIVATE_KEY}',
        merkleFunderDepositories,
      },
    };
    const privateKey = generateRandomBytes32();
    const secrets = {
      RPC_HOST: 'example.com',
      RPC_PORT: '8545',
      PRIVATE_KEY: privateKey,
    };
    const expectedInterpolatedConfig = {
      31337: {
        rpcUrl: 'https://example.com:8545',
        privateKey: privateKey,
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
