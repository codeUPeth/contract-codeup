import { ethers } from "hardhat";
import { verifyContract } from "./verify";
import { Codeup } from "../typechain-types";

const MANAGER_ADDRESS = "0xF94AeE7BD5bdfc249746edF0C6Fc0F5E3c1DA226";
const COINS_PRICE = ethers.utils.parseEther("0.000001");
const startTimeUnix = "1";

async function main() {
  const GAME_FACTORY = await ethers.getContractFactory("Codeup");
  const NFT_COLLECTION_FACTORY = await ethers.getContractFactory(
    "CodeupErc1155"
  );
  const game: Codeup = await GAME_FACTORY.deploy(
    startTimeUnix,
    MANAGER_ADDRESS,
    COINS_PRICE
  );
  await game.deployTransaction.wait(5);
  console.log("Game deployed to:", game.address);

  const collection = await NFT_COLLECTION_FACTORY.deploy(
    "https://ipfs.io/ipfs/Qm",
    MANAGER_ADDRESS,
    game.address
  );
  await collection.deployTransaction.wait(5);
  console.log("Collection deployed to:", collection.address);

  try {
    await verifyContract(game.address, [
      startTimeUnix,
      MANAGER_ADDRESS,
      COINS_PRICE,
    ]);
  } catch (error) {
    console.error("Error verifying contract:", error);
  }

  try {
    await verifyContract(collection.address, [
      "https://ipfs.io/ipfs/Qm",
      MANAGER_ADDRESS,
      game.address,
    ]);
  } catch (error) {
    console.error("Error verifying contract:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
