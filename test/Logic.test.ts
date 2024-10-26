import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ERC20, CodeupERC20, Codeup } from "../typechain-types";
import { ROUTER } from "./abis";

const COINS_PRICE = ethers.utils.parseEther("0.0000001");

const UniswapV2Router = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24";

const getCurrentTimeStamp = async () => {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
};

const convertETHtoCoin = (ethAmount: BigNumber) => {
  return ethAmount.div(COINS_PRICE);
};

const calcManagerFee = (ethAmount: BigNumber) => {
  return ethAmount.mul(BigNumber.from(10)).div(BigNumber.from(100));
};

const calcGTtoETHRate = async (game: Codeup) => {
  const router = await ethers.getContractAt(ROUTER, UniswapV2Router);

  const weth = await game.weth();
  const gameToken = await game.codeupERC20();

  const swapAmount = ethers.utils.parseEther("1");

  const wethToGT = await router.getAmountsOut(swapAmount, [weth, gameToken]);
  const wethToGTprice = wethToGT[1];

  const gtToWeth = await router.getAmountsOut(swapAmount, [gameToken, weth]);
  const gtToWETHprice = gtToWeth[1];

  return {
    wethToGTprice,
    gtToWETHprice,
  };
};

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
      UniswapV2Router,
      gameToken.address
    );
    await gameContract.deployed();

    const deployerBalance = await gameToken.balanceOf(deployer.address);
    await gameToken.transfer(gameContract.address, deployerBalance);
  });
  describe("Deployment", async () => {
    it("should revert deploy if start time is 0", async () => {
      const GAME_FACTORY = await ethers.getContractFactory("Codeup");
      await expect(
        GAME_FACTORY.deploy(0, COINS_PRICE, UniswapV2Router, gameToken.address)
      ).to.be.reverted;
    });
    it("should revert deploy if gameETH price is 0", async () => {
      const GAME_FACTORY = await ethers.getContractFactory("Codeup");
      await expect(
        GAME_FACTORY.deploy(1, 0, UniswapV2Router, gameToken.address)
      ).to.be.reverted;
    });
  });
  describe("Game flow", async () => {
    it("should build a tower ", async () => {
      const ethAmount = ethers.utils.parseEther("1");
      const predictedCoinsAmount = convertETHtoCoin(ethAmount);
      const predictedFee = calcManagerFee(ethAmount);
      const wethBalanceBefore = await weth.balanceOf(gameContract.address);
      await gameContract.connect(player1).addGameETH({ value: ethAmount });
      const wethBalanceAfter = await weth.balanceOf(gameContract.address);
      expect(wethBalanceAfter).to.equal(wethBalanceBefore.add(predictedFee));

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
        UniswapV2Router,
        gameToken.address
      );
      await game.deployed();

      const ethAmount = ethers.utils.parseEther("1");
      await expect(game.connect(player1).addGameETH({ value: ethAmount })).to.be
        .reverted;
      await expect(game.connect(player1).upgradeTower(0)).to.be.reverted;
      await expect(game.connect(player1).collect()).to.be.reverted;
      await expect(game.connect(player1).withdraw()).to.be.reverted;
      await expect(game.connect(player1).reinvest()).to.be.reverted;
      await expect(
        game.connect(player1).claimCodeupERC20(player1.address, 0, 0, 0)
      ).to.be.reverted;
    });
    it("buy gameETH again for player1", async () => {
      const ethAmount = ethers.utils.parseEther("1");
      const predictedFee = calcManagerFee(ethAmount);
      const managerBalanceBefore = await weth.balanceOf(gameContract.address);
      await gameContract.connect(player1).addGameETH({ value: ethAmount });
      const managerBalanceAfter = await weth.balanceOf(gameContract.address);
      expect(managerBalanceAfter).to.equal(
        managerBalanceBefore.add(predictedFee)
      );
    });
    it("buy gameETH for player2", async () => {
      const ethAmount = ethers.utils.parseEther("1");
      const predictedCoinsAmount = convertETHtoCoin(ethAmount);
      const predictedFee = calcManagerFee(ethAmount);
      const managerBalanceBefore = await weth.balanceOf(gameContract.address);
      await gameContract.connect(player2).addGameETH({ value: ethAmount });
      const managerBalanceAfter = await weth.balanceOf(gameContract.address);
      expect(managerBalanceAfter).to.equal(
        managerBalanceBefore.add(predictedFee)
      );
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
      const ethAmount = ethers.utils.parseEther("100");
      await gameContract.connect(player2).addGameETH({ value: ethAmount });
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
      await gameContract
        .connect(player3)
        .addGameETH({ value: ethers.utils.parseEther("100") });
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
      expect(towerInfoAfter.gameETHForWithdraw).to.be.gt(
        towerInfoBefore.gameETHForWithdraw
      );
    });
    it("should increase time for 12 hours and withdraw gameETH for player2", async () => {
      await ethers.provider.send("evm_increaseTime", [48 * 60 * 60]);
      const balanceBefore = await ethers.provider.getBalance(player2.address);
      await gameContract.connect(player2).withdraw();
      const balanceAfter = await ethers.provider.getBalance(player2.address);
      const towerInfoAfter = await gameContract.towers(player2.address);
      expect(towerInfoAfter.gameETHForWithdraw).to.be.equal(BigNumber.from(0));
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
    it("simulate game flow for 10 users", async () => {
      for (let k = 0; k < 10; k++) {
        await gameContract.connect(accounts[k]).addGameETH({
          value: ethers.utils.parseEther("100"),
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
          value: ethers.utils.parseEther("100"),
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
    it("should withdraw gameETH for all users", async () => {
      for (let k = 0; k < 16; k++) {
        await gameContract.connect(accounts[k]).withdraw();
      }
    });
    it("should withdraw gameETH for player2", async () => {
      await ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 30]);
      await ethers.provider.send("evm_mine", []);
      const balanceBefore = await ethers.provider.getBalance(player2.address);
      await gameContract.connect(player2).collect();
      await gameContract.connect(player2).withdraw();
      const balanceAfter = await ethers.provider.getBalance(player2.address);
      expect(balanceAfter).to.be.gte(balanceBefore);
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
      await gameContract
        .connect(player2)
        .addGameETH({ value: ethers.utils.parseEther("100") });
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
    it("should reinvest earned gameETH to coins", async () => {
      const user = accounts[15];
      await gameContract
        .connect(user)
        .addGameETH({ value: ethers.utils.parseEther("1") });

      /// increase time for 24 minutes
      const towerStatsBefore = await gameContract.towers(user.address);
      await ethers.provider.send("evm_increaseTime", [16 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await gameContract.connect(user).collect();
      await gameContract.connect(user).reinvest();
      const towerStatsAfter = await gameContract.towers(user.address);
      expect(towerStatsAfter.gameETH).to.be.gt(towerStatsBefore.gameETH);
    });
    it("should revert reinvest if user has no gameETH", async () => {
      await expect(gameContract.connect(accounts[15]).reinvest()).to.be
        .reverted;
    });
  });
  describe("Test incorrect yield calculation", async () => {
    it("should revert _getYield if passed incorrect builder", async () => {
      const TEST_CODEUP_FACTORY = await ethers.getContractFactory("TestCodeup");
      const testGame = await TEST_CODEUP_FACTORY.deploy(
        1,
        COINS_PRICE,
        UniswapV2Router,
        gameToken.address
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
        UniswapV2Router,
        gameToken.address
      );
      await game.deployed();
    });
    it("should withdraw full contract balance if not enough ETH", async () => {
      const ethAmount = ethers.utils.parseEther("0.02");
      await game.connect(player1).addGameETH({ value: ethAmount });

      for (let i = 0; i < 8; i++) {
        for (let j = 1; j <= 5; j++) {
          await game.connect(player1).upgradeTower(i);
        }
      }

      for (let i = 0; i < 200; i++) {
        await game.connect(player1).collect();
        await game.connect(player1).withdraw();
        await ethers.provider.send("evm_increaseTime", [3600]);
        const balance = await ethers.provider.getBalance(game.address);
        if (balance.eq(0)) {
          break;
        }
      }
    });
    it("should reinvest all eth balance if not enough ETH", async () => {
      const ethAmount = ethers.utils.parseEther("0.01");
      await game.connect(player2).addGameETH({ value: ethAmount });

      for (let i = 0; i < 8; i++) {
        for (let j = 1; j <= 5; j++) {
          await game.connect(player2).upgradeTower(i);
        }
      }

      for (let i = 0; i < 300; i++) {
        await ethers.provider.send("evm_increaseTime", [3600]);
        await game.connect(player2).collect();
        if (i == 224) {
          await expect(game.connect(player2).reinvest()).to.be.reverted;
          break;
        } else {
          await game.connect(player2).reinvest();
        }
      }
    });
  });
});
