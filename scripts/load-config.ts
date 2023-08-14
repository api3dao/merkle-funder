import { go } from '@api3/promise-utils';
import dotenv from 'dotenv';
import { loadConfig } from '../src/config';

dotenv.config();

(async () => {
  const loadConfigResult = await go(() => loadConfig());
  if (!loadConfigResult.success) {
    console.log('Failed to load config:\n', loadConfigResult.error.message);
    throw loadConfigResult.error;
  }
  console.log('Successfully loaded and interpolated config file');
})();
