# merkle-funder

This repo contains contracts, scripts and a serverless function that can be used to send funds to addresses based on values from a configuration file

- [`contracts`](./contracts/) - Smart contracts written in Solidity to manage funds sent to pre-defined addresses using a merkle-tree
- [`deploy`](./deploy/) - Deployment scripts for the hardhat-deploy plugin. Currently there is a single script that deploys the [MerkleFunder](./contracts/MerkleFunder.sol) contract
- [`deployments`](./deployments/) - Parent directory for the hardhat-deploy script output. When MerkleFunder.sol is deploy to a new chain using this script, a new directory with the chain name will be added
- [`scripts`](./scripts/) - Utility scripts to interact with the MerkleFunder contract
- [`src`](./src/) - Shared source code and the handler implementation for the serverless function

## Prerequisites

- Node.js >= 18.x
- Yarn

## Installation

```sh
yarn install --frozen-lockfile
```

## Building

```sh
yarn build
```

## Adding a new chain

### Deploy contracts

1. Copy [.env.example](./env.example) to `.env` and add new entries to this file with the RPC provider URL and set the mnemonic of the account that will be used to deploy `MerkleFunder` contract and later send transactions with
1. Copy [config.example.json](./config/config.example.json) to `config.json` and add a new entry using the chain ID as key for the object
   <!-- TODO: add more details about each field in the config -->
1. Add a new entry to [hardhat.config.ts](./hardhat.config.ts) `networks` object
1. Deploy `MerkleFunder` contract by running:

   ```shell
   yarn deploy:merkle-funder <chainName>
   ```

   `chainName` must match the one set in previous step

1. Deploy all `MerkleFunderDepository` contracts by running:

   ```shell
   yarn deploy:merkle-funder-depositories <chainName>
   ```

   This script will also try to fund each `MerkleFunderDepository` contract

### Send funds to recipients

After following all steps in [previous section](#deploy-contracts), run the following command:

```shell
yarn fund <chainName>
```

This command will trigger funds to be sent to recipients defined in `config.json`

### Deploy serverless function

Another way to trigger funds to be sent from a `MerkleFunderDepository` to a recipient address is to run the scheduled lambda function on a 1 minute interval

1. Configure your AWS credentials
1. Add a new entries for the environment variables mapping in [env-vars.yml](./env-vars.yml)
1. Add the env vars to the .env file
1. Deploy the function by running:

   ```shell
   yarn sls:deploy --stage <stageName>
   ```

   Please note that serverless framework will try to match `stageName` with `.env.stageName` file name. Otherwise it will default to `.env` file

### Remove serverless function

If you want to remove the function from AWS then run the following command:

```shell
yarn sls:remove --stage <stageName>
```

## Local development

- Start a local ethereum node by running `yarn hh:node`
- The scripts can be then run using `localhost` as `chainName`
  For example:

  ```shell
  yarn deploy:merkle-funder localhost
  yarn deploy:merkle-funder-depositories localhost
  yarn fund localhost
  ```

- There are 2 ways to test the lambda function locally:

  1. `yarn sls:local` (uses serverless-offline plugin and this is the closest to actually deploying the function to AWS)
  1. `yarn sls:invoke:fundHandler`

  > In case you want to use different environment variables when testing this function locally then the easiest is to create a `.env.dev` file which will have precedence over `.env` when executing either of the two commands. Another alternative is to create a `.env.local` (or `.env.development`, etc) and set the stage to `local`. For example: `yarn sls:local --stage local`
