import { GoResult, goSync } from '@api3/promise-utils';
import fs from 'fs';
import { reduce, template } from 'lodash';
import { z } from 'zod';
import { Secrets } from './types';

export const evmAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
export const evmHashSchema = z.string().regex(/^0x[a-fA-F\d]{64}$/);

export const namedUnits = z.union([
  z.literal('wei'),
  z.literal('kwei'),
  z.literal('mwei'),
  z.literal('gwei'),
  z.literal('szabo'),
  z.literal('finney'),
  z.literal('ether'),
]);

export const thresholdSchema = z.object({
  value: z.number().nonnegative(),
  unit: namedUnits,
});

export const valueSchema = z.object({
  recipient: evmAddressSchema,
  lowThreshold: thresholdSchema,
  highThreshold: thresholdSchema,
});

export const valuesSchema = z.array(valueSchema).refine(
  (values) => {
    const recipients = values.map((value) => value.recipient);
    const uniqueRecipients = [...new Set(recipients)];
    return uniqueRecipients.length === recipients.length;
  },
  { message: 'All recipients must be unique' }
);

export const merkleFunderDepositoriesSchema = z.array(
  z.object({
    owner: evmAddressSchema,
    values: valuesSchema,
  })
);

export const chainConfigSchema = z.object({
  rpcUrl: z.string().url(),
  privateKey: evmHashSchema,
  merkleFunderDepositories: merkleFunderDepositoriesSchema,
});

export const configSchema = z.record(z.coerce.number().int().positive(), chainConfigSchema);

// Regular expression that does not match anything, ensuring no escaping or interpolation happens
// https://github.com/lodash/lodash/blob/4.17.15/lodash.js#L199
const NO_MATCH_REGEXP = /($^)/;
// Regular expression matching ES template literal delimiter (${}) with escaping
// https://github.com/lodash/lodash/blob/4.17.15/lodash.js#L175
const ES_MATCH_REGEXP = /(?<!\\)\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;
// Regular expression matching the escaped ES template literal delimiter (${}). We need to use "\\\\" (four backslashes)
// because "\\" becomes "\\\\" when converted to string
const ESCAPED_ES_MATCH_REGEXP = /\\\\(\$\{([^\\}]*(?:\\.[^\\}]*)*)\})/g;

function interpolateSecrets(config: unknown, secrets: Secrets): GoResult<unknown> {
  const stringifiedSecrets = reduce(
    secrets,
    (acc: object, value: unknown, key: string) => {
      return {
        ...acc,
        // Convert to value to JSON to encode new lines as "\n". The resulting value will be a JSON string with quotes
        // which are sliced off.
        [key]: JSON.stringify(value).slice(1, -1),
      };
    },
    {} as Secrets
  );

  const interpolationRes = goSync(() =>
    JSON.parse(
      template(JSON.stringify(config), {
        escape: NO_MATCH_REGEXP,
        evaluate: NO_MATCH_REGEXP,
        interpolate: ES_MATCH_REGEXP,
      })(stringifiedSecrets)
    )
  );

  if (!interpolationRes.success) return interpolationRes;

  const interpolatedConfig = JSON.stringify(interpolationRes.data);
  // Un-escape the escaped config interpolations (e.g. to enable interpolation in processing snippets)
  return goSync(() => JSON.parse(interpolatedConfig.replace(ESCAPED_ES_MATCH_REGEXP, '$1')));
}

const loadConfig = (configPath = './config/config.json') => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const interpolateConfigRes = interpolateSecrets(config, process.env);
  if (!interpolateConfigRes.success) {
    throw new Error(`Secrets interpolation failed: ${interpolateConfigRes.error.message}`);
  }

  return configSchema.parse(interpolateConfigRes.data);
};

export default loadConfig;
