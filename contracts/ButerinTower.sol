// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.23;

//███████████████████████████████████████████████████████████████████████████████
//█▄─▄─▀█▄─██─▄█─▄─▄─█▄─▄▄─█▄─▄▄▀█▄─▄█▄─▀█▄─▄███─▄─▄─█─▄▄─█▄─█▀▀▀█─▄█▄─▄▄─█▄─▄▄▀█
//██─▄─▀██─██─████─████─▄█▀██─▄─▄██─███─█▄▀─██████─███─██─██─█─█─█─███─▄█▀██─▄─▄█
//▀▄▄▄▄▀▀▀▄▄▄▄▀▀▀▄▄▄▀▀▄▄▄▄▄▀▄▄▀▄▄▀▄▄▄▀▄▄▄▀▀▄▄▀▀▀▀▄▄▄▀▀▄▄▄▄▀▀▄▄▄▀▄▄▄▀▀▄▄▄▄▄▀▄▄▀▄▄▀

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ButerinTower {
    using SafeERC20 for IERC20;
    struct Tower {
        uint256 coins;
        uint256 money;
        uint256 money2;
        uint256 yield;
        uint256 timestamp;
        uint256 hrs;
        address ref;
        uint256[3] refs;
        uint256[3] refDeps;
        uint8[8] coders;
        uint256 totalCoinsSpend;
        uint256 totalMoneyReceived;
    }
    mapping(address => Tower) public towers;
    uint256 public totalCoders;
    uint256 public totalTowers;
    uint256 public totalInvested;
    address public immutable manager;
    uint256 public startUNIX;
    uint256[] refPercent = [8, 5, 2];
    IERC20 public immutable usdt;

    event TowerCreated(address indexed user, address indexed ref);
    event ProjectFeePaid(address indexed user, uint256 amount);
    event AddCoins(address indexed user, uint256 amount);
    event RefEarning(
        address indexed user,
        uint256 coinsAmount,
        uint256 moneyAmount
    );

    constructor(uint256 startDate, address _manager, address _usdt) {
        require(startDate > 0);
        require(_manager != address(0) && _usdt != address(0));
        startUNIX = startDate;
        manager = _manager;
        usdt = IERC20(_usdt);
    }

    function addCoins(address ref, uint256 tokenAmount) public {
        usdt.safeTransferFrom(msg.sender, address(this), tokenAmount);
        require(block.timestamp > startUNIX, "We are not live yet!");
        uint256 coins = tokenAmount / 1e16;
        require(coins > 0, "Zero coins");
        address user = msg.sender;
        address managerCache = manager;
        totalInvested += tokenAmount;
        bool isNew;
        if (towers[user].timestamp == 0) {
            totalTowers++;
            ref = towers[ref].timestamp == 0 ? managerCache : ref;
            isNew = true;
            towers[user].ref = ref;
            towers[user].timestamp = block.timestamp;
            emit TowerCreated(user, ref);
        }
        refEarning(user, coins, isNew);
        towers[user].coins += coins;
        emit AddCoins(user, coins);
        usdt.safeTransfer(managerCache, (tokenAmount * 10) / 100);
        emit ProjectFeePaid(managerCache, (tokenAmount * 10) / 100);
    }

    function refEarning(address user, uint256 coins, bool isNew) internal {
        uint8 i = 0;
        address ref = towers[user].ref;
        while (i < 3) {
            if (ref == address(0)) {
                break;
            }
            if (isNew) {
                towers[ref].refs[i]++;
            }
            uint256 refTemp = (coins * refPercent[i]) / 100;
            towers[ref].coins += (refTemp * 70) / 100;
            towers[ref].money += (refTemp * 100 * 30) / 100;
            towers[ref].refDeps[i] += refTemp;
            i++;
            ref = towers[ref].ref;
        }
    }

    function withdrawMoney() public {
        address user = msg.sender;
        uint256 money = towers[user].money;
        towers[user].money = 0;
        uint256 amount = money * 1e14;
        usdt.safeTransfer(
            user,
            usdt.balanceOf(address(this)) < amount
                ? usdt.balanceOf(address(this))
                : amount
        );
    }

    function collectMoney() public {
        address user = msg.sender;
        syncTower(user);
        towers[user].hrs = 0;
        towers[user].money += towers[user].money2;

        towers[user].money2 = 0;
    }

    function upgradeTower(uint256 floorId) public {
        require(floorId < 8, "Max 8 floors");
        address user = msg.sender;
        if (floorId > 0) {
            require(
                towers[user].coders[floorId - 1] >= 5,
                "Need to buy previous tower"
            );
        }
        syncTower(user);
        towers[user].coders[floorId]++;
        totalCoders++;
        uint256 chefs = towers[user].coders[floorId];
        towers[user].coins -= getUpgradePrice(floorId, chefs);
        towers[user].totalCoinsSpend += getUpgradePrice(floorId, chefs);
        towers[user].yield += getYield(floorId, chefs);
    }

    function getCoders(address addr) public view returns (uint8[8] memory) {
        return towers[addr].coders;
    }

    function getRefEarning(
        address addr
    )
        public
        view
        returns (uint256[3] memory _refEarning, uint256[3] memory _refCount)
    {
        return (towers[addr].refDeps, towers[addr].refs);
    }

    function syncTower(address user) internal {
        require(towers[user].timestamp > 0, "User is not registered");
        if (towers[user].yield > 0) {
            uint256 hrs = block.timestamp /
                3600 -
                towers[user].timestamp /
                3600;
            if (hrs + towers[user].hrs > 24) {
                hrs = 24 - towers[user].hrs;
            }
            uint256 yield = hrs * towers[user].yield;
            if (
                (towers[user].totalMoneyReceived + yield) >
                ((towers[user].totalCoinsSpend) * 200)
            ) {
                towers[user].money2 +=
                    (towers[user].totalCoinsSpend * 200) -
                    (towers[user].totalMoneyReceived);
                towers[user].totalMoneyReceived +=
                    (towers[user].totalCoinsSpend * 200) -
                    (towers[user].totalMoneyReceived);
                towers[user].yield = 0;
                for (uint8 i = 0; i < 8; i++) {
                    towers[user].coders[i] = 0;
                }
            } else {
                towers[user].money2 += yield;
                towers[user].totalMoneyReceived += yield;
            }
            towers[user].hrs += hrs;
        }
        towers[user].timestamp = block.timestamp;
    }

    function getUpgradePrice(
        uint256 floorId,
        uint256 chefId
    ) internal pure returns (uint256) {
        if (chefId == 1)
            return
                [500, 1500, 4500, 13500, 40500, 120000, 365000, 1000000][
                    floorId
                ];
        if (chefId == 2)
            return
                [625, 1800, 5600, 16800, 50600, 150000, 456000, 1200000][
                    floorId
                ];
        if (chefId == 3)
            return
                [780, 2300, 7000, 21000, 63000, 187000, 570000, 1560000][
                    floorId
                ];
        if (chefId == 4)
            return
                [970, 3000, 8700, 26000, 79000, 235000, 713000, 2000000][
                    floorId
                ];
        if (chefId == 5)
            return
                [1200, 3600, 11000, 33000, 98000, 293000, 890000, 2500000][
                    floorId
                ];
        revert("Incorrect chefId");
    }

    function getYield(
        uint256 floorId,
        uint256 chefId
    ) internal pure returns (uint256) {
        if (chefId == 1)
            return [41, 130, 399, 1220, 3750, 11400, 36200, 104000][floorId];
        if (chefId == 2)
            return [52, 157, 498, 1530, 4700, 14300, 45500, 126500][floorId];
        if (chefId == 3)
            return [65, 201, 625, 1920, 5900, 17900, 57200, 167000][floorId];
        if (chefId == 4)
            return [82, 264, 780, 2380, 7400, 22700, 72500, 216500][floorId];
        if (chefId == 5)
            return [103, 318, 995, 3050, 9300, 28700, 91500, 275000][floorId];
        revert("Incorrect chefId");
    }
}
