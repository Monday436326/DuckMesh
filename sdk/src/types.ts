// sdk/src/types.ts

export interface JobSpec {
  prompt: string;
  maxTokens: number;
  temperature: number;
  modelParameters?: Record<string, any>;
}

export interface InferenceResult {
  output: string;
  metadata: {
    tokensUsed: number;
    executionTime: number;
    modelVersion: string;
  };
  signature: string;
}

export enum JobStatus {
  Pending = 0,
  Assigned = 1,
  Completed = 2,
  Disputed = 3,
  Finalized = 4,
}

export enum VerificationMode {
  Redundant = 0,
  ReferenceCheck = 1,
  Attestation = 2,
  ZkML = 3,
}

export interface Provider {
  address: string;
  endpoint: string;
  reputation: number;
  stakedAmount: number;
  isActive: boolean;
}
