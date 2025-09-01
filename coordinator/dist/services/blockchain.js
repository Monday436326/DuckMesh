"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainService = void 0;
const ethers_1 = require("ethers");
class BlockchainService {
    constructor(rpcUrl, privateKey, jobMarketAddress, providerRegistryAddress) {
        this.provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers_1.ethers.Wallet(privateKey, this.provider);
        // Contract ABIs (simplified)
        const jobMarketAbi = [
            "function getJob(uint256 jobId) external view returns (tuple(uint256 id, address client, string specHash, string modelId, uint256 maxPrice, uint256 actualPrice, uint8 verificationMode, uint256 timeout, uint256 createdAt, address assignedProvider, string resultHash, bytes receiptSig, uint8 status, uint256 escrowAmount))",
            "function finalizeJob(uint256 jobId) external",
            "function disputeJob(uint256 jobId, string reason) external",
            "event JobPosted(uint256 indexed jobId, address indexed client, string modelId, uint256 maxPrice)"
        ];
        const providerRegistryAbi = [
            "function getActiveProviders() external view returns (address[] memory)",
            "function providers(address) external view returns (tuple(address owner, string pubkey, string endpoint, string metadataURI, uint256 stakedAmount, uint256 reputation, uint256 totalJobs, uint256 successfulJobs, uint256 lastHeartbeat, bool isActive))"
        ];
        this.jobMarketContract = new ethers_1.ethers.Contract(jobMarketAddress, jobMarketAbi, this.wallet);
        this.providerRegistryContract = new ethers_1.ethers.Contract(providerRegistryAddress, providerRegistryAbi, this.wallet);
    }
    async getJob(jobId) {
        try {
            const jobData = await this.jobMarketContract.getJob(jobId);
            return {
                id: Number(jobData.id),
                client: jobData.client,
                specHash: jobData.specHash,
                modelId: jobData.modelId,
                maxPrice: Number(jobData.maxPrice),
                verificationMode: jobData.verificationMode,
                timeout: Number(jobData.timeout),
                status: jobData.status,
                assignedProvider: jobData.assignedProvider !== ethers_1.ethers.ZeroAddress ? jobData.assignedProvider : undefined,
                resultHash: jobData.resultHash || undefined,
            };
        }
        catch (error) {
            console.error('Error fetching job:', error);
            return null;
        }
    }
    async getActiveProviders() {
        try {
            const addresses = await this.providerRegistryContract.getActiveProviders();
            const providers = [];
            for (const address of addresses) {
                const providerData = await this.providerRegistryContract.providers(address);
                providers.push({
                    address,
                    pubkey: providerData.pubkey,
                    endpoint: providerData.endpoint,
                    stakedAmount: Number(providerData.stakedAmount),
                    reputation: Number(providerData.reputation),
                    lastHeartbeat: Number(providerData.lastHeartbeat),
                    isActive: providerData.isActive,
                });
            }
            return providers;
        }
        catch (error) {
            console.error('Error fetching providers:', error);
            return [];
        }
    }
    async finalizeJob(jobId) {
        try {
            const tx = await this.jobMarketContract.finalizeJob(jobId);
            await tx.wait();
        }
        catch (error) {
            console.error('Error finalizing job:', error);
            throw error;
        }
    }
    async listenForNewJobs(callback) {
        this.jobMarketContract.on("JobPosted", (jobId) => {
            callback(Number(jobId));
        });
    }
    async disconnect() {
        // Clean up event listeners
        this.jobMarketContract.removeAllListeners();
        this.providerRegistryContract.removeAllListeners();
    }
}
exports.BlockchainService = BlockchainService;
