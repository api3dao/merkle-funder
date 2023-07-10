# merkle-funder

This repo contains contracts, scripts and a serverless function that can be used to send funds to addresses based on values from a configuration file

- [`contracts`](./contracts/) - Smart contracts written in Solidity to manage funds sent to pre-defined addresses using a Merkle tree
- [`deploy`](./deploy/) - Deployment scripts for the hardhat-deploy plugin. Currently there is a single script that deploys the [MerkleFunder](./contracts/MerkleFunder.sol) contract
- [`deployments`](./deployments/) - Parent directory for the hardhat-deploy script output. When MerkleFunder.sol is deployed to a new chain using this script, a new directory with the chain name will be added
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

1. Run the following script to generate the [example.env](./example.env) file:

   ```shell
   yarn env-example:write
   ```

1. Copy [example.env](./example.env) to `.env`

1. In `.env`, delete the lines that are related to chains that you will not use.
   Refer to [@api3/chains](https://github.com/api3dao/chains) for more information about the chains.

1. In `.env`, populate the `MNEMONIC` value.
   This will be used by hardhat-deploy to deploy contracts and by the app you deploy to send transactions to execute fundings.

1. In `.env`, populate the `FUNDER_RPC_URL_` values.
   These will be used by the app you deploy.

1. In `.env`, populate the `ETHERSCAN_API_KEY_` values.
   These will be used by hardhat-etherscan to verify the contracts you deploy.

1. Copy [config.example.json](./config/config.example.json) to `config.json` and add a new entry using the chain ID as key for the object
   <!-- TODO: add more details about each field in the config -->

1. Deploy `MerkleFunder` by running:

   ```shell
   NETWORK=<chainAlias> yarn deploy:merkle-funder
   ```

   `chainAlias` must match one from [@api3/chains](https://github.com/api3dao/chains)

1. Deploy all `MerkleFunderDepository` contracts by running:

   ```shell
   NETWORK=<chainAlias> yarn deploy:merkle-funder-depositories
   ```

### Send funds to recipients

After following all steps in [previous section](#deploy-contracts), and funding your MerkleFunderDepository contracts, run the following command:

```shell
yarn fund <chainName>
```

This command will trigger funds to be sent to recipients defined in `config.json`

### Deploy serverless function

Another way to trigger funds to be sent from a `MerkleFunderDepository` to a recipient address is to run the scheduled lambda function on a 1 minute interval

1. Configure your AWS credentials

1. Deploy the function by running:

   ```shell
   yarn sls:deploy --stage <stageName>
   ```

   Make sure that your environment variables are defined in your `.env` file.

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
  yarn fund:merkle-funder-depositories localhost
  yarn fund localhost
  ```

- There are 2 ways to test the lambda function locally:

  1. `yarn sls:local` (uses serverless-offline plugin and this is the closest to actually deploying the function to AWS)
  1. `yarn sls:invoke:fundHandler`

  > In case you want to use different environment variables when testing this function locally then the easiest is to create a `.env.dev` file which will have precedence over `.env` when executing either of the two commands. Another alternative is to create a `.env.local` (or `.env.development`, etc) and set the stage to `local`. For example: `yarn sls:local --stage local`
