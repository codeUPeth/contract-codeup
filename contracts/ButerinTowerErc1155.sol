// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IButerinTower} from "./interfaces/IButerinTower.sol";

contract ButerinTowerErc1155 is ERC1155, Ownable {
    IButerinTower public buterinTower; /// @notice ButerinTower contract address
    uint8 public constant TOTAL_CODERS = 40; /// @notice Total number of coders

    mapping(address => bool) public isMinted; /// @notice Mapping to check if an account has minted

    event ButerinTowerUpdated(address indexed buterinTower);

    constructor(
        string memory _uri, /// @param _uri URI for the token
        address _owner, /// @param _owner Owner of the contract
        address _buterinTower /// @param _buterinTower ButerinTower contract address
    ) ERC1155(_uri) Ownable(_owner) {
        require(_owner != address(0), "Owner cannot be the zero address");
        require(bytes(_uri).length > 0, "URI cannot be empty");
        require(
            _buterinTower != address(0),
            "ButerinTower cannot be the zero address"
        );
        buterinTower = IButerinTower(_buterinTower);
    }

    /// @notice Update ButerinTower contract address
    /// @param _buterinTower New ButerinTower contract address
    function updateButerinTower(address _buterinTower) external onlyOwner {
        require(
            _buterinTower != address(0),
            "ButerinTower cannot be the zero address"
        );
        buterinTower = IButerinTower(_buterinTower);
        emit ButerinTowerUpdated(_buterinTower);
    }

    /// @notice Update URI for the collection
    /// @param _uri New URI
    function updateUri(string memory _uri) external onlyOwner {
        require(bytes(_uri).length > 0, "URI cannot be empty");
        _setURI(_uri);
    }

    /// @notice Mint a token to an account. Mint will be allowed only if the account
    /// has all the 40 coders in all Buterin Tower floors
    /// @param _account Account to mint the token
    function mint(address _account) external {
        require(isMintAllowed(_account), "Mint not allowed");
        require(!isMinted[_account], "Already minted");
        isMinted[_account] = true;
        _mint(_account, 0, 1, "");
    }

    /// @notice Check if mint is allowed for an account
    /// @param _account Account to check
    /// @return bool True if mint is allowed, false otherwise
    function isMintAllowed(address _account) public view returns (bool) {
        uint8[8] memory coders = buterinTower.getBuilders(_account);
        uint8 count;
        for (uint8 i = 0; i < 8; i++) {
            count += coders[i];
        }

        if (count == TOTAL_CODERS) {
            return true;
        } else {
            return false;
        }
    }
}
