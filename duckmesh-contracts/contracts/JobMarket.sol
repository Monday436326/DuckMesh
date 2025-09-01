// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./DuckToken.sol";
import "./ProviderRegistry.sol";

contract JobMarket is ReentrancyGuard, Ownable {
    DuckToken public immutable duckToken;
    ProviderRegistry public immutable providerRegistry;
    
    enum JobStatus { Pending, Assigned, Completed, Disputed, Finalized }
    enum VerificationMode { Redundant, ReferenceCheck, Attestation, ZkML }
    
    struct Job {
        uint256 id;
        address client;
        string specHash;
        string modelId;
        uint256 maxPrice;
        uint256 actualPrice;
        VerificationMode verificationMode;
        uint256 timeout;
        uint256 createdAt;
        address assignedProvider;
        string resultHash;
        bytes receiptSig;
        JobStatus status;
        uint256 escrowAmount;
    }
    
    mapping(uint256 => Job) public jobs;
    mapping(address => uint256[]) public clientJobs;
    mapping(address => uint256[]) public providerJobs;
    
    uint256 public jobCounter;
    uint256 public constant PROVIDER_BOND = 100 * 10**18; // 100 DUCK bond per job
    
    event JobPosted(uint256 indexed jobId, address indexed client, string modelId, uint256 maxPrice);
    event JobAccepted(uint256 indexed jobId, address indexed provider);
    event JobCompleted(uint256 indexed jobId, string resultHash);
    event JobFinalized(uint256 indexed jobId, uint256 finalPrice);
    event JobDisputed(uint256 indexed jobId, string reason);
    
    constructor(address _duckToken, address _providerRegistry, address initialOwner) Ownable(initialOwner) {
        duckToken = DuckToken(_duckToken);
        providerRegistry = ProviderRegistry(_providerRegistry);
    }
    
    function postJob(
        string calldata specHash,
        string calldata modelId,
        uint256 maxPrice,
        VerificationMode verificationMode,
        uint256 timeout
    ) external nonReentrant returns (uint256) {
        require(maxPrice > 0, "Invalid max price");
        require(timeout > 0, "Invalid timeout");
        
        uint256 escrowAmount = maxPrice + (maxPrice * 10 / 100); // 10% buffer
        require(
            duckToken.transferFrom(msg.sender, address(this), escrowAmount),
            "Escrow transfer failed"
        );
        
        uint256 jobId = ++jobCounter;
        
        jobs[jobId] = Job({
            id: jobId,
            client: msg.sender,
            specHash: specHash,
            modelId: modelId,
            maxPrice: maxPrice,
            actualPrice: 0,
            verificationMode: verificationMode,
            timeout: timeout,
            createdAt: block.timestamp,
            assignedProvider: address(0),
            resultHash: "",
            receiptSig: "",
            status: JobStatus.Pending,
            escrowAmount: escrowAmount
        });
        
        clientJobs[msg.sender].push(jobId);
        
        emit JobPosted(jobId, msg.sender, modelId, maxPrice);
        return jobId;
    }
    
    function acceptJob(uint256 jobId, uint256 bidPrice) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Pending, "Job not available");
        require(bidPrice <= job.maxPrice, "Bid too high");
        require(block.timestamp < job.createdAt + job.timeout, "Job expired");
        
        (,,,,,,,,, bool isActive) = providerRegistry.providers(msg.sender);
        require(isActive, "Provider not active");
        
        require(
            duckToken.transferFrom(msg.sender, address(this), PROVIDER_BOND),
            "Provider bond transfer failed"
        );
        
        job.assignedProvider = msg.sender;
        job.actualPrice = bidPrice;
        job.status = JobStatus.Assigned;
        
        providerJobs[msg.sender].push(jobId);
        
        emit JobAccepted(jobId, msg.sender);
    }
    
    function submitResult(
        uint256 jobId,
        string calldata resultHash,
        bytes calldata receiptSig
    ) external {
        Job storage job = jobs[jobId];
        require(job.assignedProvider == msg.sender, "Not assigned provider");
        require(job.status == JobStatus.Assigned, "Invalid job status");
        
        job.resultHash = resultHash;
        job.receiptSig = receiptSig;
        job.status = JobStatus.Completed;
        
        emit JobCompleted(jobId, resultHash);
    }
    
    function finalizeJob(uint256 jobId) external onlyOwner nonReentrant {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Completed, "Job not completed");
        
        job.status = JobStatus.Finalized;
        
        // Transfer payment to provider
        require(
            duckToken.transfer(job.assignedProvider, job.actualPrice),
            "Payment transfer failed"
        );
        
        // Return provider bond
        require(
            duckToken.transfer(job.assignedProvider, PROVIDER_BOND),
            "Bond return failed"
        );
        
        // Return excess escrow to client
        uint256 refund = job.escrowAmount - job.actualPrice;
        if (refund > 0) {
            require(
                duckToken.transfer(job.client, refund),
                "Refund transfer failed"
            );
        }
        
        // Update provider reputation
        providerRegistry.updateReputation(job.assignedProvider, true);
        
        emit JobFinalized(jobId, job.actualPrice);
    }
    
    function disputeJob(uint256 jobId, string calldata reason) external {
        Job storage job = jobs[jobId];
        require(job.client == msg.sender, "Not job client");
        require(job.status == JobStatus.Completed, "Invalid job status");
        
        job.status = JobStatus.Disputed;
        
        emit JobDisputed(jobId, reason);
    }
    
    function resolveDispute(
        uint256 jobId,
        bool providerWins,
        uint256 slashAmount
    ) external onlyOwner nonReentrant {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Disputed, "No dispute");
        
        if (providerWins) {
            // Provider wins - finalize normally
            job.status = JobStatus.Finalized;
            
            require(
                duckToken.transfer(job.assignedProvider, job.actualPrice + PROVIDER_BOND),
                "Provider payment failed"
            );
            
            uint256 refund = job.escrowAmount - job.actualPrice;
            if (refund > 0) {
                require(
                    duckToken.transfer(job.client, refund),
                    "Client refund failed"
                );
            }
            
            providerRegistry.updateReputation(job.assignedProvider, true);
        } else {
            // Client wins - slash provider
            job.status = JobStatus.Finalized;
            
            if (slashAmount > 0) {
                providerRegistry.slash(job.assignedProvider, slashAmount, "Dispute resolution");
            }
            
            // Return escrow to client
            require(
                duckToken.transfer(job.client, job.escrowAmount),
                "Client refund failed"
            );
            
            providerRegistry.updateReputation(job.assignedProvider, false);
        }
        
        emit JobFinalized(jobId, providerWins ? job.actualPrice : 0);
    }
    
    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }
    
    function getClientJobs(address client) external view returns (uint256[] memory) {
        return clientJobs[client];
    }
    
    function getProviderJobs(address provider) external view returns (uint256[] memory) {
        return providerJobs[provider];
    }
}