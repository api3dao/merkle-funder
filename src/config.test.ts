import fs from 'fs';
import { ZodError } from 'zod';
import { generateRandomAddress } from '../test/test-utils';
import { loadConfig, validateConfig } from './config';

jest.mock('fs');

describe('loadConfig', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should load and parse the config file correctly', () => {
    const configPath = './config/config.json';
    const configData = {
      31337: {
        funderMnemonic: 'test test test test test test test test test test test junk',
        providers: {
          local: {
            url: 'https://example.com',
          },
        },
        options: {
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
        },
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
      funderMnemonic: 'test test test test test test test test test test test junk',
      providers: {
        local: {
          url: 'https://${INVALID_ENV_VARIABLE}.com',
        },
      },
      options: {
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
      },
      merkleFunderDepositories: [],
    };

    jest.spyOn(fs, 'readFileSync').mockReturnValueOnce(JSON.stringify(configData));

    expect(() => {
      loadConfig(configPath);
    }).toThrowError('Secrets interpolation failed');
  });

  it('should interpolate variables in the config using the provided secrets', () => {
    const configPath = './config/config.json';
    const options = {
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
        funderMnemonic: '${MNEMONIC}',
        providers: {
          local: {
            url: 'https://${RPC_HOST}:${RPC_PORT}',
          },
        },
        options,
        merkleFunderDepositories,
      },
    };
    const mnemonic = 'test test test test test test test test test test test junk';
    const secrets = {
      RPC_HOST: 'example.com',
      RPC_PORT: '8545',
      MNEMONIC: mnemonic,
    };
    const expectedInterpolatedConfig = {
      31337: {
        funderMnemonic: mnemonic,
        providers: {
          local: {
            url: 'https://example.com:8545',
          },
        },
        options,
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

describe('validateConfig', () => {
  it('should not throw an error if the config is valid', () => {
    const configData = {
      31337: {
        funderMnemonic: '${MNEMONIC}',
        providers: {
          ethereum_1: {
            url: '${FUNDER_RPC_URL_LOCALHOST_1}',
          },
        },
        options: {
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
        },
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

    expect(() => validateConfig(configData, true)).not.toThrow();
  });

  it('should throw an error if the config has invalid interplation strings', () => {
    const configData = {
      31337: {
        funderMnemonic: '${mnemonic}',
        providers: {
          ethereum_1: {
            url: '${RPC_URL_LOCALHOST}',
          },
        },
        options: {
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
        },
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

    expect(() => validateConfig(configData, true)).toThrowError(
      new ZodError([
        {
          code: 'custom',
          message: 'Invalid mnemonic',
          path: ['31337', 'funderMnemonic'],
        },
        {
          validation: 'url',
          code: 'invalid_string',
          message: 'Invalid url',
          path: ['31337', 'providers', 'ethereum_1', 'url'],
        },
      ])
    );
  });

  it('should throw an error if the config is invalid', () => {
    const configData = {
      31337: {
        funderMnemonic: '${MNEMONIC}',
        providers: {
          ethereum_1: {
            url: '${FUNDER_RPC_URL_LOCALHOST_1}',
          },
        },
        options: {
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
        },
        merkleFunderDepositories: [
          {
            owner: '0x',
            values: [
              {
                address: generateRandomAddress(),
                lowThreshold: { value: 1, unit: 'wei' },
                highThreshold: { value: 10, unit: 'wei' },
              },
            ],
          },
        ],
      },
    };

    expect(() => validateConfig(configData, true)).toThrowError(
      new ZodError([
        {
          validation: 'regex',
          code: 'invalid_string',
          message: 'Invalid',
          path: ['31337', 'merkleFunderDepositories', 0, 'owner'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['31337', 'merkleFunderDepositories', 0, 'values', 0, 'recipient'],
          message: 'Required',
        },
      ])
    );
  });
});
