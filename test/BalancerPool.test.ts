import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Codeup, ERC20, CodeupERC20 } from "../typechain-types";
import { VAULT_ABI, WEIGHTED_POOL_ABI } from "./abis";

const COINS_PRICE = ethers.utils.parseEther("0.000001");
const VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
const WEIGHT_POOL_FACTORY = "0xc7E5ED1054A24Ef31D827E6F86caA58B3Bc168d7";

const calcPoolStats = async (game: Codeup, vault: any) => {
  const pool = await ethers.getContractAt(
    WEIGHTED_POOL_ABI,
    await game.balancerPool()
  );
  const poolID = await pool.getPoolId();
  const weights = await pool.getNormalizedWeights();
  const poolTokens = await vault.getPoolTokens(poolID);

  const wethCalculation = poolTokens.balances[0] * weights[0];
  const gtCalculation = poolTokens.balances[1] * weights[1];
  const gtToWETHprice = wethCalculation / gtCalculation;
  const wethToGTprice = gtCalculation / wethCalculation;

  console.log(
    "Weth Balance in Pool",
    ethers.utils.formatUnits(poolTokens.balances[0], 18)
  );
  console.log("WETH Weight in Pool", weights[0] / 1e16);

  console.log(
    "GT Balance in Pool",
    ethers.utils.formatUnits(poolTokens.balances[1], 18)
  );
  console.log("GT Weight in Pool", weights[1] / 1e16);

  console.log("1 WETH to GT Price ==========>", wethToGTprice);
  console.log("1 GT to WETH Price ===========>", gtToWETHprice);
};

const sell = async (
  vault: any,
  player: SignerWithAddress,
  game: Codeup,
  gameToken: CodeupERC20
) => {
  const pool = await ethers.getContractAt(
    WEIGHTED_POOL_ABI,
    await game.balancerPool()
  );
  await gameToken
    .connect(player)
    .approve(vault.address, ethers.constants.MaxUint256);
  await vault.connect(player).swap(
    {
      poolId: await pool.getPoolId(),
      kind: 0,
      assetIn: gameToken.address,
      assetOut: ethers.constants.AddressZero,
      amount: await gameToken.balanceOf(player.address),
      userData: "0x",
    },
    {
      sender: player.address,
      fromInternalBalance: false,
      recipient: player.address,
      toInternalBalance: false,
    },
    1,
    ethers.constants.MaxUint256
  );
  await calcPoolStats(game, vault);
};

const buy = async (
  vault: any,
  player: SignerWithAddress,
  game: Codeup,
  gameToken: CodeupERC20
) => {
  const pool = await ethers.getContractAt(
    WEIGHTED_POOL_ABI,
    await game.balancerPool()
  );
  await gameToken
    .connect(player)
    .approve(vault.address, ethers.constants.MaxUint256);
  await vault.connect(player).swap(
    {
      poolId: await pool.getPoolId(),
      kind: 0,
      assetIn: ethers.constants.AddressZero,
      assetOut: gameToken.address,
      amount: ethers.utils.parseEther("0.0001"),
      userData: "0x",
    },
    {
      sender: player.address,
      fromInternalBalance: false,
      recipient: player.address,
      toInternalBalance: false,
    },
    0,
    ethers.constants.MaxUint256,
    { value: ethers.utils.parseEther("0.0002") }
  );
  await calcPoolStats(game, vault);
};

const buyAllCoders = async (
  gameContract: Codeup,
  player: SignerWithAddress
) => {
  const neededETH = ethers.utils.parseEther("0.009");
  await gameContract.connect(player).addMicroETH({
    value: neededETH,
  });

  for (let i = 0; i < 8; i++) {
    for (let j = 1; j <= 5; j++) {
      await gameContract.connect(player).upgradeTower(i);
    }
  }
};

