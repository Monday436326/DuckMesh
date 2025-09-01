export interface JobSpec {
  prompt: string;
  maxTokens: number;
  temperature: number;
  model?: string;
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