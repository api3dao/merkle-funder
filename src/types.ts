import { z } from 'zod';
import { valuesSchema } from './config';

export type Values = z.infer<typeof valuesSchema>;
