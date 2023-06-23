import { z } from 'zod';
import {
  chainConfigSchema,
  configSchema,
  evmAddressSchema,
  evmHashSchema,
  merkleFunderDepositoriesSchema,
  namedUnits,
  valueSchema,
  valuesSchema,
} from './config';

export type Secrets = Record<string, string | undefined>;

export type EvmAddress = z.infer<typeof evmAddressSchema>;
export type EvmHash = z.infer<typeof evmHashSchema>;
export type NamedUnits = z.infer<typeof namedUnits>;
export type Value = z.infer<typeof valueSchema>;
export type Values = z.infer<typeof valuesSchema>;
export type MerkleFunderDepositories = z.infer<typeof merkleFunderDepositoriesSchema>;
export type ChainConfig = z.infer<typeof chainConfigSchema>;
export type Config = z.infer<typeof configSchema>;
