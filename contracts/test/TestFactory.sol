// SPDX-License-Identifier: MIT

pragma solidity 0.8.27;

import {Codeup} from "../Codeup.sol";

contract TestFactory {
    Codeup private codeup;

    constructor() {}

    function setCodeup(address _codeup) external {
        codeup = Codeup(_codeup);
    }

    function createPair(
        address tokenA,
        address tokenB
    ) external returns (address pair) {
        pair = address(this);
        codeup.claimCodeupERC20(tx.origin);
    }
}
