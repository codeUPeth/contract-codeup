// SPDX-License-Identifier: MIT

pragma solidity 0.8.27;

import {CodeupERC20} from "../CodeupERC20.sol";
import {Codeup} from "../Codeup.sol";

contract TestCodeup is Codeup {
    constructor(
        uint256 _startDate,
        uint256 _gameETHPrice,
        address _uniswapV2Router,
        address _codeupERC20
    ) Codeup(_startDate, _gameETHPrice, _uniswapV2Router, _codeupERC20) {}

    function getYield(
        uint256 _floorId,
        uint256 _builderId
    ) external pure returns (uint256) {
        return _getYield(_floorId, _builderId);
    }
}
