// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract InventoryTracker {
    address public owner;

    event QueryRecorded(address indexed shopkeeper, uint256 timestamp);

    constructor() {
        owner = msg.sender;
    }

    function recordQuery(address shopkeeper) external {
        emit QueryRecorded(shopkeeper, block.timestamp);
    }
}