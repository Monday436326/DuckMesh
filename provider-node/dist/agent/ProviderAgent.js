"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderAgent = void 0;
const ethers_1 = require("ethers");
const InferenceEngine_1 = require("../inference/InferenceEngine");
const AttestationService_1 = require("../attestation/AttestationService");
class ProviderAgent {
    constructor() {
        this.activeJobs = new Map();
        this.inferenceEngine = new InferenceEngine_1.InferenceEngine();
        this.attestationService = new AttestationService_1.AttestationService();
        this.provider = new ethers_1.ethers.JsonRpcProvider(process.env.RPC_URL);
        this.wallet = new ethers_1.ethers.Wallet(process.env.PROVIDER_PRIVATE_KEY, this.provider);
        // Initialize contracts
        const jobMarketAbi = [
            "function acceptJob(uint256 jobId, uint256 bidPrice) external",
            "function submitResult(uint256 jobId, string resultHash, bytes receiptSig) external"
        ];
        const providerRegistryAbi = [
            "function heartbeat(bytes signature, uint256 blockNumber) external"
        ];
        this.jobMarketContract = new ethers_1.ethers.Contract(process.env.JOB_MARKET_ADDRESS, jobMarketAbi, this.wallet);
        this.providerRegistryContract = new ethers_1.ethers.Contract(process.env.PROVIDER_REGISTRY_ADDRESS, providerRegistryAbi, this.wallet);
    }
    async start() {
        console.log('Starting provider agent...');
        // Start heartbeat
        this.startHeartbeat();
        // Initialize inference engine
        await this.inferenceEngine.initialize();
        console.log('Provider agent started successfully');
    }
    async stop() {
        console.log('Stopping provider agent...');
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        // Wait for active jobs to complete
        await this.waitForJobsToComplete();
        console.log('Provider agent stopped');
    }
    async acceptJob(jobId, spec, timeout, client) {
        try {
            // Check if we can handle this job
            const canHandle = await this.inferenceEngine.canHandleJob(spec);
            if (!canHandle) {
                return false;
            }
            // Calculate bid price based on complexity
            const bidPrice = this.calculateBidPrice(spec);
            // Accept job on blockchain
            const tx = await this.jobMarketContract.acceptJob(jobId, bidPrice);
            await tx.wait();
            // Start processing
            this.processJob(jobId, spec, timeout);
            this.activeJobs.set(jobId, {
                spec,
                timeout,
                client,
                startTime: Date.now()
            });
            return true;
        }
        catch (error) {
            console.error('Failed to accept job:', error);
            return false;
        }
    }
    async getJobResult(jobId) {
        return this.inferenceEngine.getResult(jobId);
    }
    async processJob(jobId, spec, timeout) {
        try {
            console.log(`Processing job ${jobId}...`);
            // Run inference
            const result = await this.inferenceEngine.runInference(jobId, spec);
            // Generate attestation if supported
            if (process.env.TEE_ENABLED === 'true') {
                const attestation = await this.attestationService.generateAttestation(result, spec);
                result.signature = attestation;
            }
            // Submit result to blockchain
            const resultHash = this.generateResultHash(result);
            const receiptSig = await this.generateReceiptSignature(jobId, resultHash);
            const tx = await this.jobMarketContract.submitResult(jobId, resultHash, receiptSig);
            await tx.wait();
            console.log(`Job ${jobId} completed and submitted`);
            this.activeJobs.delete(jobId);
        }
        catch (error) {
            console.error(`Job processing failed for job ${jobId}:`, error);
            this.activeJobs.delete(jobId);
        }
    }
    calculateBidPrice(spec) {
        // Simple pricing based on expected tokens
        const basePrice = 100n; // Base price in wei
        const tokenMultiplier = BigInt(Math.floor(spec.maxTokens / 1000));
        const complexityMultiplier = spec.temperature > 0.7 ? 15n : 10n; // Using integers for precision
        return (basePrice * tokenMultiplier * complexityMultiplier) / 10n;
    }
    generateResultHash(result) {
        const crypto = require('crypto');
        const data = JSON.stringify({
            output: result.output,
            metadata: result.metadata
        });
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    async generateReceiptSignature(jobId, resultHash) {
        const message = ethers_1.ethers.solidityPackedKeccak256(['uint256', 'string'], [jobId, resultHash]);
        return await this.wallet.signMessage(ethers_1.ethers.getBytes(message));
    }
    startHeartbeat() {
        this.heartbeatInterval = setInterval(async () => {
            try {
                const blockNumber = await this.provider.getBlockNumber();
                const signature = await this.generateHeartbeatSignature(blockNumber);
                const tx = await this.providerRegistryContract.heartbeat(signature, blockNumber);
                await tx.wait();
                console.log(`Heartbeat sent for block ${blockNumber}`);
            }
            catch (error) {
                console.error('Heartbeat failed:', error);
            }
        }, 60000); // Every minute
    }
    async generateHeartbeatSignature(blockNumber) {
        const message = ethers_1.ethers.solidityPackedKeccak256(['uint256', 'address'], [blockNumber, this.wallet.address]);
        return await this.wallet.signMessage(ethers_1.ethers.getBytes(message));
    }
    async waitForJobsToComplete() {
        const maxWait = 30000; // 30 seconds max
        const start = Date.now();
        while (this.activeJobs.size > 0 && (Date.now() - start) < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (this.activeJobs.size > 0) {
            console.warn(`Shutting down with ${this.activeJobs.size} active jobs`);
        }
    }
}
exports.ProviderAgent = ProviderAgent;
//# sourceMappingURL=ProviderAgent.js.map