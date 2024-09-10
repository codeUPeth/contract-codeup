// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CodeupERC20 is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1 ether;

    constructor(
        address initialOwner,
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) Ownable(initialOwner) {
        _mint(initialOwner, MAX_SUPPLY);
    }
}
