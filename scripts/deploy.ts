import { ethers } from "hardhat";
import { Codeup } from "../typechain-types";
import { verifyContract } from "./verify";

const COINS_PRICE = ethers.utils.parseEther("0.000001");
const startTimeUnix = "1";
const deployer = "0x450A9E4745c27773698D28cCbE4F9fE388a931F3";

const VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
const WEIGHTED_POOL_FACTORY = "0xc7E5ED1054A24Ef31D827E6F86caA58B3Bc168d7";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

async function main() {
  const GAME_FACTORY = await ethers.getContractFactory("Codeup");
  const GAME_TOKEN_FACTORY = await ethers.getContractFactory("CodeupERC20");
  console.log("Deploying contracts with the account:", deployer);
  const gameToken = await GAME_TOKEN_FACTORY.deploy(
    deployer,
    "GameToken",
    "GT"
  );
  await gameToken.deployTransaction.wait(5);
  console.log("GameToken deployed to:", gameToken.address);

  const tokens = [WETH, gameToken.address].sort(function (a, b) {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });
  const game: Codeup = await GAME_FACTORY.deploy(
    startTimeUnix,
    COINS_PRICE,
    WEIGHTED_POOL_FACTORY,
    gameToken.address,
    VAULT,
    tokens,
    [ethers.utils.parseUnits("0.5", "18"), ethers.utils.parseUnits("0.5", "18")]
  );
  await game.deployTransaction.wait(5);
  console.log("Game deployed to:", game.address);

  await gameToken.transfer(game.address, await gameToken.balanceOf(deployer));

  try {
    await verifyContract(gameToken.address, [deployer, "GameToken", "GT"]);
  } catch (error) {
    console.error("Error verifying contract:", error);
  }

  try {
    await verifyContract(game.address, [
      startTimeUnix,
      COINS_PRICE,
      WEIGHTED_POOL_FACTORY,
      gameToken.address,
      VAULT,
      tokens,
      [
        ethers.utils.parseUnits("0.5", "18"),
        ethers.utils.parseUnits("0.5", "18"),
      ],
    ]);
  } catch (error) {
    console.error("Error verifying contract:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
