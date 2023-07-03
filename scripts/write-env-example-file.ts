import * as fs from 'fs';
import * as api3Chains from '@api3/chains';

const chainsEnvVars = [
  'MNEMONIC',
  'RPC_URL_LOCALHOST',
  ...api3Chains.CHAINS.map((chain) => {
    return `RPC_URL_${chain.alias.replace(/-/g, '_').toUpperCase()}`;
  }),
];

fs.writeFileSync(
  '.env.example',
  chainsEnvVars.reduce((fileContents: string, envVariableName: string) => {
    return fileContents + `${envVariableName}=""\n`;
  }, '')
);
