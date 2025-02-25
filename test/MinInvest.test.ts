import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ERC20, CodeupERC20, Codeup } from "../typechain-types";
import { ROUTER } from "./abis";
import {
  calcGTtoETHRate,
  COINS_PRICE,
  convertCoinToETH,
  convertETHtoCoin,
  getCurrentTimeStamp,
  MAX_AMOUNT_FOR_WINNER,
  MAX_COINS_AMOUNT,
  UniswapV2Router,
} from "./utills";

describe("Codeup tests", function () {
  let gameContract: Codeup;
  let gameToken: CodeupERC20;
  let router: any;
  let deployer: SignerWithAddress;
  let player1: SignerWithAddress;
  let player2: SignerWithAddress;
  let player3: SignerWithAddress;
  let accounts: SignerWithAddress[];
  let weth: ERC20;
  before(async () => {
    const [acc1, acc2, acc3, acc4, ...others] = await ethers.getSigners();
    deployer = acc1;
    player1 = acc2;
    player2 = acc3;
    player3 = acc4;
    accounts = others;

    const GAME_FACTORY = await ethers.getContractFactory("Codeup");
    const GAME_TOKEN_FACTORY = await ethers.getContractFactory("CodeupERC20");

    gameToken = await GAME_TOKEN_FACTORY.deploy(deployer.address, "GT", "GT");
    await gameToken.deployed();

    router = await ethers.getContractAt(ROUTER, UniswapV2Router);
    weth = await ethers.getContractAt("ERC20", await router.WETH());

    gameContract = await GAME_FACTORY.deploy(
      1,
      COINS_PRICE,
      MAX_AMOUNT_FOR_WINNER,
      UniswapV2Router,
      gameToken.address,
      deployer.address
    );
    await gameContract.deployed();

    const deployerBalance = await gameToken.balanceOf(deployer.address);
    await gameToken.transfer(gameContract.address, deployerBalance);
  });

  describe("Min Investment tests", async () => {
    it("should buy first floor", async () => {
      const minAmountInCoins = BigNumber.from("4340");
      const minAmountForBuy = convertCoinToETH(minAmountInCoins);
      await gameContract
        .connect(player1)
        .addGameETH({ value: minAmountForBuy });
      await gameContract.connect(player1).upgradeTower(0);

      const tower = await gameContract.towers(player1.address);
      expect(tower.totalGameETHSpent).to.equal(minAmountInCoins);

      for (let i = 0; i < 200; i++) {
        await gameContract.connect(player1).collect();
        const towerAfter = await gameContract.towers(player1.address);
        console.log("player1", towerAfter.gameETH.toString());
        await ethers.provider.send("evm_increaseTime", [60 * 60 * 60]);
      }
    });
  });
});
