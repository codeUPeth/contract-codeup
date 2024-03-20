## ButerinTower Smart Contract

Welcome to **ButerinTower**, your portal to Ethereum's rich history and promising future! 🏰🚀

### Game Mechanics

1. **Building Towers**: Immerse yourself in Ethereum's journey by purchasing tower floors using **Stablecoin**. Each floor represents a milestone on Ethereum's roadmap. Explore Ethereum's past, present, and future as you ascend your tower! 🌆💼

2. **Earning Rewards**: Your tower generates rewards in **Gas Coin** over time. Claim these rewards regularly to fuel your Ethereum ambitions and advance further on the Ethereum roadmap! 💰✨

3. **Referral Bonuses**: Expand your network and earn extra rewards! Invite friends to join and receive bonuses whenever they make a purchase. Together, unlock Ethereum's secrets and bask in its riches! 🎉👫

### Smart Contract Features

- **Tower Management**: Monitor your tower's progress, including Gas Coin balance, earned rewards, coder count, and more. Dive deep into Ethereum's past, present, and future with each floor you unlock! 📊🏰

- **Referral Program**: Enjoy multi-level referral bonuses to amplify your earnings. Collaborate with your network to unravel Ethereum's mysteries and unlock its full potential! 🤝💎

- **Upgrade System**: Enhance your tower's capabilities by upgrading floors and adding more coders. Explore new chapters of Ethereum's story and unlock greater rewards as you ascend! 🌟🚀

Embark on an unforgettable journey through Ethereum's past, present, and future with ButerinTower! Build your legacy, claim your rewards, and reach for the Ethereum sky! 🌟🌈

## Technical Stack

- Solidity
- Hardhat
- JavaScript
- TypeScript
- Ethers.js
- solidity-coverage
- Mocha
- Chai

## Installation

It is recommended to install [Yarn](https://classic.yarnpkg.com) through the `npm` package manager, which comes bundled with [Node.js](https://nodejs.org) when you install it on your system. It is recommended to use a Node.js version `>= 16.0.0`.

Once you have `npm` installed, you can run the following both to install and upgrade Yarn:

```bash
npm install --global yarn
```

After having installed Yarn, simply run:

```bash
yarn install
```

## `.env` File

In the `.env` file place the private key of your wallet in the `PRIVATE_KEY` section. This allows secure access to your wallet to use with both testnet and mainnet funds during Hardhat deployments. For more information on how this works, please read the documentation of the `npm` package [`dotenv`](https://www.npmjs.com/package/dotenv).

### `.env` variables list

- **PRIVATE_KEY** - Private key of wallet that will be used for deployment.
- **[Network]\_API_KEY** - Api key for smart contracts auto verification on blockchain explorers.
- **[Network]\_MAINNET_URL** - rpc for mainnet network.
- **[Network]\_TESTNET_URL** - rpc for testnet network.

You can see an example of the `.env` file in the `.env.example` file.

## Contracts

Project smart contracts:

### Testing

1. To run TypeScript tests:

```bash
yarn test:hh
```

2. To run tests and view coverage :

```bash
yarn coverage
```

### Compilation

```bash
yarn compile
```

### Deployment Buterin Tower

To deploy contracts you need set up `.env`

- **PRIVATE_KEY** - Private key of wallet that will be used for deployment.
- **[Network]\_API_KEY** - Api key for smart contracts auto verification on blockchain explorers.
- **[Network]\_MAINNET_URL** - rpc for mainnet network.
- **[Network]\_TESTNET_URL** - rpc for testnet network.

run:

```bash
yarn deploy:[network]
```

or

```bash
npx hardhat run --network [Network] scripts/deploy.ts
```

## Contract Verification

Change the contract address to your contract after the deployment has been successful. This works for both testnet and mainnet. You will need to get an API key from [etherscan](https://etherscan.io), [snowtrace](https://snowtrace.io) etc.

**Example:**

```bash
npx hardhat verify --network [network] --constructor-args [...args] <YOUR_CONTRACT_ADDRESS>
```
