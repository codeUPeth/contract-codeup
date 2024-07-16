import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { Codeup } from "../typechain-types";
import { WithdrawEvent } from "../typechain-types/contracts/Codeup";

const COINS_PRICE = ethers.utils.parseEther("0.000001");

describe("CryptoPlatform tests", function () {
  let gameContract: Codeup;
  let manager: SignerWithAddress;
  let player1: SignerWithAddress;
  before(async () => {
    const [acc1, acc2] = await ethers.getSigners();
    manager = acc1;
    player1 = acc2;

    const GAME_FACTORY = await ethers.getContractFactory("Codeup");

    gameContract = (await GAME_FACTORY.deploy(
      1,
      manager.address,
      COINS_PRICE
    )) as Codeup;
    await gameContract.deployed();
    await gameContract.connect(player1).addCoins(ethers.constants.AddressZero, {
      value: ethers.utils.parseEther("1000"),
    });
  });

  describe("Testing earnings relative to time", async function () {
    it("cycle test", async function () {
      for (let i = 0; i < 8; i++) {
        for (let j = 1; j <= 5; j++) {
          await gameContract.connect(player1).upgradeTower(i);
          await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
          await ethers.provider.send("evm_mine", []);
          await gameContract.connect(player1).collectMoney();
          const userTower = await gameContract.towers(player1.address);
          const predictedAmount = userTower.yields.mul(BigNumber.from(24));
          const moneyRate = await gameContract.moneyRate();
          expect(userTower.money).to.be.eq(predictedAmount);
          const ethAmount = userTower.money.mul(moneyRate);

          const withdrawTx = await gameContract
            .connect(player1)
            .withdrawMoney();
          const withdrawReceipt = await withdrawTx.wait();
          const withdrawEvent = withdrawReceipt.events?.find(
            (event) => event.event === "Withdraw"
          ) as WithdrawEvent;
          const withdrawAmount = withdrawEvent.args?.amount as BigNumber;
          console.log(
            `Floor ${
              i + 1
            }, Coders ${j}, Earned by 24 hours: ${ethers.utils.formatEther(
              ethAmount
            )} ETH`
          );
          expect(withdrawAmount).to.be.eq(ethAmount);
        }
      }
    });
  });
});
