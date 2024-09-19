## 💎 CodeUp Smart Contract 💎

Welcome to **💎 CodeUp 💎**, your portal to Ethereum's rich history and promising future! 🏰🚀

### 🎮 Game Mechanics 🎮

1. **🏢 Building Tower 🏢**: Immerse yourself in Ethereum's journey ✈️💵 by purchasing tower floors using **ETH 💎**. Each floor represents a milestone on Ethereum's roadmap. As you ascend your tower, you'll explore Ethereum's past, present, and future! 🌆 The CodeUp Tower boasts eight distinctive floors 👷🏽, each representing a pivotal stage in your ascent to greatness! Within these floors, you'll discover the opportunity to amplify your earnings by accommodating skilled builder's 👨‍🚀. However, there's a crucial stipulation—you must populate each floor with five builder's 👨‍🚀 before unlocking the next tier. 🧑‍💻🔑

2. **💰 Earning Rewards 💰**: Your tower generates rewards in **MicroETH 💵** over time. Claim these rewards regularly to fuel your Ethereum ambitions and advance further on the Ethereum roadmap! 💰✨  
   ⚠️ Users must collect their earned rewards at least once every 24 minutes to avoid missing out on potential rewards. ⚠️

3. **🚀 Receive CodeupERC20 🚀**: Upon successfully completing the game with 40 builders, you can **claim 0.000001 CodeupERC20** tokens! 🌟🚀

4. **📈 Sell or Hold CodeupERC20**: After claiming, you can either **sell your CodeupERC20** on the **UniswapV2 pool** for ETH, or **hold onto it** for potential future gains. The value of CodeupERC20 **increases** as more players join the game and invest in their towers. 💎🚀

### 🌟 Smart Contract Features 🌟

- **👨‍💼 Tower Management 👨‍💼**: Monitor your tower's progress, including your MicroETH balance, earned rewards, builder's count, and more. Dive deep into Ethereum's past, present, and future with each floor you unlock! 📊🏰

- **🔝 Upgrade System 🔝**: Enhance your tower's capabilities by upgrading floors and adding more builders. Explore new chapters of Ethereum's story and unlock greater rewards as you ascend! 🌟🚀

- **📊 Dynamic Pricing**: The **CodeupERC20 token** follows a **dynamic pricing model**. As more players add microETH to their towers, the **token price increases**, providing greater rewards to early participants and enhancing liquidity through the UniswapV2 pool. 🌐

Embark on an unforgettable journey through Ethereum's past, present, and future with CodeUp! Build your legacy, claim your rewards, and reach for the Ethereum sky! 🌟🌈

## 📚 Technical Stack 📚

- Solidity 💪
- Hardhat 🎩
- JavaScript 🇯
- TypeScript 🇹
- Ethers.js ♢
- solidity-coverage 💯
- Mocha 🧑‍💻
- Chai 👨🏻‍💻

## ⌛ Installation ⌛

It is recommended to install [Yarn](https://classic.yarnpkg.com) through the `npm` package manager, which comes bundled with [Node.js](https://nodejs.org) when you install it on your system. It is recommended to use a Node.js version `>= 16.0.0`.

Once you have `npm` installed, you can run the following both to install and upgrade Yarn:

```bash
npm install --global yarn
```

After having installed Yarn, simply run:

```bash
yarn install
```

## 🤫 `.env` File 🤫

In the `.env` file place the private key of your wallet in the `PRIVATE_KEY` section. This allows secure access to your wallet to use with both testnet and mainnet funds during Hardhat deployments. For more information on how this works, please read the documentation of the `npm` package [`dotenv`](https://www.npmjs.com/package/dotenv).

### `.env` variables list

- **PRIVATE_KEY** - Private key of wallet that will be used for deployment.
- **[Network]\_API_KEY** - Api key for smart contracts auto verification on blockchain explorers.
- **[Network]\_MAINNET_URL** - rpc for mainnet network.
- **[Network]\_TESTNET_URL** - rpc for testnet network.

You can see an example of the `.env` file in the `.env.example` file.

## 📜 Contracts 📜

Project smart contracts:

- **Codeup.sol** - Main contract of the game.
- **CodeupERC20.sol** - ERC20 token for game winner's

### ✔️ Testing ✔️

1. To run TypeScript tests:

```bash
yarn test:hh
```

2. To run tests and view coverage :

```bash
yarn coverage
```

### 💽 Compilation 💽

```bash
yarn compile
```

### 🚀 Deployment CodeUp 🚀

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

## Contract Verification 「✔ ᵛᵉʳᶦᶠᶦᵉᵈ」

Change the contract address to your contract after the deployment has been successful. This works for both testnet and mainnet. You will need to get an API key from [etherscan](https://etherscan.io), [snowtrace](https://snowtrace.io) etc.

**Example:**

```bash
npx hardhat verify --network [network] --constructor-args [...args] <YOUR_CONTRACT_ADDRESS>
```
