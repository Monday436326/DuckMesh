import { ethers } from 'ethers';
import { JobSpec, InferenceResult, VerificationMode } from './types';
export declare class DuckMeshClient {
    private provider;
    private wallet;
    private jobMarketContract;
    private duckTokenContract;
    private coordinatorUrl;
    constructor(rpcOrProvider: string | ethers.Provider, privateKeyOrSigner: string | ethers.Signer, jobMarketAddress: string, duckTokenAddress: string, coordinatorUrl: string);
    submitJob(modelId: string, jobSpec: JobSpec, maxPrice: number, verificationMode?: VerificationMode, timeout?: number): Promise<number>;
    waitForResult(jobId: number, pollInterval?: number): Promise<InferenceResult>;
    getJobStatus(jobId: number): Promise<any>;
    getJobResult(jobId: number): Promise<InferenceResult>;
    disputeJob(jobId: number, reason: string): Promise<void>;
    getBalance(): Promise<number>;
    private hashJobSpec;
    private storeJobSpec;
}
