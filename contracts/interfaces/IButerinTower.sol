// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

interface IButerinTower {
    function getCoders(address addr) external view returns (uint8[8] memory);
}
