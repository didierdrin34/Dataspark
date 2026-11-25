// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Harvest (HVST)
/// @notice Reward + staking token of the DataSpark platform. TESTNET (Sepolia) build: no monetary value.
/// @dev Initial supply goes to a treasury. Further minting is only possible for contracts holding
///      MINTER_ROLE (HarvestLedger, PlaybookRegistry) and can never exceed MAX_SUPPLY.
contract HVST is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant MAX_SUPPLY = 100_000_000 ether;
    uint256 public constant INITIAL_SUPPLY = 20_000_000 ether;

    constructor(address admin, address treasury) ERC20("Harvest", "HVST") {
        require(admin != address(0) && treasury != address(0), "zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _mint(treasury, INITIAL_SUPPLY);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "max supply");
        _mint(to, amount);
    }
}
