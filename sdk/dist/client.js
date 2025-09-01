"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuckMeshClient = void 0;
// sdk/src/client.ts
const ethers_1 = require("ethers");
const axios_1 = __importDefault(require("axios"));
const types_1 = require("./types");
class DuckMeshClient {
    constructor(rpcOrProvider, privateKeyOrSigner, jobMarketAddress, duckTokenAddress, coordinatorUrl) {
        // handle provider
        if (typeof rpcOrProvider === 'string') {
            this.provider = new ethers_1.ethers.JsonRpcProvider(rpcOrProvider);
        }
        else {
            this.provider = rpcOrProvider;
        }
        // handle wallet/signer
        if (typeof privateKeyOrSigner === 'string') {
            this.wallet = new ethers_1.ethers.Wallet(privateKeyOrSigner, this.provider);
        }
        else {
            this.wallet = privateKeyOrSigner.connect
                ? privateKeyOrSigner.connect(this.provider)
                : privateKeyOrSigner;
        }
        this.coordinatorUrl = coordinatorUrl;
        const jobMarketAbi = [
            "event JobPosted(uint256 indexed jobId, address indexed client)",
            "function postJob(string specHash, string modelId, uint256 maxPrice, uint8 verificationMode, uint256 timeout) external payable returns (uint256)",
            "function getJob(uint256 jobId) external view returns (tuple(uint256 id, address client, string specHash, string modelId, uint256 maxPrice, uint256 actualPrice, uint8 verificationMode, uint256 timeout, uint256 createdAt, address assignedProvider, string resultHash, bytes receiptSig, uint8 status, uint256 escrowAmount))",
            "function disputeJob(uint256 jobId, string reason) external"
        ];
        const duckTokenAbi = [
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function balanceOf(address account) external view returns (uint256)"
        ];
        this.jobMarketContract = new ethers_1.ethers.Contract(jobMarketAddress, jobMarketAbi, this.wallet);
        this.duckTokenContract = new ethers_1.ethers.Contract(duckTokenAddress, duckTokenAbi, this.wallet);
    }
    async submitJob(modelId, jobSpec, maxPrice, verificationMode = types_1.VerificationMode.Redundant, timeout = 3600) {
        try {
            const specHash = this.hashJobSpec(jobSpec);
            await this.storeJobSpec(specHash, jobSpec);
            const escrowAmount = maxPrice + Math.floor(maxPrice * 0.1);
            const approveTx = await this.duckTokenContract.approve(this.jobMarketContract.address, escrowAmount);
            await approveTx.wait();
            const tx = await this.jobMarketContract.postJob(specHash, modelId, maxPrice, verificationMode, timeout);
            const receipt = await tx.wait();
            const jobPostedEvent = receipt.events?.find((e) => e.event === 'JobPosted');
            const jobId = jobPostedEvent?.args?.jobId?.toNumber();
            if (!jobId)
                throw new Error('Failed to extract job ID from transaction');
            console.log(`Job ${jobId} submitted successfully`);
            return jobId;
        }
        catch (error) {
            console.error('Job submission failed:', error);
            throw error;
        }
    }
    async waitForResult(jobId, pollInterval = 5000) {
        return new Promise((resolve, reject) => {
            const poll = async () => {
                try {
                    const job = await this.getJobStatus(jobId);
                    if (job.status === types_1.JobStatus.Finalized) {
                        const result = await this.getJobResult(jobId);
                        resolve(result);
                    }
                    else if (job.status === types_1.JobStatus.Disputed) {
                        reject(new Error('Job was disputed'));
                    }
                    else {
                        setTimeout(poll, pollInterval);
                    }
                }
                catch (error) {
                    reject(error);
                }
            };
            poll();
        });
    }
    async getJobStatus(jobId) {
        const jobData = await this.jobMarketContract.getJob(jobId);
        return {
            id: jobData.id.toNumber(),
            client: jobData.client,
            modelId: jobData.modelId,
            status: jobData.status,
            assignedProvider: jobData.assignedProvider,
            resultHash: jobData.resultHash
        };
    }
    async getJobResult(jobId) {
        try {
            const response = await axios_1.default.get(`${this.coordinatorUrl}/jobs/${jobId}/result`);
            return response.data;
        }
        catch (error) {
            console.error('Failed to get job result:', error);
            throw error;
        }
    }
    async disputeJob(jobId, reason) {
        try {
            const tx = await this.jobMarketContract.disputeJob(jobId, reason);
            await tx.wait();
            console.log(`Job ${jobId} disputed: ${reason}`);
        }
        catch (error) {
            console.error('Dispute failed:', error);
            throw error;
        }
    }
    async getBalance() {
        const address = await this.wallet.getAddress();
        const balance = await this.duckTokenContract.balanceOf(address);
        return balance.toNumber();
    }
    hashJobSpec(spec) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(JSON.stringify(spec)).digest('hex');
    }
    async storeJobSpec(specHash, spec) {
        try {
            await axios_1.default.post(`${this.coordinatorUrl}/specs`, {
                hash: specHash,
                spec
            });
        }
        catch (error) {
            console.error('Failed to store job spec:', error);
            throw error;
        }
    }
}
exports.DuckMeshClient = DuckMeshClient;
