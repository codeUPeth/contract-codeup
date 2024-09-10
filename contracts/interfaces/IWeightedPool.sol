// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

interface IWeightedPool {
    function getPoolId() external view returns (bytes32);

    function getNormalizedWeights() external view returns (uint256[] memory);

    function name() external view returns (string memory);
}
