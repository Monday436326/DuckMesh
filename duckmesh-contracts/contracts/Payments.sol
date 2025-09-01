// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./DuckToken.sol";

contract Payments is ReentrancyGuard, Ownable {
    DuckToken public immutable duckToken;
    
    struct Receipt {
        uint256 jobId;
        address provider;
        address client;
        uint256 amount;
        uint256 timestamp;
        string resultHash;
        bytes signature;
    }
    
    mapping(uint256 => Receipt) public receipts;
    mapping(address => uint256) public providerEarnings;
    mapping(address => uint256) public clientSpending;
    
    event PaymentSettled(uint256 indexed jobId, address indexed provider, uint256 amount);
    event ReceiptGenerated(uint256 indexed jobId, string resultHash);
    
    constructor(address _duckToken, address initialOwner) Ownable(initialOwner) {
        duckToken = DuckToken(_duckToken);
    }
    
    function settle(
        uint256 jobId,
        address provider,
        address client,
        uint256 amount,
        string calldata resultHash,
        bytes calldata signature
    ) external onlyOwner nonReentrant {
        require(receipts[jobId].jobId == 0, "Already settled");
        
        receipts[jobId] = Receipt({
            jobId: jobId,
            provider: provider,
            client: client,
            amount: amount,
            timestamp: block.timestamp,
            resultHash: resultHash,
            signature: signature
        });
        
        providerEarnings[provider] += amount;
        clientSpending[client] += amount;
        
        emit PaymentSettled(jobId, provider, amount);
        emit ReceiptGenerated(jobId, resultHash);
    }
    
    function getReceipt(uint256 jobId) external view returns (Receipt memory) {
        return receipts[jobId];
    }
}