describe("CryptoPlatform tests", function () {
  let gameContract: Codeup;
  let gameToken: CodeupERC20;
  let vault: any;
  let deployer: SignerWithAddress;
  let player1: SignerWithAddress;
  let accounts: SignerWithAddress[];
  let tokens: string[];
  let weth: ERC20;
  before(async () => {
    const [acc1, acc2, ...accs] = await ethers.getSigners();
    deployer = acc1;
    player1 = acc2;
    accounts = accs;

    const GAME_FACTORY = await ethers.getContractFactory("Codeup");
    const GAME_TOKEN_FACTORY = await ethers.getContractFactory("CodeupERC20");

    gameToken = await GAME_TOKEN_FACTORY.deploy(deployer.address, "GT", "GT");
    await gameToken.deployed();

    vault = await ethers.getContractAt(VAULT_ABI, VAULT);
    console.log(await vault.WETH());
    weth = await ethers.getContractAt("ERC20", await vault.WETH());

    tokens = [weth.address, gameToken.address].sort(function (a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });

    gameContract = await GAME_FACTORY.deploy(
      1,
      COINS_PRICE,
      WEIGHT_POOL_FACTORY,
      gameToken.address,
      VAULT,
      tokens,
      [
        ethers.utils.parseUnits("0.5", "18"),
        ethers.utils.parseUnits("0.5", "18"),
      ]
    );
    await gameContract.deployed();

    const deployerBalance = await gameToken.balanceOf(deployer.address);
    await gameToken.transfer(gameContract.address, deployerBalance);
  });

  describe("Testing balancer price", async function () {
    it("player 1", async function () {
      console.log(
        "====================================================================="
      );
      await buyAllCoders(gameContract, player1);
      await gameContract.claimCodeupERC20(player1.address);
      const gameTokenBalance = await gameToken.balanceOf(player1.address);
      console.log(
        ethers.utils.formatUnits(gameTokenBalance, 18),
        `Player 1 GameToken balance`
      );

      await calcPoolStats(gameContract, vault);
      console.log(
        "====================================================================="
      );
      // await sell(vault, player1, gameContract, gameToken);
    });
    it("player 2", async function () {
      console.log(
        "====================================================================="
      );
      await buyAllCoders(gameContract, accounts[0]);
      await gameContract.claimCodeupERC20(accounts[0].address);
      const gameTokenBalance = await gameToken.balanceOf(accounts[0].address);
      console.log(
        ethers.utils.formatUnits(gameTokenBalance, 18),
        `Player 2 GameToken balance`
      );

      await calcPoolStats(gameContract, vault);
      await sell(vault, accounts[0], gameContract, gameToken);
      console.log(
        "====================================================================="
      );
    });
    it("15 players", async function () {
      const isHold = [
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ];

      const isTreaders = [
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        false,
        true,
        false,
        true,
        false,
        true,
      ];

      const isTreadersSell = [
        false,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        false,
        false,
        true,
        false,
        true,
        false,
        true,
      ];

      for (let i = 1; i < 16; i++) {
        console.log(
          "====================================================================="
        );
        await buyAllCoders(gameContract, accounts[i]);
        await gameContract.claimCodeupERC20(accounts[i].address);
        const gameTokenBalance = await gameToken.balanceOf(accounts[i].address);
        console.log(
          ethers.utils.formatUnits(gameTokenBalance, 18),
          `Player ${i} GameToken balance`
        );
        await calcPoolStats(gameContract, vault);
        if (!isHold[i]) {
          await sell(vault, accounts[i], gameContract, gameToken);
        }
        if (isTreaders[i]) {
          console.log("+++++++++++ treader buy +++++++++++");
          await buy(vault, deployer, gameContract, gameToken);
        }
        if (isTreadersSell[i]) {
          console.log("+++++++++++ treader sell +++++++++++");
          await sell(vault, deployer, gameContract, gameToken);
        }
        console.log(
          "====================================================================="
        );
      }
    });
  });
});
