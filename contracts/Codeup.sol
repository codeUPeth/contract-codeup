// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IWETH, IERC20} from "./interfaces/IWETH.sol";
import {IUniswapV2Router} from "./interfaces/IUniswapV2Router.sol";
import {IUniswapV2Factory} from "./interfaces/IUniswapV2Factory.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

///░█████╗░░█████╗░██████╗░███████╗██╗░░░██╗██████╗░░░░███████╗████████╗██╗░░██╗
///██╔══██╗██╔══██╗██╔══██╗██╔════╝██║░░░██║██╔══██╗░░░██╔════╝╚══██╔══╝██║░░██║
///██║░░╚═╝██║░░██║██║░░██║█████╗░░██║░░░██║██████╔╝░░░█████╗░░░░░██║░░░███████║
///██║░░██╗██║░░██║██║░░██║██╔══╝░░██║░░░██║██╔═══╝░░░░██╔══╝░░░░░██║░░░██╔══██║
///╚█████╔╝╚█████╔╝██████╔╝███████╗╚██████╔╝██║░░░░░██╗███████╗░░░██║░░░██║░░██║
///░╚════╝░░╚════╝░╚═════╝░╚══════╝░╚═════╝░╚═╝░░░░░╚═╝╚══════╝░░░╚═╝░░░╚═╝░░╚═╝

