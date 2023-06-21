import { Context, ScheduledEvent, ScheduledHandler } from 'aws-lambda';
import loadConfig from './config';
import { fundChainRecipients } from './merkle-funder';
import path from 'path';
import { getMerkleFunderContract } from './credentials';

export const run: ScheduledHandler = async (_event: ScheduledEvent, _context: Context): Promise<void> => {
  const startedAt = new Date();
  const config = loadConfig();

  try {
    await Promise.all(
      Object.entries(config.merkleFunderDepositories).map(async ([chainId, merkleFunderDepositories]) => {
        const merkleFunderContract = getMerkleFunderContract(path.join(__dirname, '../'), chainId);
        await fundChainRecipients(merkleFunderDepositories, merkleFunderContract);
      })
    );
  } catch (err) {
    const error = err as Error;
    console.error(error.message);
  }

  const endedAt = new Date();
  console.log(`Scheduled task finished running. Run delta: ${(endedAt.getTime() - startedAt.getTime()) / 1000} s`);
};
