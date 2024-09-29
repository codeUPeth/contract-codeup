// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {IWETH, IERC20} from "./interfaces/IWETH.sol";
import {IUniswapV2Router} from "./interfaces/IUniswapV2Router.sol";
import {IUniswapV2Factory} from "./interfaces/IUniswapV2Factory.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

///░█████╗░░█████╗░██████╗░███████╗██╗░░░██╗██████╗░░░░███████╗████████╗██╗░░██╗
///██╔══██╗██╔══██╗██╔══██╗██╔════╝██║░░░██║██╔══██╗░░░██╔════╝╚══██╔══╝██║░░██║
///██║░░╚═╝██║░░██║██║░░██║█████╗░░██║░░░██║██████╔╝░░░█████╗░░░░░██║░░░███████║
///██║░░██╗██║░░██║██║░░██║██╔══╝░░██║░░░██║██╔═══╝░░░░██╔══╝░░░░░██║░░░██╔══██║
///╚█████╔╝╚█████╔╝██████╔╝███████╗╚██████╔╝██║░░░░░██╗███████╗░░░██║░░░██║░░██║
///░╚════╝░░╚════╝░╚═════╝░╚══════╝░╚═════╝░╚═╝░░░░░╚═╝╚══════╝░░░╚═╝░░░╚═╝░░╚═╝

