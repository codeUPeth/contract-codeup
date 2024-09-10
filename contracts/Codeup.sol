// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ICodeupERC20} from "./interfaces/ICodeupERC20.sol";
import {IWETH, IERC20} from "./interfaces/IWETH.sol";
import {IWeightedPoolFactory} from "./interfaces/IWeightedPoolFactory.sol";
import {IWeightedPool} from "./interfaces/IWeightedPool.sol";
import {IVault} from "./interfaces/IVault.sol";

///░█████╗░░█████╗░██████╗░███████╗██╗░░░██╗██████╗░░░░███████╗████████╗██╗░░██╗
///██╔══██╗██╔══██╗██╔══██╗██╔════╝██║░░░██║██╔══██╗░░░██╔════╝╚══██╔══╝██║░░██║
///██║░░╚═╝██║░░██║██║░░██║█████╗░░██║░░░██║██████╔╝░░░█████╗░░░░░██║░░░███████║
///██║░░██╗██║░░██║██║░░██║██╔══╝░░██║░░░██║██╔═══╝░░░░██╔══╝░░░░░██║░░░██╔══██║
///╚█████╔╝╚█████╔╝██████╔╝███████╗╚██████╔╝██║░░░░░██╗███████╗░░░██║░░░██║░░██║
///░╚════╝░░╚════╝░╚═════╝░╚══════╝░╚═════╝░╚═╝░░░░░╚═╝╚══════╝░░░╚═╝░░░╚═╝░░╚═╝

