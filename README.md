# Selfkey Invite Code Registry Contract

## Overview

Deployed on sidechain (Polygon)

## Development

All smart contracts are implemented in Solidity `^0.8.0`, using [Hardhat](https://hardhat.org/) as the Solidity development framework.

### Prerequisites

* [NodeJS](htps://nodejs.org), v16.1.0+
* [Hardhat](https://hardhat.org/), which is a comprehensive framework for Ethereum development.

### Initialization

    npm install

### Testing

    npx hardhat test

or with code coverage

    npx hardhat coverage


### Contract method interface

The following public functions are provided:

* `getMessageHash(address _from, address _to, string memory _scope, uint _timestamp) returns (bytes32)` : obtain hash


### Contract addresses

```
Polygon Mumbai: 0x4D29D29AAb8030174e876cfbB32455cDAfef6e66
Polygon Mainnet:
Signer: 0x89145000ADBeCe9D1FFB26F645dcb0883bc5c3d9
```

### Deploying and upgrading contract

Deploy proxy and initial version of the contract
```
npx hardhat run scripts/deploy.js --network mumbai
```

### Verifying contract

```
npx hardhat verify --network mumbai <contract_address>
```

## Contributing

Please see the [contributing notes](CONTRIBUTING.md).


## Team
