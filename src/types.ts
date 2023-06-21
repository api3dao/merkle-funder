import { z } from 'zod';
import { merkleFunderDepositoriesSchema, chainConfigSchema, configSchema, valuesSchema } from './config';

export type Secrets = Record<string, string | undefined>;

export type Values = z.infer<typeof valuesSchema>;
export type MerkleFunderDepositories = z.infer<typeof merkleFunderDepositoriesSchema>;
export type ChainConfig = z.infer<typeof chainConfigSchema>;
export type Config = z.infer<typeof configSchema>;
