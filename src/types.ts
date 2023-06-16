import { z } from 'zod';
import { chainConfigSchema, chainsConfigSchema, configSchema, valuesSchema } from './config';

export type Values = z.infer<typeof valuesSchema>;
export type ChainConfig = z.infer<typeof chainConfigSchema>;
export type ChainsConfig = z.infer<typeof chainsConfigSchema>;
export type Config = z.infer<typeof configSchema>;
