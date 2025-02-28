import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import {
  ERC20,
  CodeupERC20,
  Codeup,
  CodeupMemeDrop,
  TestERC20,
} from "../typechain-types";
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

describe("CodeupMemeDrop tests", function () {
  let gameContract: CodeupMemeDrop;
  let gameToken: CodeupERC20;
  let dropTokenRandom: TestERC20;
  let dropTokenFixed: TestERC20;
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

    const GAME_FACTORY = await ethers.getContractFactory("CodeupMemeDrop");
    const GAME_TOKEN_FACTORY = await ethers.getContractFactory("CodeupERC20");
    const TEST_ERC20_FACTORY = await ethers.getContractFactory("TestERC20");

    gameToken = await GAME_TOKEN_FACTORY.deploy(deployer.address, "GT", "GT");
    await gameToken.deployed();

    dropTokenRandom = await TEST_ERC20_FACTORY.deploy(
      "Drop Token Random",
      "DT1"
    );
    await dropTokenRandom.deployed();

    dropTokenFixed = await TEST_ERC20_FACTORY.deploy("Drop Token Fixed", "DT2");
    await dropTokenFixed.deployed();

    router = await ethers.getContractAt(ROUTER, UniswapV2Router);
    weth = await ethers.getContractAt("ERC20", await router.WETH());

    gameContract = await GAME_FACTORY.deploy(
      1,
      COINS_PRICE,
      MAX_AMOUNT_FOR_WINNER,
      UniswapV2Router,
      deployer.address
    );
    await gameContract.deployed();

    const deployerBalance = await gameToken.balanceOf(deployer.address);
    await gameToken.transfer(gameContract.address, deployerBalance);
    await dropTokenRandom.mint(
      gameContract.address,
      ethers.utils.parseEther("1000000")
    );
    await dropTokenFixed.mint(
      gameContract.address,
      ethers.utils.parseEther("1000000")
    );
    await gameContract.setGameToken(gameToken.address);
  });
  describe("Deployment", async () => {
    it("should revert deploy if start time is 0", async () => {
      const GAME_FACTORY = await ethers.getContractFactory("Codeup");
      await expect(
        GAME_FACTORY.deploy(
          0,
          COINS_PRICE,
          MAX_AMOUNT_FOR_WINNER,
          UniswapV2Router,
          gameToken.address,
          deployer.address
        )
      ).to.be.reverted;
    });
    it("should revert deploy if gameETH price is 0", async () => {
      const GAME_FACTORY = await ethers.getContractFactory("Codeup");
      await expect(
        GAME_FACTORY.deploy(
          1,
          0,
          MAX_AMOUNT_FOR_WINNER,
          UniswapV2Router,
          gameToken.address,
          deployer.address
        )
      ).to.be.reverted;
    });
  });
  describe("Manage drop tokens", async () => {
    it("should add drop token fixed", async () => {
      const dropTokenIndex = await gameContract.dropTokensIndex();
      await gameContract.addDropToken(
        dropTokenFixed.address,
        ethers.utils.parseEther("10"),
        true,
        ethers.utils.parseEther("0"),
        ethers.utils.parseEther("0")
      );
      const dropToken = await gameContract.dropTokens(dropTokenIndex);

      expect(dropToken.tokenAddress).to.equal(dropTokenFixed.address);
      expect(dropToken.amount).to.equal(ethers.utils.parseEther("10"));
      expect(dropToken.isActive).to.equal(true);
      expect(dropToken.isFixed).to.equal(true);
      expect(dropToken.minAmount).to.equal(ethers.utils.parseEther("0"));
      expect(dropToken.maxAmount).to.equal(ethers.utils.parseEther("0"));
    });
    it("should add drop token random", async () => {
      const dropTokenIndex = await gameContract.dropTokensIndex();
      await gameContract.addDropToken(
        dropTokenRandom.address,
        ethers.utils.parseEther("0"),
        false,
        ethers.utils.parseEther("1"),
        ethers.utils.parseEther("1000")
      );
      const dropToken = await gameContract.dropTokens(dropTokenIndex);

      expect(dropToken.tokenAddress).to.equal(dropTokenRandom.address);
      expect(dropToken.amount).to.equal(ethers.utils.parseEther("0"));
      expect(dropToken.isActive).to.equal(true);
      expect(dropToken.isFixed).to.equal(false);
      expect(dropToken.minAmount).to.equal(ethers.utils.parseEther("1"));
    });
    it("should revert add drop token fixed if amount is 0", async () => {
      await expect(
        gameContract.addDropToken(
          dropTokenFixed.address,
          0,
          true,
          ethers.utils.parseEther("0"),
          ethers.utils.parseEther("0")
        )
      ).to.be.reverted;
    });
    it("should revert add drop token random if min amount is greater than max amount", async () => {
      await expect(
        gameContract.addDropToken(
          dropTokenRandom.address,
          0,
          false,
          ethers.utils.parseEther("1000"),
          ethers.utils.parseEther("1")
        )
      ).to.be.reverted;
    });
    it("should revert add drop token random if token address is 0", async () => {
      await expect(
        gameContract.addDropToken(
          ethers.constants.AddressZero,
          0,
          false,
          ethers.utils.parseEther("1"),
          ethers.utils.parseEther("1000")
        )
      ).to.be.reverted;
    });
    it("should revert add drop token random if max amount is 0", async () => {
      await expect(
        gameContract.addDropToken(
          dropTokenRandom.address,
          0,
          false,
          ethers.utils.parseEther("1"),
          ethers.utils.parseEther("0")
        )
      ).to.be.reverted;
    });
  });
  describe("Game flow", async () => {
    it("should revert force  add liquidity if pool not created", async () => {
      await expect(gameContract.forceAddLiquidityToPool(0, 0, 0)).to.be
        .reverted;
    });
    it("should build a tower ", async () => {
      const ethAmount = convertCoinToETH(MAX_COINS_AMOUNT).div(
        BigNumber.from(2)
      );
      const predictedCoinsAmount = convertETHtoCoin(ethAmount);
      const wethBalanceBefore = await weth.balanceOf(gameContract.address);
      await gameContract.connect(player1).addGameETH({ value: ethAmount });
      const wethBalanceAfter = await weth.balanceOf(gameContract.address);
      expect(wethBalanceAfter).to.equal(wethBalanceBefore.add(ethAmount));

      const tower = await gameContract.towers(player1.address);
      expect(tower.gameETH).to.equal(predictedCoinsAmount);
      expect(await gameContract.totalTowers()).to.equal(BigNumber.from(1));
      expect(await gameContract.totalInvested()).to.be.equal(ethAmount);
    });
    it("should revert buy gameETH if amount is zero", async () => {
      await expect(gameContract.connect(player1).addGameETH({ value: 0 })).to.be
        .reverted;
    });
    it("should revert all actions if game not started", async () => {
      const gameFactorty = await ethers.getContractFactory("Codeup");
      const currentTime = await getCurrentTimeStamp();
      const game = await gameFactorty.deploy(
        currentTime + 60 * 60 * 24 * 30,
        COINS_PRICE,
        MAX_AMOUNT_FOR_WINNER,
        UniswapV2Router,
        gameToken.address,
        deployer.address
      );
      await game.deployed();

      const ethAmount = ethers.utils.parseEther("1");
      await expect(game.connect(player1).addGameETH({ value: ethAmount })).to.be
        .reverted;
      await expect(game.connect(player1).upgradeTower(0)).to.be.reverted;
      await expect(game.connect(player1).collect()).to.be.reverted;
      await expect(
        game.connect(player1).claimCodeupERC20(player1.address, 0, 0, 0)
      ).to.be.reverted;
    });
    it("buy gameETH again for player1", async () => {
      const neededCoins = await gameContract.getMaxGameEthForBuying(
        player1.address
      );

      const ethAmount = convertCoinToETH(neededCoins);
      const managerBalanceBefore = await weth.balanceOf(gameContract.address);
      await gameContract.connect(player1).addGameETH({ value: ethAmount });
      const managerBalanceAfter = await weth.balanceOf(gameContract.address);
      expect(managerBalanceAfter).to.equal(managerBalanceBefore.add(ethAmount));
    });
    it("buy gameETH for player2", async () => {
      const ethAmount = convertCoinToETH(MAX_COINS_AMOUNT);
      const predictedCoinsAmount = convertETHtoCoin(ethAmount);
      const managerBalanceBefore = await weth.balanceOf(gameContract.address);
      await gameContract.connect(player2).addGameETH({ value: ethAmount });
      const managerBalanceAfter = await weth.balanceOf(gameContract.address);
      expect(managerBalanceAfter).to.equal(managerBalanceBefore.add(ethAmount));
      const tower = await gameContract.towers(player2.address);
      expect(tower.gameETH).to.equal(predictedCoinsAmount);
      expect(await gameContract.totalTowers()).to.equal(BigNumber.from(2));
    });
    it("should upgrade tower: 1 floor, 1 coder --- by player1", async () => {
      const tower = await gameContract.towers(player1.address);
      await gameContract.connect(player1).upgradeTower(0);
      const newTower = await gameContract.towers(player1.address);
      expect(tower.gameETH.sub(newTower.gameETH)).to.equal(
        BigNumber.from(4340)
      );
      expect(newTower.yields.sub(tower.yields)).to.equal(BigNumber.from(4670));
      const coders = await gameContract.getBuilders(player1.address);
      expect(coders[0]).to.equal(BigNumber.from(1));
    });
    it("should by all floors and coders for player2", async () => {
      for (let i = 0; i < 8; i++) {
        for (let j = 1; j <= 5; j++) {
          await gameContract.connect(player2).upgradeTower(i);
        }
      }
    });
    it("should revert upgrade tower if incorrect floorID", async () => {
      await expect(gameContract.connect(player1).upgradeTower(1)).to.be
        .reverted;
    });
    it("should revert upgrade tower if incorrect floorID", async () => {
      await expect(gameContract.connect(player1).upgradeTower(8)).to.be
        .reverted;
    });
    it("should revert collect if user non registered", async () => {
      await expect(gameContract.connect(player3).collect()).to.be.reverted;
    });

    it("should inrease time for 12 hours and buy all floors for player3", async () => {
      const ethAmount = convertCoinToETH(MAX_COINS_AMOUNT);
      await gameContract.connect(player3).addGameETH({ value: ethAmount });
      for (let i = 0; i < 8; i++) {
        for (let j = 1; j <= 5; j++) {
          await gameContract.connect(player3).upgradeTower(i);
        }
      }
      await ethers.provider.send("evm_increaseTime", [48 * 60 * 60]);
    });
    it("should collect gameETH for player2", async () => {
      const towerInfoBefore = await gameContract.towers(player2.address);
      await gameContract.connect(player2).collect();
      const towerInfoAfter = await gameContract.towers(player2.address);
      expect(towerInfoAfter.gameETHCollected).to.be.equal(BigNumber.from(0));
      expect(towerInfoAfter.gameETH).to.be.gt(towerInfoBefore.gameETH);
    });

    it("simulate game flow for 10 users", async () => {
      for (let k = 0; k < 10; k++) {
        await gameContract.connect(accounts[k]).addGameETH({
          value: convertCoinToETH(MAX_COINS_AMOUNT),
        });
        for (let i = 0; i < 8; i++) {
          for (let j = 1; j <= 5; j++) {
            await gameContract.connect(accounts[k]).upgradeTower(i);
          }
        }
        await ethers.provider.send("evm_increaseTime", [48 * 60 * 60]);
      }
    });
    it("collect gameETH for all users", async () => {
      for (let k = 0; k < 10; k++) {
        await gameContract.connect(accounts[k]).collect();
      }
    });
    it("should revert by floor for player2 if already bought", async () => {
      await expect(gameContract.connect(player2).upgradeTower(0)).to.be
        .reverted;
    });
    it("simulate game flow for 5 users", async () => {
      for (let k = 10; k < 16; k++) {
        await gameContract.connect(accounts[k]).addGameETH({
          value: convertCoinToETH(MAX_COINS_AMOUNT),
        });
        for (let i = 0; i < 8; i++) {
          for (let j = 1; j <= 5; j++) {
            await gameContract.connect(accounts[k]).upgradeTower(i);
          }
        }
        await ethers.provider.send("evm_increaseTime", [48 * 60 * 60]);
      }
    });
    it("collect gameETH for all users", async () => {
      for (let k = 10; k < 16; k++) {
        await gameContract.connect(accounts[k]).collect();
      }
    });
  });
  describe("Test interaction with UniswapV2 pool", async () => {
    it("should create pool and add liquidity after first claim", async () => {
      const amountAMin = await weth.balanceOf(gameContract.address);
      const amountBMin = ethers.utils.parseEther("10");
      await gameContract
        .connect(player3)
        .claimCodeupERC20(player3.address, amountAMin, amountBMin, 0);

      expect(await gameContract.uniswapV2Pool()).to.be.not.equal(
        ethers.constants.AddressZero
      );
    });
    it("should sell GT for ETH", async () => {
      const balanceETHBefore = await weth.balanceOf(player3.address);

      await gameToken
        .connect(player3)
        .approve(router.address, await gameToken.balanceOf(player3.address));

      await calcGTtoETHRate(gameContract);

      await router
        .connect(player3)
        .swapExactTokensForTokens(
          await gameToken.balanceOf(player3.address),
          0,
          [gameToken.address, weth.address],
          player3.address,
          ethers.constants.MaxUint256
        );
      const balanceETHAfter = await weth.balanceOf(player3.address);
      const balanceGTAfter = await gameToken.balanceOf(player3.address);
      expect(balanceETHAfter).to.be.gt(balanceETHBefore);
      expect(balanceGTAfter).to.be.equal(BigNumber.from(0));

      await calcGTtoETHRate(gameContract);
    });
    it("should revert claim if user already claimed", async () => {
      await expect(
        gameContract.connect(player3).claimCodeupERC20(player3.address, 0, 0, 0)
      ).to.be.reverted;
    });
    it("should claim for user 2", async () => {
      const balanceETHBefore = await weth.balanceOf(player2.address);

      await gameContract
        .connect(player2)
        .claimCodeupERC20(player2.address, 0, 0, 0);
      await gameToken
        .connect(player2)
        .approve(UniswapV2Router, await gameToken.balanceOf(player2.address));

      await router
        .connect(player2)
        .swapExactTokensForTokens(
          await gameToken.balanceOf(player2.address),
          0,
          [gameToken.address, weth.address],
          player2.address,
          ethers.constants.MaxUint256
        );

      const balanceETHAfter = await await weth.balanceOf(player2.address);
      const balanceGTAfter = await gameToken.balanceOf(player2.address);
      expect(balanceETHAfter).to.be.gt(balanceETHBefore);
      expect(balanceGTAfter).to.be.equal(BigNumber.from(0));
    });
    it("should revert claim if user didn't buy all floors", async () => {
      await expect(
        gameContract.connect(player1).claimCodeupERC20(player1.address, 0, 0, 0)
      ).to.be.reverted;
    });
    it("should claim and don't add liquidity if weth balance == 0", async () => {
      await gameContract
        .connect(accounts[10])
        .claimCodeupERC20(accounts[10].address, 0, 0, 0);
      const balanceWETH = await weth.balanceOf(gameContract.address);
      expect(balanceWETH).to.be.equal(BigNumber.from(0));
    });
  });
  describe("Test incorrect yield calculation", async () => {
    it("should revert _getYield if passed incorrect builder", async () => {
      const TEST_CODEUP_FACTORY = await ethers.getContractFactory("TestCodeup");
      const testGame = await TEST_CODEUP_FACTORY.deploy(
        1,
        COINS_PRICE,
        MAX_AMOUNT_FOR_WINNER,
        UniswapV2Router,
        gameToken.address,
        deployer.address
      );

      await expect(testGame.getYield(1, 6)).to.be.revertedWith(
        "IncorrectBuilderId()"
      );
    });
  });
  describe("Test additional checks", async () => {
    let game: Codeup;
    let gameToken: CodeupERC20;
    before(async () => {
      const CODEUP_FACTORY = await ethers.getContractFactory("Codeup");
      const CODEUP_TOKEN_FACTORY = await ethers.getContractFactory(
        "CodeupERC20"
      );

      gameToken = await CODEUP_TOKEN_FACTORY.deploy(
        deployer.address,
        "GT",
        "GT"
      );
      await gameToken.deployed();

      game = await CODEUP_FACTORY.deploy(
        1,
        COINS_PRICE,
        MAX_AMOUNT_FOR_WINNER,
        UniswapV2Router,
        gameToken.address,
        deployer.address
      );
      await game.deployed();
      await gameToken.transfer(
        game.address,
        await gameToken.balanceOf(deployer.address)
      );
    });

    it("should create pool", async () => {
      const ethAmount = ethers.utils.parseEther("0.0009");
      await game.connect(player3).addGameETH({ value: ethAmount });

      const tower1 = await game.towers(player3.address);
      await game.connect(player3).upgradeTower(0);
      await ethers.provider.send("evm_increaseTime", [48 * 60 * 60]);
      await game.connect(player3).collect();

      const tower2 = await game.towers(player3.address);
      const maxGameETH = await game.MAX_GAMEETH_FOR_BUYING();
      const firstFloorPrice = BigNumber.from(4340);
      const earnPerPeriod = tower2.gameETH
        .add(firstFloorPrice)
        .sub(tower1.gameETH);
      const totalPeriods = maxGameETH.div(earnPerPeriod).add(BigNumber.from(1));
      const periods = totalPeriods.toNumber();

      for (let i = 0; i < periods; i++) {
        await game.connect(player3).collect();
        await ethers.provider.send("evm_increaseTime", [3600]);
      }

      for (let i = 1; i < 5; i++) {
        await game.connect(player3).upgradeTower(0);
      }

      for (let i = 1; i < 8; i++) {
        for (let j = 1; j <= 5; j++) {
          await game.connect(player3).upgradeTower(i);
        }
      }

      expect(await weth.balanceOf(game.address)).to.be.lt(
        ethers.utils.parseEther("0.001")
      );
      await game.connect(player3).claimCodeupERC20(player3.address, 0, 0, 0);
      expect(await weth.balanceOf(game.address)).to.be.equal(0);
    });
    it("should addGameETH more", async () => {
      const ethAmount = convertCoinToETH(MAX_COINS_AMOUNT);
      const wethBalanceBefore = await weth.balanceOf(game.address);
      await game
        .connect(player1)
        .addGameETH({ value: ethAmount.mul(BigNumber.from("2")) });
      const wethBalanceAfter = await weth.balanceOf(game.address);
      expect(wethBalanceAfter).to.equal(
        wethBalanceBefore.add(ethAmount.mul(BigNumber.from("2")))
      );
    });
    it("should force add liquidity to pool", async () => {
      const ethAmount = convertCoinToETH(MAX_COINS_AMOUNT);
      await game.connect(accounts[4]).addGameETH({ value: ethAmount });

      await ethers.provider.send("evm_increaseTime", [3600 * 24 * 8]);
      await game.connect(accounts[4]).forceAddLiquidityToPool(0, 0, 0);
    });
    it("should revert force add liquidity if liquidity already added", async () => {
      const ethAmount = convertCoinToETH(MAX_COINS_AMOUNT);
      await game.connect(player2).addGameETH({ value: ethAmount });
      for (let i = 0; i < 8; i++) {
        for (let j = 1; j <= 5; j++) {
          await game.connect(player2).upgradeTower(i);
        }
      }
      await expect(game.forceAddLiquidityToPool(0, 0, 0)).to.be.reverted;
    });
    it("should revert updating reward amount for winner if caller is not owner", async () => {
      await expect(game.connect(player1).updateTokenAmountForWinner(1)).to.be
        .reverted;
    });
    it("should update reward amount for winner", async () => {
      await game.updateTokenAmountForWinner(1);
      const newAmount = await game.tokenAmountForWinner();
      expect(newAmount).to.equal(BigNumber.from(1));
    });
  });
});
