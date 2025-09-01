import { JobSpec, InferenceResult } from '../types';
export declare class ProviderAgent {
    private inferenceEngine;
    private attestationService;
    private provider;
    private wallet;
    private jobMarketContract;
    private providerRegistryContract;
    private activeJobs;
    private heartbeatInterval?;
    constructor();
    start(): Promise<void>;
    stop(): Promise<void>;
    acceptJob(jobId: number, spec: JobSpec, timeout: number, client: string): Promise<boolean>;
    getJobResult(jobId: number): Promise<InferenceResult | null>;
    private processJob;
    private calculateBidPrice;
    private generateResultHash;
    private generateReceiptSignature;
    private startHeartbeat;
    private generateHeartbeatSignature;
    private waitForJobsToComplete;
}
//# sourceMappingURL=ProviderAgent.d.ts.map