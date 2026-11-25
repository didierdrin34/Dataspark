// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice TESTNET ONLY. Gives demo playbook authors HVST to stake.
contract HVSTFaucet {
    IERC20 public immutable token;
    uint256 public constant DRIP = 500 ether;
    mapping(address => uint256) public lastDrip;

    constructor(IERC20 _token) {
        token = _token;
    }

    function drip() external {
        require(block.timestamp >= lastDrip[msg.sender] + 1 days, "come back tomorrow");
        lastDrip[msg.sender] = block.timestamp;
        require(token.transfer(msg.sender, DRIP), "faucet empty");
    }
}
