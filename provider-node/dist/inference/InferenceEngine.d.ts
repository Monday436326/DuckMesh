import { JobSpec, InferenceResult } from '../types';
export declare class InferenceEngine {
    private results;
    private modelPath;
    constructor();
    initialize(): Promise<void>;
    canHandleJob(spec: JobSpec): Promise<boolean>;
    runInference(jobId: number, spec: JobSpec): Promise<InferenceResult>;
    getResult(jobId: number): Promise<InferenceResult | null>;
    private simulateInference;
    private estimateTokensUsed;
}
//# sourceMappingURL=InferenceEngine.d.ts.map