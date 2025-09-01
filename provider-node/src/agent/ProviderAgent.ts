import { ethers } from 'ethers';
import { InferenceEngine } from '../inference/InferenceEngine';
import { AttestationService } from '../attestation/AttestationService';
import { JobSpec, InferenceResult } from '../types';

export class ProviderAgent {
  private inferenceEngine: InferenceEngine;
  private attestationService: AttestationService;
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private jobMarketContract: ethers.Contract;
  private providerRegistryContract: ethers.Contract;
  private activeJobs: Map<number, any> = new Map();
  private heartbeatInterval?: NodeJS.Timeout;

  constructor() {
    this.inferenceEngine = new InferenceEngine();
    this.attestationService = new AttestationService();
    
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL!);
    this.wallet = new ethers.Wallet(process.env.PROVIDER_PRIVATE_KEY!, this.provider);
    
    // Initialize contracts
    const jobMarketAbi = [
      "function acceptJob(uint256 jobId, uint256 bidPrice) external",
      "function submitResult(uint256 jobId, string resultHash, bytes receiptSig) external"
    ];
    
    const providerRegistryAbi = [
      "function heartbeat(bytes signature, uint256 blockNumber) external"
    ];
    
    this.jobMarketContract = new ethers.Contract(
      process.env.JOB_MARKET_ADDRESS!,
      jobMarketAbi,
      this.wallet
    );
    
    this.providerRegistryContract = new ethers.Contract(
      process.env.PROVIDER_REGISTRY_ADDRESS!,
      providerRegistryAbi,
      this.wallet
    );
  }

  async start(): Promise<void> {
    console.log('Starting provider agent...');
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Initialize inference engine
    await this.inferenceEngine.initialize();
    
    console.log('Provider agent started successfully');
  }

  async stop(): Promise<void> {
    console.log('Stopping provider agent...');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Wait for active jobs to complete
    await this.waitForJobsToComplete();
    
    console.log('Provider agent stopped');
  }

  async acceptJob(jobId: number, spec: JobSpec, timeout: number, client: string): Promise<boolean> {
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
    } catch (error) {
      console.error('Failed to accept job:', error);
      return false;
    }
  }

  async getJobResult(jobId: number): Promise<InferenceResult | null> {
    return this.inferenceEngine.getResult(jobId);
  }

  private async processJob(jobId: number, spec: JobSpec, timeout: number): Promise<void> {
    try {
      console.log(`Processing job ${jobId}...`);
      
      // Run inference
      const result = await this.inferenceEngine.runInference(jobId, spec);
      
      // Generate attestation if supported
      if (process.env.TEE_ENABLED === 'true') {
        const attestation = await this.attestationService.generateAttestation(
          result,
          spec
        );
        result.signature = attestation;
      }

      // Submit result to blockchain
      const resultHash = this.generateResultHash(result);
      const receiptSig = await this.generateReceiptSignature(jobId, resultHash);
      
      const tx = await this.jobMarketContract.submitResult(
        jobId,
        resultHash,
        receiptSig
      );
      await tx.wait();

      console.log(`Job ${jobId} completed and submitted`);
      this.activeJobs.delete(jobId);

    } catch (error) {
      console.error(`Job processing failed for job ${jobId}:`, error);
      this.activeJobs.delete(jobId);
    }
  }

  private calculateBidPrice(spec: JobSpec): bigint {
    // Simple pricing based on expected tokens
    const basePrice = 100n; // Base price in wei
    const tokenMultiplier = BigInt(Math.floor(spec.maxTokens / 1000));
    const complexityMultiplier = spec.temperature > 0.7 ? 15n : 10n; // Using integers for precision
    
    return (basePrice * tokenMultiplier * complexityMultiplier) / 10n;
  }

  private generateResultHash(result: InferenceResult): string {
    const crypto = require('crypto');
    const data = JSON.stringify({
      output: result.output,
      metadata: result.metadata
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async generateReceiptSignature(jobId: number, resultHash: string): Promise<string> {
    const message = ethers.solidityPackedKeccak256(
      ['uint256', 'string'],
      [jobId, resultHash]
    );
    
    return await this.wallet.signMessage(ethers.getBytes(message));
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        const blockNumber = await this.provider.getBlockNumber();
        const signature = await this.generateHeartbeatSignature(blockNumber);
        
        const tx = await this.providerRegistryContract.heartbeat(signature, blockNumber);
        await tx.wait();
        
        console.log(`Heartbeat sent for block ${blockNumber}`);
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    }, 60000); // Every minute
  }

  private async generateHeartbeatSignature(blockNumber: number): Promise<string> {
    const message = ethers.solidityPackedKeccak256(
      ['uint256', 'address'],
      [blockNumber, this.wallet.address]
    );
    
    return await this.wallet.signMessage(ethers.getBytes(message));
  }

  private async waitForJobsToComplete(): Promise<void> {
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