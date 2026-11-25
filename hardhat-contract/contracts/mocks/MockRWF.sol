// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice TESTNET ONLY. Simulates Rwandan francs (0 decimals, so 1 token = 1 mRWF) for escrow demos.
contract MockRWF is ERC20 {
    uint256 public constant DRIP = 5_000_000;
    mapping(address => uint256) public lastDrip;

    constructor() ERC20("Mock Rwandan Franc", "mRWF") {}

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    /// @notice Free test funds, once per day per wallet.
    function faucet() external {
        require(block.timestamp >= lastDrip[msg.sender] + 1 days, "come back tomorrow");
        lastDrip[msg.sender] = block.timestamp;
        _mint(msg.sender, DRIP);
    }
}
