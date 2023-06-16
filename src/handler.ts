import { Context, ScheduledEvent, ScheduledHandler } from 'aws-lambda';
import loadConfig from './config';
import { fundChainRecipients } from './funder';
import path from 'path';
import { getFunderContract } from './credentials';

export const run: ScheduledHandler = async (_event: ScheduledEvent, _context: Context): Promise<void> => {
  const startedAt = new Date();
  const config = loadConfig();

  try {
    await Promise.all(
      Object.entries(config.funderDepositories).map(async ([chainId, funderDepositories]) => {
        const funderContract = getFunderContract(path.join(__dirname, '../../'), chainId);
        await fundChainRecipients(funderDepositories, funderContract);
      })
    );
  } catch (err) {
    const error = err as Error;
    console.error(error.message);
  }

  const endedAt = new Date();
  console.log(`Scheduled task finished running. Run delta: ${(endedAt.getTime() - startedAt.getTime()) / 1000} s`);
};
