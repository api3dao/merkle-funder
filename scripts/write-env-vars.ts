import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

dotenv.config();

// Read the .env file
const envVars = dotenv.parse(fs.readFileSync('.env'));

// Format the values
const formattedEnvVars: { [key: string]: string } = {};

for (const key in envVars) {
  if (Object.prototype.hasOwnProperty.call(envVars, key)) {
    formattedEnvVars[key] = `\${env:${key}, ""}`;
  }
}

// Convert formattedEnvVars to YAML format
const yamlEnvVars = yaml.dump(formattedEnvVars);

// Write YAML to env-vars.yml file
fs.writeFileSync('env-vars.yml', yamlEnvVars);
