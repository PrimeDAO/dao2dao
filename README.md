[![banner](https://i.ibb.co/NWjZc4N/Artboard-44.png)](https://primedao.eth.link/#/)

# 🤖 PrimeDAO D2D Smart Contracts
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)


This repo contains the smart contracts for the DAO2DAO research project prototype, the mission of which is to facilitate trustless, on-chain collaborations between DAOs. A technical writeup of the prototype can be found [here](https://docs.google.com/document/d/1rlWUvU8Hr3fGpVKOJvReFBqXHtgpOiKZPvkrTpIBF6M/edit?usp=sharing).

`/contracts/` is organized as follows:
- `/contracts/schemes/CtfTreasury`: contract for DAOs and non-`ERC1155Reciever` contracts to interface with the Gnosis Conditional
 Tokens Framework. Contract also holds Conditional Tokens for these contracts.
- `/contracts/Oracle`: automated Oracle contract for registering and checking conditions created via the CtfTreasury.


## Development

To install node modules

```
npm i
```

To compile contracts

```
truffle compile
```

To run tests

```
npm run test
```

To run coverage

```
npm run coverage
```