/// @title Codeup contract
/// @notice This contract is used for the Codeup game
contract Codeup {
    using SafeERC20 for IERC20;

    struct Tower {
        uint256 microETH; /// @notice User's microETH balance
        uint256 microETHForWithdraw; /// @notice User's availble for withdraw balance
        uint256 microETHCollected; /// @notice User's earned microETH balance
        uint256 yields; /// @notice User's yields
        uint256 timestamp; /// @notice User's registration timestamp
        uint256 min; /// @notice User's time in the tower
        uint8[8] builders; /// @notice User's builders count on each floor
        uint256 totalMicroETHSpend; /// @notice User's total microETH spend
        uint256 totalMicroETHReceived; /// @notice User's total MicroETH received
    }

    /// @notice CodeupERC20 token amount for winner
    uint256 public constant TOKEN_AMOUNT_FOR_WINNER = 1000000000000;
    /// @notice Token amount in ETH needed for win CodeupERC20
    uint256 public constant MAX_FIRST_LIQUIDITY_AMOUNT = 0.001 ether;

    /// @notice Balancer weighted pool factory address
    address public immutable weightedPoolFactory;
    /// @notice Balancer vault address
    address public immutable vault;
    /// @notice CodeupERC20 token address
    address public immutable codeupERC20;
    /// @notice WETH address
    address public immutable weth;
    /// @notice Total builders count
    uint256 public totalBuilders;
    /// @notice Total towers count
    uint256 public totalTowers;
    /// @notice Total invested amount
    uint256 public totalInvested;
    /// @notice MicroETH price
    uint256 public microETHPrice;
    /// @notice MicroETH for withdraw rate
    uint256 public microETHForWithdrawRate;
    /// @notice Start date
    uint256 public startUNIX;
    /// @notice Balancer pool address WETH/CodeupERC20
    address public balancerPool;
    /// @notice account claim status
    mapping(address => bool) public isClaimed;
    /// @notice User's tower info
    mapping(address => Tower) public towers;

    /// @notice Balancer pool tokens
    address[] public poolTokens;
    /// @notice Balancer pool token weights
    uint256[] public tokenWeights;

    /// @notice Emmited when user created tower
    /// @param user User's address
    event TowerCreated(address indexed user);
    /// @notice Emmited when user added microETH to the tower
    /// @param user User's address
    /// @param microETHAmount microETH amount
    /// @param ethAmount Spended ETH amount
    event AddCodeupERC20(
        address indexed user,
        uint256 microETHAmount,
        uint256 ethAmount,
        uint256 ethForPool
    );
    /// @notice Emmited when user withdraw microETH
    /// @param user User's address
    /// @param amount microETH amount
    event Withdraw(address user, uint256 amount);
    /// @notice Emmited when user collect earned microETH
    /// @param user User's address
    /// @param amount microETH amount
    event Collect(address user, uint256 amount);
    /// @notice Emmited when user upgrade tower
    /// @param user User's address
    /// @param floorId Floor id
    /// @param microETH microETH amount
    /// @param yields Yield amount
    event UpgradeTower(
        address user,
        uint256 floorId,
        uint256 microETH,
        uint256 yields
    );
    /// @notice Emmited when user sync tower
    /// @param user User's address
    /// @param yields Yield amount
    /// @param hrs Hours amount
    /// @param date Date
    event SyncTower(address user, uint256 yields, uint256 hrs, uint256 date);
    /// @notice Emmited when balancer pool created
    /// @param pool Pool address
    event PoolCreated(address pool);
    /// @notice Emmited when game token claimed
    /// @param account Account address
    /// @param amount Token amount
    event TokenClaimed(address account, uint256 amount);

    /// @notice Contract constructor
    /// @param _startDate Start date
    /// @param _microETHPrice MicroETH price
    /// @param _weightPoolFactory Weighted pool factory address
    /// @param _codeupERC20 CodeupERC20 address
    /// @param _vault Balancer vault address
    /// @param _tokens Balancer pool tokens in correct order
    /// @param _tokenWeights Balancer pool token weights in correct order
    constructor(
        uint256 _startDate,
        uint256 _microETHPrice,
        address _weightPoolFactory,
        address _codeupERC20,
        address _vault,
        address[] memory _tokens,
        uint256[] memory _tokenWeights
    ) {
        require(_tokens.length == 2);
        require(_tokenWeights.length == 2);
        require(_microETHPrice > 0);
        require(_startDate > 0);
        require(_tokenWeights[0] + _tokenWeights[1] == 1e18);
        startUNIX = _startDate;
        microETHPrice = _microETHPrice;
        microETHForWithdrawRate = _microETHPrice / 1000;
        poolTokens = _tokens;
        tokenWeights = _tokenWeights;
        weightedPoolFactory = _weightPoolFactory;
        codeupERC20 = _codeupERC20;
        vault = _vault;
        weth = IVault(_vault).WETH();
    }

    /// @notice Add microETH to the tower
    function addMicroETH() external payable {
        uint256 tokenAmount = msg.value;
        require(block.timestamp > startUNIX, "We are not live yet!");
        uint256 microETH = tokenAmount / microETHPrice;
        require(microETH > 0, "Zero microETH amount");
        address user = msg.sender;
        totalInvested += tokenAmount;
        if (towers[user].timestamp == 0) {
            totalTowers++;
            towers[user].timestamp = block.timestamp;
            emit TowerCreated(user);
        }
        towers[user].microETH += microETH;

        uint256 ethAmount = (tokenAmount * 10) / 100;
        IWETH(weth).deposit{value: ethAmount}();
        emit AddCodeupERC20(user, microETH, tokenAmount, ethAmount);
    }

    /// @notice Withdraw earned microETH from the tower
    function withdraw() external {
        address user = msg.sender;
        uint256 microETH = towers[user].microETHForWithdraw *
            microETHForWithdrawRate;
        uint256 amount = address(this).balance < microETH
            ? address(this).balance
            : microETH;
        towers[user].microETHForWithdraw = 0;
        sendNative(user, amount);
        emit Withdraw(user, amount);
    }

    /// @notice Collect earned MicroETH from the tower to game balance
    function collect() external {
        address user = msg.sender;
        syncTower(user);
        towers[user].min = 0;
        uint256 microETHCollected = towers[user].microETHCollected;
        towers[user].microETHForWithdraw += microETHCollected;
        towers[user].microETHCollected = 0;
        emit Collect(user, microETHCollected);
    }

    /// @notice Reinvest earned microETH to the tower
    function reinvest() external {
        address user = msg.sender;
        require(
            towers[user].microETHForWithdraw > 0,
            "No microETH to reinvest"
        );
        uint256 microETHForWithdraw = towers[user].microETHForWithdraw *
            microETHForWithdrawRate;
        uint256 amount = address(this).balance < microETHForWithdraw
            ? address(this).balance
            : microETHForWithdraw;
        towers[user].microETHForWithdraw = 0;
        emit Withdraw(user, amount);

        uint256 microETH = amount / microETHPrice;
        require(microETH > 0, "Zero microETH");
        totalInvested += amount;
        towers[user].microETH += microETH;

        uint256 ethAmount = (amount * 10) / 100;
        IWETH(weth).deposit{value: ethAmount}();
        emit AddCodeupERC20(user, microETH, amount, ethAmount);
    }

    /// @notice Upgrade tower
    /// @param floorId Floor id
    function upgradeTower(uint256 floorId) external {
        require(floorId < 8, "Max 8 floors");
        address user = msg.sender;
        if (floorId > 0) {
            require(
                towers[user].builders[floorId - 1] >= 5,
                "Need to buy previous tower"
            );
        }
        syncTower(user);
        towers[user].builders[floorId]++;
        totalBuilders++;
        uint256 builders = towers[user].builders[floorId];
        uint256 microETHSpend = getUpgradePrice(floorId, builders);
        towers[user].microETH -= microETHSpend;
        towers[user].totalMicroETHSpend += microETHSpend;
        uint256 yield = getYield(floorId, builders);
        towers[user].yields += yield;
        emit UpgradeTower(msg.sender, floorId, microETHSpend, yield);
    }

    /// @notice Function perform claiming of game token
    /// Only users with 40 builders can claim game token
    /// Claiming possible only once.
    /// @param _account Account address
    function claimCodeupERC20(address _account) external {
        require(isClaimAllowed(_account), "Claim Forbidden");
        require(!isClaimed[_account], "Already Claimed");
        uint256[] memory amounts = new uint256[](2);
        uint256 wethBalance = IERC20(weth).balanceOf(address(this));
        address wethCached = weth;
        address[] memory poolTokensCached = poolTokens;
        /// if pool not created, create pool
        if (balancerPool == address(0)) {
            address[] memory rateProviders = new address[](2);
            rateProviders[0] = address(0);
            rateProviders[1] = address(0);
            /// create balancer pool
            balancerPool = IWeightedPoolFactory(weightedPoolFactory).create(
                "Codeup",
                "CU",
                poolTokensCached,
                tokenWeights,
                rateProviders,
                3e15,
                address(this),
                keccak256(abi.encode(totalTowers))
            );
            emit PoolCreated(balancerPool);
            /// Add first liquidity to the pool. Find out tokens position in the pool.
            /// Calculate amounts for adding liquidity. Contract WETH balance === Some amount of GT
            {
                uint256 firstLiquidity = wethBalance >
                    MAX_FIRST_LIQUIDITY_AMOUNT
                    ? MAX_FIRST_LIQUIDITY_AMOUNT
                    : wethBalance;
                amounts[0] = firstLiquidity;
                amounts[1] = firstLiquidity;
            }
            /// Add liquidity to the pool
            _balancerJoin(
                IWeightedPool(balancerPool).getPoolId(),
                poolTokens,
                amounts,
                true
            );
        } else {
            /// If pool already created, add liquidity to the pool only in WETH.
            {
                if (poolTokensCached[0] == wethCached) {
                    amounts[0] = wethBalance;
                } else {
                    amounts[1] = wethBalance;
                }
            }
            if (wethBalance > 0) {
                _balancerJoin(
                    IWeightedPool(balancerPool).getPoolId(),
                    poolTokensCached,
                    amounts,
                    false
                );
            }
        }
        /// Set claim status to true, user can't claim token again.
        /// Claiming possible only once.
        isClaimed[_account] = true;
        /// Transfer CodeupERC20 amount to the user
        IERC20(codeupERC20).safeTransfer(_account, TOKEN_AMOUNT_FOR_WINNER);
        emit TokenClaimed(_account, TOKEN_AMOUNT_FOR_WINNER);
    }

    /// @notice View function for checking if user can claim CodeupERC20
    /// @param _account Account address
    function isClaimAllowed(address _account) public view returns (bool) {
        uint8[8] memory builders = getBuilders(_account);
        uint8 count;
        for (uint8 i = 0; i < 8; i++) {
            count += builders[i];
        }

        if (count == 40) {
            return true;
        } else {
            return false;
        }
    }

    /// @notice Get user tower builders info
    /// @param addr User's address
    function getBuilders(address addr) public view returns (uint8[8] memory) {
        return towers[addr].builders;
    }

    /// @notice Sync user tower info
    /// @param user User's address
    function syncTower(address user) internal {
        require(towers[user].timestamp > 0, "User is not registered");
        if (towers[user].yields > 0) {
            uint256 min = (block.timestamp / 60) -
                (towers[user].timestamp / 60);
            if (min + towers[user].min > 24) {
                min = 24 - towers[user].min;
            }
            uint256 yield = min * towers[user].yields;

            towers[user].microETHCollected += yield;
            towers[user].totalMicroETHReceived += yield;
            towers[user].min += min;
            emit SyncTower(user, yield, min, block.timestamp);
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

    /// @notice Helper function for getting upgrade price for the floor and builder
    /// @param floorId Floor id
    /// @param builderId Builder id
    function getUpgradePrice(
        uint256 floorId,
        uint256 builderId
    ) internal pure returns (uint256) {
        if (builderId == 1)
            return [14, 21, 42, 77, 168, 280, 504, 630][floorId];
        if (builderId == 2) return [7, 11, 21, 35, 63, 112, 280, 350][floorId];
        if (builderId == 3) return [9, 14, 28, 49, 84, 168, 336, 560][floorId];
        if (builderId == 4)
            return [11, 21, 35, 63, 112, 210, 364, 630][floorId];
        if (builderId == 5)
            return [15, 28, 49, 84, 140, 252, 448, 1120][floorId];
        revert("Incorrect builderId");
    }

    /// @notice Helper function for getting yield for the floor and builder
    /// @param floorId Floor id
    /// @param builderId Builder id
    function getYield(
        uint256 floorId,
        uint256 builderId
    ) internal pure returns (uint256) {
        if (builderId == 1)
            return [467, 226, 294, 606, 1163, 1617, 2267, 1760][floorId];
        if (builderId == 2)
            return [41, 37, 121, 215, 305, 415, 890, 389][floorId];
        if (builderId == 3)
            return [170, 51, 218, 317, 432, 351, 357, 1030][floorId];
        if (builderId == 4)
            return [218, 92, 270, 410, 596, 858, 972, 1045][floorId];
        if (builderId == 5)
            return [239, 98, 381, 551, 742, 1007, 1188, 2416][floorId];
        revert("Incorrect builderId");
    }

    /// @notice Function perform adding liquidity to the balancer pool
    /// @param _poolId Balancer pool id
    /// @param _tokens Tokens addresses
    /// @param _amounts Tokens amounts
    function _balancerJoin(
        bytes32 _poolId,
        address[] memory _tokens,
        uint256[] memory _amounts,
        bool isInit
    ) internal {
        address vaultCached = vault;
        if (_amounts[0] > 0) {
            IERC20(_tokens[0]).safeIncreaseAllowance(vaultCached, _amounts[0]);
        }
        if (_amounts[1] > 0) {
            IERC20(_tokens[1]).safeIncreaseAllowance(vaultCached, _amounts[1]);
        }
        /// isInit ? 0 : 1 - isInit flag
        /// 0 - first liquidity adding
        /// 1 - second liquidity adding
        bytes memory userData = abi.encode(isInit ? 0 : 1, _amounts, 1);

        IVault.JoinPoolRequest memory request = IVault.JoinPoolRequest(
            _tokens,
            _amounts,
            userData,
            false
        );

        IVault(vaultCached).joinPool(
            _poolId,
            address(this),
            address(this),
            request
        );
        /// Lock liquidity. Transfer liquidity to dEaD address
        /// Anybody can unlock liquidity.
        /// Balancer contracts prohibit transfers to a null address.
        /// Therefore, we send to the dEaD address
        IERC20 pool = IERC20(balancerPool);
        pool.transfer(
            0x000000000000000000000000000000000000dEaD,
            pool.balanceOf(address(this))
        );
    }
}
