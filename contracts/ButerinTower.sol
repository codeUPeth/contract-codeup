// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

//███████████████████████████████████████████████████████████████████████████████
//█▄─▄─▀█▄─██─▄█─▄─▄─█▄─▄▄─█▄─▄▄▀█▄─▄█▄─▀█▄─▄███─▄─▄─█─▄▄─█▄─█▀▀▀█─▄█▄─▄▄─█▄─▄▄▀█
//██─▄─▀██─██─████─████─▄█▀██─▄─▄██─███─█▄▀─██████─███─██─██─█─█─█─███─▄█▀██─▄─▄█
//▀▄▄▄▄▀▀▀▄▄▄▄▀▀▀▄▄▄▀▀▄▄▄▄▄▀▄▄▀▄▄▀▄▄▄▀▄▄▄▀▀▄▄▀▀▀▀▄▄▄▀▀▄▄▄▄▀▀▄▄▄▀▄▄▄▀▀▄▄▄▄▄▀▄▄▀▄▄▀

/// @title ButerinTower contract
/// @notice This contract is used for the ButerinTower game
contract ButerinTower {
    struct Tower {
        uint256 coins; /// @notice User's coins balance
        uint256 money; /// @notice User's money balance
        uint256 money2; /// @notice User's earned money balance
        uint256 yield; /// @notice User's yield
        uint256 timestamp; /// @notice User's registration timestamp
        uint256 hrs; /// @notice User's hours in the tower
        address ref; /// @notice User's referrer
        uint256[3] refs; /// @notice User's refs count
        uint256[3] refDeps; /// @notice User's refs earnings
        uint8[8] coders; /// @notice User's coders count on each floor
        uint256 totalCoinsSpend; /// @notice User's total coins spend
        uint256 totalMoneyReceived; /// @notice User's total money received
    }
    /// @notice User's tower info
    mapping(address => Tower) public towers;
    /// @notice Total coders count
    uint256 public totalCoders;
    /// @notice Total towers count
    uint256 public totalTowers;
    /// @notice Total invested amount
    uint256 public totalInvested;
    /// @notice Coins price
    uint256 public coinsPrice;
    /// @notice Money rate
    uint256 public moneyRate;
    /// @notice Manager address
    address public immutable manager;
    /// @notice Start date
    uint256 public startUNIX;
    /// @notice Referral percents
    uint256[] refPercent = [8, 5, 2];

    /// @notice Emmited when user created tower
    /// @param user User's address
    /// @param ref User's referrer address
    event TowerCreated(address indexed user, address indexed ref);
    /// @notice Emmited when user paid project fee
    /// @param user User's address
    /// @param amount Fee amount
    event ProjectFeePaid(address indexed user, uint256 amount);
    /// @notice Emmited when user added coins
    /// @param user User's address
    /// @param coinsAmount Coins amount
    /// @param moneyAmount Money amount
    event AddCoins(
        address indexed user,
        uint256 coinsAmount,
        uint256 moneyAmount
    );
    /// @notice Emmited when user earned referral
    /// @param user User's address
    /// @param coinsAmount Coins amount
    event RefEarning(
        address indexed user,
        uint256 coinsAmount,
        uint256 moneyAmount
    );
    /// @notice Emmited when user withdraw money
    /// @param user User's address
    /// @param amount Money amount
    event Withdraw(address user, uint256 amount);
    /// @notice Emmited when user collect earned money
    /// @param user User's address
    /// @param amount Money amount
    event CollectMoney(address user, uint256 amount);
    /// @notice Emmited when user upgrade tower
    /// @param user User's address
    /// @param floorId Floor id
    /// @param coins Coins amount
    /// @param yield Yield amount
    event UpgradeTower(
        address user,
        uint256 floorId,
        uint256 coins,
        uint256 yield
    );
    /// @notice Emmited when user sync tower
    /// @param user User's address
    /// @param yield Yield amount
    /// @param hrs Hours amount
    /// @param date Date
    event SyncTower(address user, uint256 yield, uint256 hrs, uint256 date);

    /// @notice Contract constructor
    /// @param _startDate Start date
    /// @param _manager Manager address
    constructor(uint256 _startDate, address _manager, uint256 _coinsPrice) {
        require(_coinsPrice > 0);
        require(_startDate > 0);
        require(_manager != address(0));
        startUNIX = _startDate;
        manager = _manager;
        coinsPrice = _coinsPrice;
        moneyRate = _coinsPrice / 1000;
    }

    /// @notice Add coins to the tower
    /// @param ref Referrer address
    function addCoins(address ref) external payable {
        uint256 tokenAmount = msg.value;
        require(block.timestamp > startUNIX, "We are not live yet!");
        uint256 coins = tokenAmount / coinsPrice;
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
        emit AddCoins(user, coins, tokenAmount);
        sendNative(managerCache, (tokenAmount * 10) / 100);

        emit ProjectFeePaid(managerCache, (tokenAmount * 10) / 100);
    }

    /// @notice Internal function for ref earning calculation
    /// @param user User's address
    /// @param coins Coins amount
    /// @param isNew Is new user
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
            uint256 coinsAmount = (refTemp * 70) / 100;
            uint256 money = (refTemp * 1000 * 30) / 100;
            towers[ref].coins += coinsAmount;
            towers[ref].money += money;
            towers[ref].refDeps[i] += refTemp;
            i++;
            ref = towers[ref].ref;
            emit RefEarning(ref, coinsAmount, money);
        }
    }

    /// @notice Withdraw earned money from the tower
    function withdrawMoney() external {
        address user = msg.sender;
        uint256 money = towers[user].money * moneyRate;
        uint256 amount = address(this).balance < money
            ? address(this).balance
            : money;
        towers[user].money = 0;
        sendNative(user, amount);
        emit Withdraw(user, amount);
    }

    /// @notice Collect earned money from the tower to game balance
    function collectMoney() external {
        address user = msg.sender;
        syncTower(user);
        towers[user].hrs = 0;
        uint256 collect = towers[user].money2;
        towers[user].money += collect;
        towers[user].money2 = 0;
        emit CollectMoney(user, collect);
    }

    /// @notice Upgrade tower
    /// @param floorId Floor id
    function upgradeTower(uint256 floorId) external {
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
        uint256 coinsSpend = getUpgradePrice(floorId, chefs);
        towers[user].coins -= coinsSpend;
        towers[user].totalCoinsSpend += coinsSpend;
        uint256 yield = getYield(floorId, chefs);
        towers[user].yield += yield;
        emit UpgradeTower(msg.sender, floorId, coinsSpend, yield);
    }

    /// @notice Get user tower coders info
    /// @param addr User's address
    function getCoders(address addr) public view returns (uint8[8] memory) {
        return towers[addr].coders;
    }

    /// @notice Get user ref earning info
    /// @param addr User's address
    function getRefEarning(
        address addr
    )
        public
        view
        returns (uint256[3] memory _refEarning, uint256[3] memory _refCount)
    {
        return (towers[addr].refDeps, towers[addr].refs);
    }

    /// @notice Sync user tower info
    /// @param user User's address
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

            towers[user].money2 += yield;
            towers[user].totalMoneyReceived += yield;
            towers[user].hrs += hrs;
            emit SyncTower(user, yield, hrs, block.timestamp);
        }
        towers[user].timestamp = block.timestamp;
    }

    /// @notice This function sends native chain token.
    /// @param to_ - address of receiver
    /// @param amount_ - amount of native chain token
    /// @dev If the transfer fails, the function reverts.
    function sendNative(address to_, uint256 amount_) internal {
        (bool success, ) = to_.call{value: amount_}("");
        require(success, "Transfer failed.");
    }

    /// @notice Helper function for getting upgrade price for the floor and chef
    /// @param floorId Floor id
    /// @param chefId Chef id
    function getUpgradePriceV2(
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

    function getUpgradePrice(
        uint256 floorId,
        uint256 chefId
    ) internal pure returns (uint256) {
        if (chefId == 1) return [14, 21, 42, 77, 168, 280, 504, 630][floorId];
        if (chefId == 2) return [7, 10, 21, 35, 63, 112, 280, 350][floorId];
        if (chefId == 3) return [9, 14, 28, 49, 84, 168, 336, 560][floorId];
        if (chefId == 4) return [11, 21, 35, 63, 112, 210, 364, 630][floorId];
        if (chefId == 5) return [15, 28, 49, 84, 140, 252, 448, 1120][floorId];
        revert("Incorrect chefId");
    }

    /// @notice Helper function for getting yield for the floor and chef
    /// @param floorId Floor id
    /// @param chefId Chef id
    function getYieldV2(
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

    function getYield(
        uint256 floorId,
        uint256 chefId
    ) internal pure returns (uint256) {
        if (chefId == 1)
            return [466, 225, 294, 605, 1163, 1616, 2267, 1759][floorId];
        if (chefId == 2) return [40, 36, 120, 215, 305, 414, 890, 388][floorId];
        if (chefId == 3)
            return [169, 51, 217, 317, 432, 351, 357, 1030][floorId];
        if (chefId == 4)
            return [217, 92, 270, 410, 595, 858, 972, 1044][floorId];
        if (chefId == 5)
            return [239, 98, 381, 550, 741, 1007, 1187, 2416][floorId];
        revert("Incorrect chefId");
    }
}
