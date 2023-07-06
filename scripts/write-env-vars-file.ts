import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

// Read the .env file
const envVars = dotenv.parse(fs.readFileSync('.env'));

Object.keys(envVars).map((envVarName) => {
  if (envVarName.startsWith('ETHERSCAN_API_KEY')) {
    delete envVars[envVarName];
  }
});

// Format the values
const formattedEnvVars: { [key: string]: string } = {};

for (const key in envVars) {
  if (Object.prototype.hasOwnProperty.call(envVars, key)) {
    formattedEnvVars[key] = `\${env:${key}, ""}`;
  }
}

// Convert formattedEnvVars to YAML format
let yamlEnvVars = '';
for (const key in formattedEnvVars) {
  if (Object.prototype.hasOwnProperty.call(formattedEnvVars, key)) {
    yamlEnvVars += `${key}: ${formattedEnvVars[key]}\n`;
  }
}

// Write YAML to env-vars.yml file
fs.writeFileSync('env-vars.yml', yamlEnvVars);
