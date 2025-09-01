// sdk/src/client.ts
import { ethers } from 'ethers';
import axios from 'axios';
import { JobSpec, InferenceResult, JobStatus, VerificationMode } from './types';

export class DuckMeshClient {
  private provider: ethers.Provider;
  private wallet: ethers.Signer;
  private jobMarketContract: ethers.Contract;
  private duckTokenContract: ethers.Contract;
  private coordinatorUrl: string;

  constructor(
    rpcOrProvider: string | ethers.Provider,
    privateKeyOrSigner: string | ethers.Signer,
    jobMarketAddress: string,
    duckTokenAddress: string,
    coordinatorUrl: string
  ) {
    // handle provider
    if (typeof rpcOrProvider === 'string') {
      this.provider = new ethers.JsonRpcProvider(rpcOrProvider);
    } else {
      this.provider = rpcOrProvider;
    }

    // handle wallet/signer
    if (typeof privateKeyOrSigner === 'string') {
      this.wallet = new ethers.Wallet(privateKeyOrSigner, this.provider);
    } else {
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

    this.jobMarketContract = new ethers.Contract(jobMarketAddress, jobMarketAbi, this.wallet);
    this.duckTokenContract = new ethers.Contract(duckTokenAddress, duckTokenAbi, this.wallet);
  }

  async submitJob(
    modelId: string,
    jobSpec: JobSpec,
    maxPrice: number,
    verificationMode: VerificationMode = VerificationMode.Redundant,
    timeout: number = 3600
  ): Promise<number> {
    try {
      const specHash = this.hashJobSpec(jobSpec);
      await this.storeJobSpec(specHash, jobSpec);

      const escrowAmount = maxPrice + Math.floor(maxPrice * 0.1);

      const approveTx = await this.duckTokenContract.approve(
        this.jobMarketContract.address,
        escrowAmount
      );
      await approveTx.wait();

      const tx = await this.jobMarketContract.postJob(
        specHash,
        modelId,
        maxPrice,
        verificationMode,
        timeout
      );
      const receipt = await tx.wait();

      const jobPostedEvent = receipt.events?.find((e: any) => e.event === 'JobPosted');
      const jobId = jobPostedEvent?.args?.jobId?.toNumber();

      if (!jobId) throw new Error('Failed to extract job ID from transaction');

      console.log(`Job ${jobId} submitted successfully`);
      return jobId;
    } catch (error) {
      console.error('Job submission failed:', error);
      throw error;
    }
  }

  async waitForResult(jobId: number, pollInterval: number = 5000): Promise<InferenceResult> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const job = await this.getJobStatus(jobId);
          if (job.status === JobStatus.Finalized) {
            const result = await this.getJobResult(jobId);
            resolve(result);
          } else if (job.status === JobStatus.Disputed) {
            reject(new Error('Job was disputed'));
          } else {
            setTimeout(poll, pollInterval);
          }
        } catch (error) {
          reject(error);
        }
      };
      poll();
    });
  }

  async getJobStatus(jobId: number): Promise<any> {
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

  async getJobResult(jobId: number): Promise<InferenceResult> {
    try {
      const response = await axios.get(`${this.coordinatorUrl}/jobs/${jobId}/result`);
      return response.data;
    } catch (error) {
      console.error('Failed to get job result:', error);
      throw error;
    }
  }

  async disputeJob(jobId: number, reason: string): Promise<void> {
    try {
      const tx = await this.jobMarketContract.disputeJob(jobId, reason);
      await tx.wait();
      console.log(`Job ${jobId} disputed: ${reason}`);
    } catch (error) {
      console.error('Dispute failed:', error);
      throw error;
    }
  }

  async getBalance(): Promise<number> {
    const address = await this.wallet.getAddress();
    const balance = await this.duckTokenContract.balanceOf(address);
    return balance.toNumber();
  }

  private hashJobSpec(spec: JobSpec): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(JSON.stringify(spec)).digest('hex');
  }

  private async storeJobSpec(specHash: string, spec: JobSpec): Promise<void> {
    try {
      await axios.post(`${this.coordinatorUrl}/specs`, {
        hash: specHash,
        spec
      });
    } catch (error) {
      console.error('Failed to store job spec:', error);
      throw error;
    }
  }
}