/// @title Codeup contract
/// @notice This contract is used for the Codeup game
contract Codeup is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct Tower {
        uint256 cup; /// @notice User's cup balance
        uint256 cupForWithdraw; /// @notice User's availble for withdraw balance
        uint256 cupCollected; /// @notice User's earned cup balance
        uint256 yields; /// @notice User's yields
        uint256 timestamp; /// @notice User's registration timestamp
        uint256 min; /// @notice User's time in the tower
        uint256 totalCupSpend; /// @notice User's total cup spend
        uint256 totalCupReceived; /// @notice User's total cup received
        uint8[8] builders; /// @notice User's builders count on each floor
    }

    /// @notice CodeupERC20 token amount for winner
    uint256 private constant TOKEN_AMOUNT_FOR_WINNER = 1 ether;
    /// @notice Token amount in ETH needed for first luqidity
    uint256 private constant MAX_FIRST_LIQUIDITY_AMOUNT = 0.001 ether;
    /// @notice Amount of game token for first liquidity
    uint256 private constant FIRST_LIQUIDITY_GAME_TOKEN = 10 ether;
    /// @notice Withdraw commission 25% for rewards pool, 25% for liquidity pool
    uint256 private constant WITHDRAW_COMMISSION = 50;

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

    error ZeroValue();
    error IncorrectBuilderId();
    error NotStarted();
    error TransferFailed();
    error MaxFloorsReached();
    error NeedToBuyPreviousBuilder();
    error ClaimForbidden();
    error AlreadyClaimed();

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
    ) payable Ownable(msg.sender) {
        _checkValue(_cupPrice);
        _checkValue(_startDate);
        startUNIX = _startDate;
        cupPrice = _cupPrice;
        cupForWithdrawRate = _cupPrice / 1000;
        codeupERC20 = _codeupERC20;
        uniswapV2Router = _uniswapV2Router;
        weth = IUniswapV2Router(_uniswapV2Router).WETH();
        uniswapV2Factory = IUniswapV2Router(_uniswapV2Router).factory();
    }

    receive() external payable {
        IWETH(weth).deposit{value: msg.value}();
    }

    /// @notice Add cup to the tower
    function addCUP() external payable nonReentrant {
        uint256 tokenAmount = msg.value;
        require(block.timestamp > startUNIX, NotStarted());
        uint256 cup = tokenAmount / cupPrice;
        _checkValue(cup);
        address user = msg.sender;
        uint256 totalInvestedBedore = totalInvested;
        totalInvested = totalInvestedBedore + tokenAmount;

        Tower storage tower = towers[user];
        if (tower.timestamp == 0) {
            uint256 totalTowersBefore = totalTowers;
            totalTowers = totalTowersBefore + 1;
            tower.timestamp = block.timestamp;
            emit TowerCreated(user);
        }
        tower.cup += cup;

        uint256 ethAmount = (tokenAmount * 10) / 100;
        IWETH(weth).deposit{value: ethAmount}();
        emit AddCup(user, cup, tokenAmount, ethAmount);
    }

    /// @notice Withdraw earned cup from the tower
    function withdraw() external nonReentrant {
        address user = msg.sender;
        Tower storage tower = towers[user];
        uint256 contractBalance = _selfBalance();
        uint256 cup = tower.cupForWithdraw * cupForWithdrawRate;
        uint256 amount = contractBalance < cup ? contractBalance : cup;

        if (amount >= 1) {
            uint256 commission = (amount * WITHDRAW_COMMISSION) / 100;
            amount -= commission;
            /// 25% commission to pool
            /// 25% commission for rewards
            uint256 amountForPool = commission >> 1;
            IWETH(weth).deposit{value: amountForPool}();
        }
        tower.cupForWithdraw = 0;
        (bool success, ) = user.call{value: amount}("");
        require(success, TransferFailed());
        emit Withdraw(user, amount);
    }

    /// @notice Collect earned cup from the tower to game balance
    function collect() external {
        address user = msg.sender;
        Tower storage tower = towers[user];
        _syncTower(user);
        tower.min = 0;
        uint256 cupCollected = tower.cupCollected;
        tower.cupForWithdraw += cupCollected;
        tower.cupCollected = 0;
        emit Collect(user, cupCollected);
    }

    /// @notice Reinvest earned cup to the tower
    function reinvest() external {
        address user = msg.sender;
        uint256 contractBalance = _selfBalance();
        Tower storage tower = towers[user];
        _checkValue(tower.cupForWithdraw);
        uint256 cupForWithdraw = tower.cupForWithdraw * cupForWithdrawRate;
        uint256 amount = contractBalance < cupForWithdraw
            ? contractBalance
            : cupForWithdraw;
        tower.cupForWithdraw = 0;
        emit Withdraw(user, amount);

        uint256 cup = amount / cupPrice;
        _checkValue(cup);
        totalInvested += amount;
        tower.cup += cup;

        uint256 ethAmount = (amount * 10) / 100;
        IWETH(weth).deposit{value: ethAmount}();
        emit AddCup(user, cup, amount, ethAmount);
    }

    /// @notice Upgrade tower
    /// @param floorId Floor id
    function upgradeTower(uint256 floorId) external {
        require(floorId < 8, MaxFloorsReached());
        address user = msg.sender;
        if (floorId > 0) {
            require(
                towers[user].builders[floorId - 1] >= 5,
                NeedToBuyPreviousBuilder()
            );
        }
        _syncTower(user);
        Tower storage tower = towers[user];
        tower.builders[floorId]++;
        totalBuilders++;
        uint256 builders = tower.builders[floorId];
        uint256 cupSpend = _getUpgradePrice(floorId, builders);
        tower.cup -= cupSpend;
        tower.totalCupSpend += cupSpend;
        uint256 yield = _getYield(floorId, builders);
        tower.yields += yield;
        emit UpgradeTower(msg.sender, floorId, cupSpend, yield);
    }

    /// @notice Function perform claiming of game token
    /// Only users with 40 builders can claim game token
    /// Claiming possible only once.
    /// @param _account Account address
    function claimCodeupERC20(address _account) external {
        require(isClaimAllowed(_account), ClaimForbidden());
        require(!isClaimed[_account], AlreadyClaimed());
        address wethCached = weth;
        address currentContract = address(this);
        uint256 wethBalance = IERC20(wethCached).balanceOf(currentContract);
        address codeupERC20Cached = codeupERC20;

        /// if pool not created, create pool
        if (uniswapV2Pool == address(0)) {
            /// Create uniswap pool
            uniswapV2Pool = IUniswapV2Factory(uniswapV2Factory).createPair(
                wethCached,
                codeupERC20Cached
            );

            uint256 firstLiquidity = wethBalance > MAX_FIRST_LIQUIDITY_AMOUNT
                ? MAX_FIRST_LIQUIDITY_AMOUNT
                : wethBalance;

            _addLiquidity(
                wethCached,
                codeupERC20Cached,
                firstLiquidity,
                FIRST_LIQUIDITY_GAME_TOKEN,
                0,
                0,
                currentContract
            );
        } else {
            // buy codeupERC20 for WETH
            if (wethBalance >= 1) {
                uint256[] memory swapResult = _buyCodeupERC20(
                    wethCached,
                    codeupERC20Cached,
                    wethBalance >> 1,
                    0,
                    currentContract
                );

                _addLiquidity(
                    wethCached,
                    codeupERC20Cached,
                    swapResult[0],
                    swapResult[1],
                    0,
                    0,
                    currentContract
                );
            }
        }
        /// Set claim status to true, user can't claim token again.
        /// Claiming possible only once.
        isClaimed[_account] = true;
        /// Lock LP tokens
        _lockLP(currentContract);
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
    function _syncTower(address user) internal {
        Tower storage tower = towers[user];
        _checkValue(tower.timestamp);
        if (tower.yields >= 1) {
            uint256 min = (block.timestamp / 60) - (tower.timestamp / 60);
            if (min + towers[user].min > 24) {
                min = 24 - tower.min;
            }
            uint256 yield = min * tower.yields;

            tower.cupCollected += yield;
            tower.totalCupReceived += yield;
            tower.min += min;
            emit SyncTower(user, yield, min, block.timestamp);
        }
        tower.timestamp = block.timestamp;
    }

    /// @notice Helper function for getting upgrade price for the floor and builder
    /// @param floorId Floor id
    /// @param builderId Builder id
    function _getUpgradePrice(
        uint256 floorId,
        uint256 builderId
    ) private pure returns (uint256) {
        if (builderId == 1)
            return [434, 21, 42, 77, 168, 280, 504, 630][floorId];
        if (builderId == 2) return [7, 11, 21, 35, 63, 112, 280, 350][floorId];
        if (builderId == 3) return [9, 14, 28, 49, 84, 168, 336, 560][floorId];
        if (builderId == 4)
            return [11, 21, 35, 63, 112, 210, 364, 630][floorId];
        if (builderId == 5)
            return [15, 28, 49, 84, 140, 252, 448, 1120][floorId];
        revert IncorrectBuilderId();
    }

    /// @notice Helper function for getting yield for the floor and builder
    /// @param floorId Floor id
    /// @param builderId Builder id
    function _getYield(
        uint256 floorId,
        uint256 builderId
    ) private pure returns (uint256) {
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
        revert IncorrectBuilderId();
    }

    /// @notice Function performs buying CodeupERC20 from V2 pool
    function _buyCodeupERC20(
        address _weth,
        address _codeupERC20,
        uint256 _wethAmount,
        uint256 _amountOutMin,
        address _currentContract
    ) private returns (uint256[] memory swapResult) {
        address uniswapV2RouterCached = uniswapV2Router;
        address[] memory path = new address[](2);
        path[0] = _weth;
        path[1] = _codeupERC20;
        uint256[] memory amounts = IUniswapV2Router(uniswapV2RouterCached)
            .getAmountsOut(_wethAmount, path);
        IERC20(_weth).safeIncreaseAllowance(uniswapV2RouterCached, _wethAmount);
        swapResult = IUniswapV2Router(uniswapV2RouterCached)
            .swapExactTokensForTokens(
                amounts[0],
                _amountOutMin,
                path,
                _currentContract,
                block.timestamp
            );
    }

    /// @notice Function perfoms adding liquidity to uniswapV2Pool
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address currentContract
    ) private {
        address uniswapV2RouterCached = uniswapV2Router;
        IERC20(tokenA).safeIncreaseAllowance(
            uniswapV2RouterCached,
            amountADesired
        );
        IERC20(tokenB).safeIncreaseAllowance(
            uniswapV2RouterCached,
            amountBDesired
        );
        IUniswapV2Router(uniswapV2RouterCached).addLiquidity(
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            currentContract,
            block.timestamp
        );
    }

    /// @notice Function for locking LP tokens.
    /// If contract has LP tokens, it will send them to address(0)
    function _lockLP(address currentContract) private {
        address uniswapV2PoolCached = uniswapV2Pool;
        if (IERC20(uniswapV2PoolCached).balanceOf(currentContract) >= 1) {
            IERC20(uniswapV2PoolCached).safeTransfer(
                address(0),
                IERC20(uniswapV2PoolCached).balanceOf(currentContract)
            );
        }
    }

    function _selfBalance() private view returns (uint256) {
        uint256 self;
        assembly {
            self := selfbalance()
        }
        return self;
    }

    function _checkValue(uint256 argument) private pure {
        require(argument > 0, ZeroValue());
    }
}
