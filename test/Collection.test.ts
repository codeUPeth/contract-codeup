import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ButerinTower, ButerinTowerErc1155 } from "../typechain-types";

const COINS_PRICE = ethers.utils.parseEther("0.000001");

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
describe("CryptoPlatform tests", function () {
  let gameContract: ButerinTower;
  let collection: ButerinTowerErc1155;
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
    const GAME_COLLECTION_FACTORY = await ethers.getContractFactory(
      "ButerinTowerErc1155"
    );

    gameContract = (await GAME_FACTORY.deploy(
      1,
      manager.address,
      COINS_PRICE
    )) as ButerinTower;
    await gameContract.deployed();

    collection = (await GAME_COLLECTION_FACTORY.deploy(
      "hattps://ipfs.io/ipfs/Qm",
      manager.address,
      gameContract.address
    )) as ButerinTowerErc1155;
  });

  describe("Testing collection mint", async function () {
    it("should revert mint if player didn't open all floors", async function () {
      await expect(
        collection.connect(player2).mint(player2.address)
      ).to.be.revertedWith("Mint not allowed");
    });
    it("should open all floors and coders and mint collection", async function () {
      const ethAmount = ethers.utils.parseEther("100");
      await gameContract
        .connect(player2)
        .addCoins(player1.address, { value: ethAmount });
      for (let i = 0; i < 8; i++) {
        for (let j = 1; j <= 5; j++) {
          await gameContract.connect(player2).upgradeTower(i);
        }
      }
      await collection.connect(player2).mint(player2.address);
      const balance = await collection.balanceOf(player2.address, 0);
      expect(balance).to.be.eq(1);
    });
    it("should revert mint if player already minted", async function () {
      await expect(
        collection.connect(player2).mint(player2.address)
      ).to.be.revertedWith("Already minted");
    });
    it("should revert if player didn't open all floors", async function () {
      const ethAmount = ethers.utils.parseEther("100");
      await gameContract
        .connect(player1)
        .addCoins(ethers.constants.AddressZero, { value: ethAmount });
      for (let i = 0; i < 7; i++) {
        for (let j = 1; j <= 5; j++) {
          await gameContract.connect(player1).upgradeTower(i);
        }
      }
      await expect(
        collection.connect(player1).mint(player1.address)
      ).to.be.revertedWith("Mint not allowed");
    });
    it("should update tokenURI", async function () {
      const newURI = "https://ipfs.io/ipfs/game";
      await collection.connect(manager).updateUri(newURI);
      const uri = await collection.uri(0);
      expect(uri).to.be.eq(newURI);
    });
  });
  describe("Update ButterinTower", async function () {
    it("should revert update if not manager", async function () {
      await expect(
        collection.connect(player2).updateButerinTower(player2.address)
      ).to.be.reverted;
    });
    it("should update tower", async function () {
      await collection.connect(manager).updateButerinTower(player2.address);
      const newTower = await collection.buterinTower();
      expect(newTower).to.be.eq(player2.address);
    });
    it("should revert update if passed address is zero", async function () {
      await expect(
        collection
          .connect(manager)
          .updateButerinTower(ethers.constants.AddressZero)
      ).to.be.reverted;
    });
    it("should revert update uri if passed empty string", async function () {
      await expect(collection.connect(manager).updateUri("")).to.be.reverted;
    });
    it("should revert update uri if not manager", async function () {
      await expect(
        collection.connect(player2).updateUri("https://ipfs.io/ipfs/game")
      ).to.be.reverted;
    });
  });
  describe("Deployment tests", async function () {
    it("should revert deploy collection if owner = zero address", async function () {
      const GAME_COLLECTION_FACTORY = await ethers.getContractFactory(
        "ButerinTowerErc1155"
      );
      await expect(
        GAME_COLLECTION_FACTORY.deploy(
          "https://ipfs.io/ipfs/Qm",
          ethers.constants.AddressZero,
          gameContract.address
        )
      ).to.be.reverted;
    });
    it("should revert deploy collection if tower = zero address", async function () {
      const GAME_COLLECTION_FACTORY = await ethers.getContractFactory(
        "ButerinTowerErc1155"
      );
      await expect(
        GAME_COLLECTION_FACTORY.deploy(
          "https://ipfs.io/ipfs/Qm",
          manager.address,
          ethers.constants.AddressZero
        )
      ).to.be.reverted;
    });
    it("should revert deploy collection if uri = empty string", async function () {
      const GAME_COLLECTION_FACTORY = await ethers.getContractFactory(
        "ButerinTowerErc1155"
      );
      await expect(
        GAME_COLLECTION_FACTORY.deploy(
          "",
          manager.address,
          gameContract.address
        )
      ).to.be.reverted;
    });
    it("should deploy collection", async function () {
      const GAME_COLLECTION_FACTORY = await ethers.getContractFactory(
        "ButerinTowerErc1155"
      );
      const collection = await GAME_COLLECTION_FACTORY.deploy(
        "https://ipfs.io/ipfs/Qm",
        manager.address,
        gameContract.address
      );
      await collection.deployed();
      expect(collection.address).to.not.be.undefined;
    });
  });
});
