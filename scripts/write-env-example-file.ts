import * as fs from 'fs';
import * as api3Chains from '@api3/chains';

const chainsEnvVars = ['localhost', ...api3Chains.CHAINS.map((chain) => chain.alias)].map(
  (chainAlias) => `FUNDER_RPC_URL_${chainAlias.replace(/-/g, '_').toUpperCase()}`
);

fs.writeFileSync(
  'example.env',
  `LOG_LEVEL=INFO\n${[...chainsEnvVars, ...api3Chains.hardhatConfig.getEnvVariableNames()]
    .map((envVariableName) => `${envVariableName}=""`)
    .join('\n')}\n`
);
