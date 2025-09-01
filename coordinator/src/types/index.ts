// coordinator/src/types/index.ts
export interface Job {
  id: number;
  client: string;
  specHash: string;
  modelId: string;
  maxPrice: number;
  verificationMode: VerificationMode;
  timeout: number;
  status: JobStatus;
  assignedProvider?: string;
  resultHash?: string;
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
  pubkey: string;
  endpoint: string;
  stakedAmount: number;
  reputation: number;
  lastHeartbeat: number;
  isActive: boolean;
}

export interface JobSpec {
  prompt: string;
  maxTokens: number;
  temperature: number;
  modelParameters: Record<string, any>;
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