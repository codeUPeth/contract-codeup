import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ERC20, CodeupERC20, Codeup } from "../typechain-types";
import { ROUTER } from "./abis";

const COINS_PRICE = ethers.utils.parseEther("0.000001");

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
    it("should revert deploy if coins price is 0", async () => {
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
      await gameContract.connect(player1).addCUP({ value: ethAmount });
      const wethBalanceAfter = await weth.balanceOf(gameContract.address);
      expect(wethBalanceAfter).to.equal(wethBalanceBefore.add(predictedFee));

      const tower = await gameContract.towers(player1.address);
      expect(tower.cup).to.equal(predictedCoinsAmount);
      expect(await gameContract.totalTowers()).to.equal(BigNumber.from(1));
      expect(await gameContract.totalInvested()).to.be.equal(ethAmount);
    });
    it("should revert buy coins if amount is zero", async () => {
      await expect(
        gameContract.connect(player1).addCUP({ value: 0 })
      ).to.be.revertedWith("Zero cup amount");
    });
    it("should revert buy coins if game not started", async () => {
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
      await expect(
        game.connect(player1).addCUP({ value: ethAmount })
      ).to.be.revertedWith("We are not live yet!");
    });
    it("buy coins again for player1", async () => {
      const ethAmount = ethers.utils.parseEther("1");
      const predictedFee = calcManagerFee(ethAmount);
      const managerBalanceBefore = await weth.balanceOf(gameContract.address);
      await gameContract.connect(player1).addCUP({ value: ethAmount });
      const managerBalanceAfter = await weth.balanceOf(gameContract.address);
      expect(managerBalanceAfter).to.equal(
        managerBalanceBefore.add(predictedFee)
      );
    });
    it("buy coins for player2, ref = player1", async () => {
      const ethAmount = ethers.utils.parseEther("1");
      const predictedCoinsAmount = convertETHtoCoin(ethAmount);
      const predictedFee = calcManagerFee(ethAmount);
      const managerBalanceBefore = await weth.balanceOf(gameContract.address);
      await gameContract.connect(player2).addCUP({ value: ethAmount });
      const managerBalanceAfter = await weth.balanceOf(gameContract.address);
      expect(managerBalanceAfter).to.equal(
        managerBalanceBefore.add(predictedFee)
      );
      const tower = await gameContract.towers(player2.address);
      expect(tower.cup).to.equal(predictedCoinsAmount);
      expect(await gameContract.totalTowers()).to.equal(BigNumber.from(2));
    });
    it("should upgrade tower: 1 floor, 1 coder --- by player1", async () => {
      const tower = await gameContract.towers(player1.address);
      await gameContract.connect(player1).upgradeTower(0);
      const newTower = await gameContract.towers(player1.address);
      expect(tower.cup.sub(newTower.cup)).to.equal(BigNumber.from(434));
      expect(newTower.yields.sub(tower.yields)).to.equal(BigNumber.from(467));
      const coders = await gameContract.getBuilders(player1.address);
      expect(coders[0]).to.equal(BigNumber.from(1));
    });
    it("should by all floors and coders for player2", async () => {
      const ethAmount = ethers.utils.parseEther("100");
      await gameContract.connect(player2).addCUP({ value: ethAmount });
      for (let i = 0; i < 8; i++) {
        for (let j = 1; j <= 5; j++) {
          await gameContract.connect(player2).upgradeTower(i);
        }
      }
    });
    it("should revert upgrade tower: 2 floor, 1 coder --- by player1", async () => {
      await expect(
        gameContract.connect(player1).upgradeTower(1)
      ).to.be.revertedWith("Need to buy previous tower");
    });
    it("should revert upgrade tower: 9 floor, 1 coder --- by player1", async () => {
      await expect(
        gameContract.connect(player1).upgradeTower(8)
      ).to.be.revertedWith("Max 8 floors");
    });
    it("should revert collectMoney if user non registered", async () => {
      await expect(gameContract.connect(player3).collect()).to.be.revertedWith(
        "User is not registered"
      );
    });

    it("should inrease time for 12 hours and buy all floors for player3", async () => {
      await gameContract
        .connect(player3)
        .addCUP({ value: ethers.utils.parseEther("100") });
      for (let i = 0; i < 8; i++) {
        for (let j = 1; j <= 5; j++) {
          await gameContract.connect(player3).upgradeTower(i);
        }
      }
      await ethers.provider.send("evm_increaseTime", [48 * 60 * 60]);
    });
    it("should collect money for player2", async () => {
      const towerInfoBefore = await gameContract.towers(player2.address);
      await gameContract.connect(player2).collect();
      const towerInfoAfter = await gameContract.towers(player2.address);
      expect(towerInfoAfter.cupCollected).to.be.equal(BigNumber.from(0));
      expect(towerInfoAfter.cupForWithdraw).to.be.gt(
        towerInfoBefore.cupForWithdraw
      );
    });
    it("should increase time for 12 hours and withdraw money for player2", async () => {
      await ethers.provider.send("evm_increaseTime", [48 * 60 * 60]);
      const balanceBefore = await ethers.provider.getBalance(player2.address);
      await gameContract.connect(player2).withdraw();
      const balanceAfter = await ethers.provider.getBalance(player2.address);
      const towerInfoAfter = await gameContract.towers(player2.address);
      expect(towerInfoAfter.cupForWithdraw).to.be.equal(BigNumber.from(0));
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
    it("simulate game flow for 10 users", async () => {
      for (let k = 0; k < 10; k++) {
        await gameContract.connect(accounts[k]).addCUP({
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
    it("collect money for all users", async () => {
      for (let k = 0; k < 10; k++) {
        await gameContract.connect(accounts[k]).collect();
      }
    });
    it("should revert by floor for player2 if already bought", async () => {
      await expect(
        gameContract.connect(player2).upgradeTower(0)
      ).to.be.revertedWith("Incorrect builderId");
    });
    it("simulate game flow for 5 users", async () => {
      for (let k = 10; k < 16; k++) {
        await gameContract.connect(accounts[k]).addCUP({
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
    it("collect money for all users", async () => {
      for (let k = 10; k < 16; k++) {
        await gameContract.connect(accounts[k]).collect();
      }
    });
    it("should withdraw money for all users", async () => {
      for (let k = 0; k < 16; k++) {
        await gameContract.connect(accounts[k]).withdraw();
      }
    });
    it("should withdraw money for player2", async () => {
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
      await gameContract.connect(player3).claimCodeupERC20(player3.address);

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
        gameContract.connect(player3).claimCodeupERC20(player3.address)
      ).to.be.revertedWith("Already Claimed");
    });
    it("should claim for user 2", async () => {
      await gameContract
        .connect(player2)
        .addCUP({ value: ethers.utils.parseEther("100") });
      const balanceETHBefore = await weth.balanceOf(player2.address);

      await gameContract.connect(player2).claimCodeupERC20(player2.address);
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
        gameContract.connect(player1).claimCodeupERC20(player1.address)
      ).to.be.revertedWith("Claim Forbidden");
    });
    it("should claim and don't add liquidity if weth balance == 0", async () => {
      await gameContract
        .connect(accounts[10])
        .claimCodeupERC20(accounts[10].address);
      const balanceWETH = await weth.balanceOf(gameContract.address);
      expect(balanceWETH).to.be.equal(BigNumber.from(0));
    });
    it("should reinvest earned money to coins", async () => {
      const user = accounts[15];
      await gameContract
        .connect(user)
        .addCUP({ value: ethers.utils.parseEther("1") });

      /// increase time for 24 minutes
      const towerStatsBefore = await gameContract.towers(user.address);
      await ethers.provider.send("evm_increaseTime", [16 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await gameContract.connect(user).collect();
      await gameContract.connect(user).reinvest();
      const towerStatsAfter = await gameContract.towers(user.address);
      expect(towerStatsAfter.cup).to.be.gt(towerStatsBefore.cup);
    });
    it("should revert reinvest if user has no money", async () => {
      await expect(
        gameContract.connect(accounts[15]).reinvest()
      ).to.be.revertedWith("No cup to reinvest");
    });
  });
});
