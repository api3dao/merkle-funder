import fs from "fs";
import { z } from "zod";

export const evmAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export const namedUnits = z.union([
  z.literal("wei"),
  z.literal("kwei"),
  z.literal("mwei"),
  z.literal("gwei"),
  z.literal("szabo"),
  z.literal("finney"),
  z.literal("ether"),
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
  { message: "All recipients must be unique" }
);

export const chainConfigSchema = z.object({
  owner: evmAddressSchema,
  values: valuesSchema,
});

export const chainsConfigSchema = z.record(
  z.coerce.number().int().positive(),
  z.array(chainConfigSchema)
);

export const configSchema = z.object({
  funderDepositories: chainsConfigSchema,
});

const loadConfig = (configPath: string = "./config/config.json") => {
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  return configSchema.parse(config);
};

export default loadConfig;
