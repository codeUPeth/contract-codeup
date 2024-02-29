import { ethers } from "hardhat";
import { verifyContract } from "./verify";

const MANAGER_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const USDT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const startTimeUnix = new Date().getTime() / 1000 + 60 * 60 * 24 * 7; // 7 days from now

async function main() {
  const GAME_FACTORY = await ethers.getContractFactory("ButerinTower");
  const game = await GAME_FACTORY.deploy(
    MANAGER_ADDRESS,
    USDT_ADDRESS,
    startTimeUnix.toString()
  );
  await game.deployed();
  console.log("Game deployed to:", game.address);

  try {
    await verifyContract(game.address, [
      MANAGER_ADDRESS,
      USDT_ADDRESS,
      startTimeUnix.toString(),
    ]);
  } catch (error) {
    console.error("Error verifying contract:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
