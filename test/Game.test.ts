import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ButerinTower, USDT } from "../typechain-types";

const getCurrentTimeStamp = async () => {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
};

const convertUSDTtoCoin = (usdtAmount: BigNumber) => {
  return usdtAmount.div(ethers.utils.parseUnits("1", 4));
};

const calcManagerFee = (usdtAmount: BigNumber) => {
  return usdtAmount.mul(BigNumber.from(10)).div(BigNumber.from(100));
};
describe("CryptoPlatform tests", function () {
  let gameContract: ButerinTower;
  let usdt: USDT;
  let manager: SignerWithAddress;
  let player1: SignerWithAddress;
  let player2: SignerWithAddress;
  let player3: SignerWithAddress;
  let accounts: SignerWithAddress[];
  before(async () => {
    const [acc1, acc2, acc3, acc4, ...others] = await ethers.getSigners();
    manager = acc1;
    player1 = acc2;
    player2 = acc3;
    player3 = acc4;
    accounts = others;

    const GAME_FACTORY = await ethers.getContractFactory("ButerinTower");
    const USDT_FACTORY = await ethers.getContractFactory("USDT");
    usdt = await USDT_FACTORY.deploy(
      "USDT Coin",
      "USDT",
      6,
      ethers.utils.parseUnits("1000000", 6)
    );
    await usdt.deployed();

    gameContract = (await GAME_FACTORY.deploy(
      1,
      manager.address,
      usdt.address
    )) as ButerinTower;
    await gameContract.deployed();
  });
  describe("Deployment", async () => {
    it("should revert deploy if start time is 0", async () => {
      const GAME_FACTORY = await ethers.getContractFactory("ButerinTower");
      await expect(GAME_FACTORY.deploy(0, manager.address, usdt.address)).to.be
        .reverted;
    });
    it("should revert deploy if manager is zero address", async () => {
      const GAME_FACTORY = await ethers.getContractFactory("ButerinTower");
      await expect(
        GAME_FACTORY.deploy(1, ethers.constants.AddressZero, usdt.address)
      ).to.be.reverted;
    });
    it("should revert deploy if usdt is zero address", async () => {
      const GAME_FACTORY = await ethers.getContractFactory("ButerinTower");
      await expect(
        GAME_FACTORY.deploy(1, manager.address, ethers.constants.AddressZero)
      ).to.be.reverted;
    });
  });
  describe("Game flow", async () => {
    it("should build a tower and pay fee for manager", async () => {
      const usdtAmount = ethers.utils.parseUnits("1000", 6);
      await usdt.transfer(player1.address, usdtAmount);
      await usdt.connect(player1).approve(gameContract.address, usdtAmount);
      const predictedCoinsAmount = convertUSDTtoCoin(usdtAmount);
      const predictedFee = calcManagerFee(usdtAmount);
      const managerBalanceBefore = await usdt.balanceOf(manager.address);
      await gameContract
        .connect(player1)
        .addCoins(ethers.constants.AddressZero, usdtAmount);
      const managerBalanceAfter = await usdt.balanceOf(manager.address);
      expect(managerBalanceAfter).to.equal(
        managerBalanceBefore.add(predictedFee)
      );
      const tower = await gameContract.towers(player1.address);
      expect(tower.coins).to.equal(predictedCoinsAmount);
      expect(tower.ref).to.be.equals(manager.address);
      expect(await gameContract.totalTowers()).to.equal(BigNumber.from(1));
      expect(await gameContract.totalInvested()).to.be.equal(usdtAmount);
    });
    it("should revert buy coins if amount is zero", async () => {
      await expect(
        gameContract.connect(player1).addCoins(ethers.constants.AddressZero, 0)
      ).to.be.revertedWith("Zero coins");
    });
    it("should revert buy coins if game not started", async () => {
      const gameFactorty = await ethers.getContractFactory("ButerinTower");
      const currentTime = await getCurrentTimeStamp();
      const game = await gameFactorty.deploy(
        currentTime + 60 * 60 * 24 * 30,
        manager.address,
        usdt.address
      );
      await game.deployed();

      const usdtAmount = ethers.utils.parseUnits("1000", 6);
      await usdt.transfer(player1.address, usdtAmount);
      await usdt.connect(player1).approve(game.address, usdtAmount);
      await expect(
        game.connect(player1).addCoins(ethers.constants.AddressZero, usdtAmount)
      ).to.be.revertedWith("We are not live yet!");
    });
    it("buy coins again for player1", async () => {
      const usdtAmount = ethers.utils.parseUnits("1000", 6);
      await usdt.transfer(player1.address, usdtAmount);
      await usdt.connect(player1).approve(gameContract.address, usdtAmount);
      const predictedFee = calcManagerFee(usdtAmount);
      const managerBalanceBefore = await usdt.balanceOf(manager.address);
      await gameContract
        .connect(player1)
        .addCoins(ethers.constants.AddressZero, usdtAmount);
      const managerBalanceAfter = await usdt.balanceOf(manager.address);
      expect(managerBalanceAfter).to.equal(
        managerBalanceBefore.add(predictedFee)
      );
    });
    it("buy coins for player2, ref = player1", async () => {
      const usdtAmount = ethers.utils.parseUnits("1000", 6);
      await usdt.transfer(player2.address, usdtAmount);
      await usdt.connect(player2).approve(gameContract.address, usdtAmount);
      const predictedCoinsAmount = convertUSDTtoCoin(usdtAmount);
      const predictedFee = calcManagerFee(usdtAmount);
      const managerBalanceBefore = await usdt.balanceOf(manager.address);
      await gameContract.connect(player2).addCoins(player1.address, usdtAmount);
      const managerBalanceAfter = await usdt.balanceOf(manager.address);
      expect(managerBalanceAfter).to.equal(
        managerBalanceBefore.add(predictedFee)
      );
      const tower = await gameContract.towers(player2.address);
      expect(tower.coins).to.equal(predictedCoinsAmount);
      expect(tower.ref).to.be.equals(player1.address);
      expect(await gameContract.totalTowers()).to.equal(BigNumber.from(2));
    });
    it("should upgrade tower: 1 floor, 1 coder --- by player1", async () => {
      const tower = await gameContract.towers(player1.address);
      await gameContract.connect(player1).upgradeTower(0);
      const newTower = await gameContract.towers(player1.address);
      expect(tower.coins.sub(newTower.coins)).to.equal(BigNumber.from(500));
      expect(newTower.yield.sub(tower.yield)).to.equal(BigNumber.from(41));
      const coders = await gameContract.getCoders(player1.address);
      expect(coders[0]).to.equal(BigNumber.from(1));
    });
    it("should by all floors and coders for player2", async () => {
      await usdt["mintTo(address,uint256)"](
        player2.address,
        ethers.utils.parseUnits("1000000000000", 6)
      );
      await usdt
        .connect(player2)
        .approve(
          gameContract.address,
          ethers.utils.parseUnits("1000000000000", 6)
        );
      await gameContract
        .connect(player2)
        .addCoins(player1.address, ethers.utils.parseUnits("1000000000000", 6));
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
      await expect(
        gameContract.connect(player3).collectMoney()
      ).to.be.revertedWith("User is not registered");
    });
    it("should return ref earnings for player1", async () => {
      const refEarning = await gameContract.getRefEarning(player1.address);
      expect(refEarning._refEarning[0]).to.be.gt(BigNumber.from(0));
    });
    it("should inrease time for 12 hours and buy all floors for player3", async () => {
      await usdt["mintTo(address,uint256)"](
        player3.address,
        ethers.utils.parseUnits("1000000000000", 6)
      );
      await usdt
        .connect(player3)
        .approve(
          gameContract.address,
          ethers.utils.parseUnits("1000000000000", 6)
        );
      await gameContract
        .connect(player3)
        .addCoins(player1.address, ethers.utils.parseUnits("1000000000000", 6));
      for (let i = 0; i < 8; i++) {
        for (let j = 1; j <= 5; j++) {
          await gameContract.connect(player3).upgradeTower(i);
        }
      }
      await ethers.provider.send("evm_increaseTime", [48 * 60 * 60]);
    });
    it("should collect money for player2", async () => {
      const towerInfoBefore = await gameContract.towers(player2.address);
      await gameContract.connect(player2).collectMoney();
      const towerInfoAfter = await gameContract.towers(player2.address);
      expect(towerInfoAfter.money2).to.be.equal(BigNumber.from(0));
      expect(towerInfoAfter.money).to.be.gt(towerInfoBefore.money);
    });
    it("should increase time for 12 hours and withdraw money for player2", async () => {
      await ethers.provider.send("evm_increaseTime", [48 * 60 * 60]);
      const balanceBefore = await usdt.balanceOf(player2.address);
      await gameContract.connect(player2).withdrawMoney();
      const balanceAfter = await usdt.balanceOf(player2.address);
      const towerInfoAfter = await gameContract.towers(player2.address);
      expect(towerInfoAfter.money).to.be.equal(BigNumber.from(0));
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
    it("simulate game flow for 10 users", async () => {
      for (let k = 0; k < 10; k++) {
        await usdt["mintTo(address,uint256)"](
          accounts[k].address,
          ethers.utils.parseUnits("1000000000000", 6)
        );
        await usdt
          .connect(accounts[k])
          .approve(
            gameContract.address,
            ethers.utils.parseUnits("1000000000000", 6)
          );
        await gameContract
          .connect(accounts[k])
          .addCoins(
            accounts[k].address,
            ethers.utils.parseUnits("1000000000000", 6)
          );
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
        await gameContract.connect(accounts[k]).collectMoney();
      }
    });
    it("should revert by floor for player2 if already bought", async () => {
      await expect(
        gameContract.connect(player2).upgradeTower(0)
      ).to.be.revertedWith("Incorrect chefId");
    });
    it("simulate game flow for 5 users", async () => {
      for (let k = 10; k < 16; k++) {
        await usdt["mintTo(address,uint256)"](
          accounts[k].address,
          ethers.utils.parseUnits("1000000000000", 6)
        );
        await usdt
          .connect(accounts[k])
          .approve(
            gameContract.address,
            ethers.utils.parseUnits("1000000000000", 6)
          );
        await gameContract
          .connect(accounts[k])
          .addCoins(
            accounts[k].address,
            ethers.utils.parseUnits("1000000000000", 6)
          );
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
        await gameContract.connect(accounts[k]).collectMoney();
      }
    });
    it("should withdraw money for all users", async () => {
      for (let k = 0; k < 16; k++) {
        await gameContract.connect(accounts[k]).withdrawMoney();
      }
    });
    it("should withdraw money for player2", async () => {
      await ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 30]);
      await ethers.provider.send("evm_mine", []);
      const balanceBefore = await usdt.balanceOf(player2.address);
      await gameContract.connect(player2).collectMoney();
      await gameContract.connect(player2).withdrawMoney();
      const balanceAfter = await usdt.balanceOf(player2.address);
      expect(balanceAfter).to.be.gte(balanceBefore);
    });
  });
});
