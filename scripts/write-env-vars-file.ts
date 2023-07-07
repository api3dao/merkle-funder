import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

// Read the .env file
const envVars = dotenv.parse(fs.readFileSync('.env')) as { [key: string]: string };

// Filter and format the environment variables
const formattedEnvVars = Object.keys(envVars)
  .filter((key) => !key.startsWith('ETHERSCAN_API_KEY'))
  .reduce((acc, key) => {
    acc[key] = `\${env:${key}, ""}`;
    return acc;
  }, {} as { [key: string]: string });

// Convert formattedEnvVars to YAML format
const yamlEnvVars = Object.entries(formattedEnvVars)
  .map(([key, value]) => `${key}: ${value}`)
  .join('\n');

// Write YAML to env-vars.yml file
fs.writeFileSync('env-vars.yml', yamlEnvVars);
