import { go } from '@api3/promise-utils';
import { loadConfig } from '../src';
import dotenv from 'dotenv';

dotenv.config();

(async () => {
  const loadConfigResult = await go(() => loadConfig());
  if (!loadConfigResult.success) {
    console.log('Failed to load config:\n', loadConfigResult.error.message);
    throw loadConfigResult.error;
  }
  console.log('Successfully loaded and interpolated config file');
})();
