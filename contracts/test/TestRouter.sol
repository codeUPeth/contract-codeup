// SPDX-License-Identifier: MIT

pragma solidity 0.8.27;

import {IUniswapV2Router} from "../interfaces/IUniswapV2Router.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestRouter is IUniswapV2Router, ERC20 {
    address private _weth;
    address private _factory;

    constructor(address weth_, address factory_) ERC20("LP", "LP") {
        _weth = weth_;
        _factory = factory_;
    }

    function WETH() external view override returns (address) {
        return _weth;
    }

    function factory() external view override returns (address) {
        return _factory;
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        override
        returns (uint256 amountA, uint256 amountB, uint256 liquidity)
    {
        _mint(to, 1e6);
    }

    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view override returns (uint256[] memory amounts) {
        return amounts;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        return amounts;
    }
}