/// @title Codeup contract
/// @notice This contract is used for the Codeup game
contract Codeup is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Tower {
        uint256 cup; /// @notice User's cup balance
        uint256 cupForWithdraw; /// @notice User's availble for withdraw balance
        uint256 cupCollected; /// @notice User's earned cup balance
        uint256 yields; /// @notice User's yields
        uint256 timestamp; /// @notice User's registration timestamp
        uint256 min; /// @notice User's time in the tower
        uint8[8] builders; /// @notice User's builders count on each floor
        uint256 totalCupSpend; /// @notice User's total cup spend
        uint256 totalCupReceived; /// @notice User's total cup received
    }

    /// @notice CodeupERC20 token amount for winner
    uint256 public constant TOKEN_AMOUNT_FOR_WINNER = 1 ether;
    /// @notice Token amount in ETH needed for first luqidity
    uint256 public constant MAX_FIRST_LIQUIDITY_AMOUNT = 0.001 ether;
    /// @notice Amount of game token for first liquidity
    uint256 public constant FIRST_LIQUIDITY_GAME_TOKEN = 10 ether;
    /// @notice Withdraw commission 25% for rewards pool, 25% for liquidity pool
    uint256 public constant WITHDRAW_COMMISSION = 50;

    /// @notice UniswapV2Router address
    address immutable uniswapV2Router;
    /// @notice UniswapV2Factory address
    address immutable uniswapV2Factory;
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
    /// @notice cup price
    uint256 public cupPrice;
    /// @notice cup for withdraw rate
    uint256 public cupForWithdrawRate;
    /// @notice Start date
    uint256 public startUNIX;
    /// @notice UniswapV2 pool address WETH/CodeupERC20
    address public uniswapV2Pool;

    /// @notice account claim status
    mapping(address => bool) public isClaimed;
    /// @notice User's tower info
    mapping(address => Tower) public towers;

    /// @notice Emmited when user created tower
    /// @param user User's address
    event TowerCreated(address indexed user);
    /// @notice Emmited when user added cup to the tower
    /// @param user User's address
    /// @param cupAmount cup amount
    /// @param ethAmount Spended ETH amount
    event AddCup(
        address indexed user,
        uint256 cupAmount,
        uint256 ethAmount,
        uint256 ethForPool
    );
    /// @notice Emmited when user withdraw cup
    /// @param user User's address
    /// @param amount cup amount
    event Withdraw(address user, uint256 amount);
    /// @notice Emmited when user collect earned cup
    /// @param user User's address
    /// @param amount cup amount
    event Collect(address user, uint256 amount);
    /// @notice Emmited when user upgrade tower
    /// @param user User's address
    /// @param floorId Floor id
    /// @param cup cup amount
    /// @param yields Yield amount
    event UpgradeTower(
        address user,
        uint256 floorId,
        uint256 cup,
        uint256 yields
    );
    /// @notice Emmited when user sync tower
    /// @param user User's address
    /// @param yields Yield amount
    /// @param hrs Hours amount
    /// @param date Date
    event SyncTower(address user, uint256 yields, uint256 hrs, uint256 date);
    /// @notice Emmited when uniswapV2 pool created
    /// @param pool Pool address
    event PoolCreated(address pool);
    /// @notice Emmited when game token claimed
    /// @param account Account address
    /// @param amount Token amount
    event TokenClaimed(address account, uint256 amount);

    /// @notice Contract constructor
    /// @param _startDate Start date
    /// @param _cupPrice cup price
    /// @param _uniswapV2Router Weighted pool factory address
    /// @param _codeupERC20 CodeupERC20 address
    constructor(
        uint256 _startDate,
        uint256 _cupPrice,
        address _uniswapV2Router,
        address _codeupERC20
    ) {
        require(_cupPrice > 0);
        require(_startDate > 0);
        startUNIX = _startDate;
        cupPrice = _cupPrice;
        cupForWithdrawRate = _cupPrice / 1000;
        codeupERC20 = _codeupERC20;
        uniswapV2Router = _uniswapV2Router;
        weth = IUniswapV2Router(_uniswapV2Router).WETH();
        uniswapV2Factory = IUniswapV2Router(_uniswapV2Router).factory();
    }

    receive() external payable {}

    /// @notice Add cup to the tower
    function addCUP() external payable nonReentrant {
        uint256 tokenAmount = msg.value;
        require(block.timestamp > startUNIX, "We are not live yet!");
        uint256 cup = tokenAmount / cupPrice;
        require(cup > 0, "Zero cup amount");
        address user = msg.sender;
        totalInvested += tokenAmount;
        if (towers[user].timestamp == 0) {
            totalTowers++;
            towers[user].timestamp = block.timestamp;
            emit TowerCreated(user);
        }
        towers[user].cup += cup;

        uint256 ethAmount = (tokenAmount * 10) / 100;
        IWETH(weth).deposit{value: ethAmount}();
        emit AddCup(user, cup, tokenAmount, ethAmount);
    }

    /// @notice Withdraw earned cup from the tower
    function withdraw() external nonReentrant {
        address user = msg.sender;
        uint256 cup = towers[user].cupForWithdraw * cupForWithdrawRate;
        uint256 amount = address(this).balance < cup
            ? address(this).balance
            : cup;
        if (amount > 0) {
            uint256 commission = (amount * WITHDRAW_COMMISSION) / 100;
            amount -= commission;
            /// 25% commission to pool
            /// 25% commission for rewards
            uint256 amountForPool = commission / 2;
            IWETH(weth).deposit{value: amountForPool}();
        }
        towers[user].cupForWithdraw = 0;
        _sendNative(user, amount);
        emit Withdraw(user, amount);
    }

    /// @notice Collect earned cup from the tower to game balance
    function collect() external {
        address user = msg.sender;
        _syncTower(user);
        towers[user].min = 0;
        uint256 cupCollected = towers[user].cupCollected;
        towers[user].cupForWithdraw += cupCollected;
        towers[user].cupCollected = 0;
        emit Collect(user, cupCollected);
    }

    /// @notice Reinvest earned cup to the tower
    function reinvest() external {
        address user = msg.sender;
        require(towers[user].cupForWithdraw > 0, "No cup to reinvest");
        uint256 cupForWithdraw = towers[user].cupForWithdraw *
            cupForWithdrawRate;
        uint256 amount = address(this).balance < cupForWithdraw
            ? address(this).balance
            : cupForWithdraw;
        towers[user].cupForWithdraw = 0;
        emit Withdraw(user, amount);

        uint256 cup = amount / cupPrice;
        require(cup > 0, "Zero cup");
        totalInvested += amount;
        towers[user].cup += cup;

        uint256 ethAmount = (amount * 10) / 100;
        IWETH(weth).deposit{value: ethAmount}();
        emit AddCup(user, cup, amount, ethAmount);
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
        _syncTower(user);
        towers[user].builders[floorId]++;
        totalBuilders++;
        uint256 builders = towers[user].builders[floorId];
        uint256 cupSpend = _getUpgradePrice(floorId, builders);
        towers[user].cup -= cupSpend;
        towers[user].totalCupSpend += cupSpend;
        uint256 yield = _getYield(floorId, builders);
        towers[user].yields += yield;
        emit UpgradeTower(msg.sender, floorId, cupSpend, yield);
    }

    /// @notice Function perform claiming of game token
    /// Only users with 40 builders can claim game token
    /// Claiming possible only once.
    /// @param _account Account address
    function claimCodeupERC20(address _account) external {
        require(isClaimAllowed(_account), "Claim Forbidden");
        require(!isClaimed[_account], "Already Claimed");
        uint256 wethBalance = IERC20(weth).balanceOf(address(this));
        address wethCached = weth;
        address codeupERC20Cached = codeupERC20;
        /// if pool not created, create pool
        if (uniswapV2Pool == address(0)) {
            /// Create uniswap pool
            uniswapV2Pool = IUniswapV2Factory(uniswapV2Factory).createPair(
                wethCached,
                codeupERC20
            );

            uint256 firstLiquidity = wethBalance > MAX_FIRST_LIQUIDITY_AMOUNT
                ? MAX_FIRST_LIQUIDITY_AMOUNT
                : wethBalance;

            _addLiquidity(
                wethCached,
                codeupERC20Cached,
                firstLiquidity,
                FIRST_LIQUIDITY_GAME_TOKEN
            );
        } else {
            // buy codeupERC20 for WETH
            if (wethBalance > 0) {
                uint256[] memory swapResult = _buyCodeupERC20(
                    wethCached,
                    codeupERC20Cached,
                    wethBalance / 2
                );

                _addLiquidity(
                    wethCached,
                    codeupERC20Cached,
                    swapResult[0],
                    swapResult[1]
                );
            }
        }
        /// Set claim status to true, user can't claim token again.
        /// Claiming possible only once.
        isClaimed[_account] = true;
        /// Lock LP tokens
        _lockLP();
        /// Transfer CodeupERC20 amount to the user
        IERC20(codeupERC20Cached).safeTransfer(
            _account,
            TOKEN_AMOUNT_FOR_WINNER
        );
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
    function _syncTower(address user) internal {
        require(towers[user].timestamp > 0, "User is not registered");
        if (towers[user].yields > 0) {
            uint256 min = (block.timestamp / 60) -
                (towers[user].timestamp / 60);
            if (min + towers[user].min > 24) {
                min = 24 - towers[user].min;
            }
            uint256 yield = min * towers[user].yields;

            towers[user].cupCollected += yield;
            towers[user].totalCupReceived += yield;
            towers[user].min += min;
            emit SyncTower(user, yield, min, block.timestamp);
        }
        towers[user].timestamp = block.timestamp;
    }

    /// @notice This function sends native chain token.
    /// @param to_ - address of receiver
    /// @param amount_ - amount of native chain token
    /// @dev If the transfer fails, the function reverts.
    function _sendNative(address to_, uint256 amount_) internal {
        (bool success, ) = to_.call{value: amount_}("");
        require(success, "Transfer failed.");
    }

    /// @notice Helper function for getting upgrade price for the floor and builder
    /// @param floorId Floor id
    /// @param builderId Builder id
    function _getUpgradePrice(
        uint256 floorId,
        uint256 builderId
    ) internal pure returns (uint256) {
        if (builderId == 1)
            return [434, 21, 42, 77, 168, 280, 504, 630][floorId];
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
    function _getYield(
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

    /// @notice Function performs buying CodeupERC20 from V2 pool
    function _buyCodeupERC20(
        address _weth,
        address _codeupERC20,
        uint256 _wethAmount
    ) internal returns (uint256[] memory swapResult) {
        address[] memory path = new address[](2);
        path[0] = _weth;
        path[1] = _codeupERC20;
        address uniswapRouterCached = uniswapV2Router;
        uint256[] memory amounts = IUniswapV2Router(uniswapRouterCached)
            .getAmountsOut(_wethAmount, path);
        IERC20(_weth).safeIncreaseAllowance(uniswapV2Router, _wethAmount);
        swapResult = IUniswapV2Router(uniswapRouterCached)
            .swapExactTokensForTokens(
                amounts[0],
                0,
                path,
                address(this),
                block.timestamp
            );
    }

    /// @notice Function perfoms adding liquidity to uniswapV2Pool
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired
    ) internal {
        address uniswapRouterCached = uniswapV2Router;
        IERC20(tokenA).safeIncreaseAllowance(
            uniswapRouterCached,
            amountADesired
        );
        IERC20(tokenB).safeIncreaseAllowance(
            uniswapRouterCached,
            amountBDesired
        );
        IUniswapV2Router(uniswapV2Router).addLiquidity(
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            0,
            0,
            address(this),
            block.timestamp
        );
    }

    /// @notice Function for locking LP tokens.
    /// If contract has LP tokens, it will send them to address(0)
    function _lockLP() internal {
        address uniswapV2PoolCached = uniswapV2Pool;
        if (IERC20(uniswapV2PoolCached).balanceOf(address(this)) > 0) {
            IERC20(uniswapV2PoolCached).safeTransfer(
                address(0),
                IERC20(uniswapV2PoolCached).balanceOf(address(this))
            );
        }
    }
}
