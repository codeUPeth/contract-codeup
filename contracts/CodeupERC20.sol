// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity 0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CodeupERC20 is ERC20, Ownable {
    uint256 private constant MAX_SUPPLY = 1000_000_000 ether;

    error TransferFailed();

    constructor(
        address _initialOwner,
        string memory _name,
        string memory _symbol
    ) payable ERC20(_name, _symbol) Ownable(_initialOwner) {
        _mint(_initialOwner, MAX_SUPPLY);
    }
}
