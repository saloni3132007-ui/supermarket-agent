// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract InventoryTracker {
    address public owner;
    uint256 public totalQueries;

    struct QueryRecord {
        address shopkeeper;
        uint256 timestamp;
        string queryType;
    }

    mapping(address => uint256) public queriesByShopkeeper;
    QueryRecord[] public queryHistory;

    event QueryRecorded(
        address indexed shopkeeper,
        uint256 timestamp,
        string queryType,
        uint256 totalQueries
    );

    constructor() {
        owner = msg.sender;
    }

    function recordQuery(address shopkeeper, string calldata queryType) external {
        require(shopkeeper != address(0), "Invalid address");
        require(bytes(queryType).length > 0, "Empty queryType");

        totalQueries += 1;
        queriesByShopkeeper[shopkeeper] += 1;

        queryHistory.push(QueryRecord({
            shopkeeper: shopkeeper,
            timestamp: block.timestamp,
            queryType: queryType
        }));

        emit QueryRecorded(shopkeeper, block.timestamp, queryType, totalQueries);
    }

    function getShopkeeperQueryCount(address shopkeeper) external view returns (uint256) {
        return queriesByShopkeeper[shopkeeper];
    }

    function getTotalQueries() external view returns (uint256) {
        return totalQueries;
    }

    function getHistoryLength() external view returns (uint256) {
        return queryHistory.length;
    }
}