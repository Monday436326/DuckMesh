import { InferenceResult, VerificationMode, Job } from '../types';
import AWS from 'aws-sdk';

export class VerificationService {
  private bedrockRuntime: AWS.BedrockRuntime;
  private s3: AWS.S3;

  constructor() {
    // AWS_REGION is automatically available in Lambda environment
    const region = process.env.AWS_REGION || 'us-east-1';
    this.bedrockRuntime = new AWS.BedrockRuntime({ region });
    this.s3 = new AWS.S3({ region });
  }

  async verifyResult(
    job: Job,
    results: InferenceResult[],
    verificationMode: VerificationMode
  ): Promise<{ isValid: boolean; reason?: string }> {
    switch (verificationMode) {
      case VerificationMode.Redundant:
        return this.verifyRedundant(results);
      
      case VerificationMode.ReferenceCheck:
        return this.verifyReference(job, results[0]);
      
      case VerificationMode.Attestation:
        return this.verifyAttestation(results[0]);
      
      default:
        return { isValid: true };
    }
  }

  private async verifyRedundant(results: InferenceResult[]): Promise<{ isValid: boolean; reason?: string }> {
    if (results.length < 2) {
      return { isValid: false, reason: 'Insufficient redundant results' };
    }

    // Simple majority consensus on output hash
    const outputHashes = results.map(r => this.hashString(r.output));
    const hashCounts = new Map<string, number>();
    
    outputHashes.forEach(hash => {
      hashCounts.set(hash, (hashCounts.get(hash) || 0) + 1);
    });
    
    const maxCount = Math.max(...hashCounts.values());
    const majority = maxCount > results.length / 2;
    
    return { 
      isValid: majority,
      reason: majority ? undefined : 'No majority consensus on results'
    };
  }

  private async verifyReference(job: Job, result: InferenceResult): Promise<{ isValid: boolean; reason?: string }> {
    try {
      // Get reference result from AWS Bedrock
      const jobSpec = await this.getJobSpec(job.specHash);
      const referenceResult = await this.getBedrockInference(job.modelId, jobSpec);
      
      // Compare results with tolerance
      const similarity = this.calculateSimilarity(result.output, referenceResult);
      const threshold = 0.8; // 80% similarity threshold
      
      return {
        isValid: similarity >= threshold,
        reason: similarity < threshold ? `Low similarity: ${similarity.toFixed(2)}` : undefined
      };
    } catch (error) {
      console.error('Reference verification failed:', error);
      return { isValid: false, reason: 'Reference verification error' };
    }
  }

  private async verifyAttestation(result: InferenceResult): Promise<{ isValid: boolean; reason?: string }> {
    try {
      // Verify TEE attestation signature
      // This would integrate with AWS Nitro Enclaves or Intel SGX
      const isValidAttestation = await this.validateTeeAttestation(result.signature);
      
      return {
        isValid: isValidAttestation,
        reason: isValidAttestation ? undefined : 'Invalid TEE attestation'
      };
    } catch (error) {
      return { isValid: false, reason: 'Attestation verification failed' };
    }
  }

  private hashString(input: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  private async getJobSpec(specHash: string): Promise<any> {
    // Retrieve job specification from S3
    const params = {
      Bucket: process.env.S3_BUCKET!,
      Key: `specs/${specHash}.json`
    };
    
    const result = await this.s3.getObject(params).promise();
    return JSON.parse(result.Body!.toString());
  }

  private async getBedrockInference(modelId: string, jobSpec: any): Promise<string> {
    try {
      // Map model ID to AWS Bedrock model identifier
      const bedrockModelId = this.mapToBedrockModelId(modelId);
      
      // Prepare the request body based on the model type
      let requestBody: string;
      
      if (bedrockModelId.startsWith('anthropic.')) {
        // For Anthropic Claude models
        requestBody = JSON.stringify({
          prompt: `\n\nHuman: ${jobSpec.prompt}\n\nAssistant:`,
          max_tokens_to_sample: jobSpec.maxTokens || 1000,
          temperature: jobSpec.temperature || 0.7,
          ...jobSpec.modelParameters
        });
      } else if (bedrockModelId.startsWith('ai21.')) {
        // For AI21 models
        requestBody = JSON.stringify({
          prompt: jobSpec.prompt,
          maxTokens: jobSpec.maxTokens || 1000,
          temperature: jobSpec.temperature || 0.7,
          ...jobSpec.modelParameters
        });
      } else if (bedrockModelId.startsWith('amazon.')) {
        // For Amazon Titan models
        requestBody = JSON.stringify({
          inputText: jobSpec.prompt,
          textGenerationConfig: {
            maxTokenCount: jobSpec.maxTokens || 1000,
            temperature: jobSpec.temperature || 0.7,
            ...jobSpec.modelParameters
          }
        });
      } else {
        throw new Error(`Unsupported model type: ${bedrockModelId}`);
      }

      const params = {
        modelId: bedrockModelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: requestBody
      };
      
      const result = await this.bedrockRuntime.invokeModel(params).promise();
      const responseBody = JSON.parse(result.body.toString());
      
      // Extract completion based on model type
      if (bedrockModelId.startsWith('anthropic.')) {
        return responseBody.completion;
      } else if (bedrockModelId.startsWith('ai21.')) {
        return responseBody.completions[0].data.text;
      } else if (bedrockModelId.startsWith('amazon.')) {
        return responseBody.results[0].outputText;
      }
      
      throw new Error('Unable to extract completion from response');
      
    } catch (error) {
      console.error('Bedrock inference failed:', error);
      throw error;
    }
  }

  private mapToBedrockModelId(modelId: string): string {
    // Map your custom model IDs to AWS Bedrock model identifiers
    const modelMap: Record<string, string> = {
      'claude-3-haiku': 'anthropic.claude-3-haiku-20240307-v1:0',
      'claude-3-sonnet': 'anthropic.claude-3-sonnet-20240229-v1:0',
      'claude-3-opus': 'anthropic.claude-3-opus-20240229-v1:0',
      'claude-2.1': 'anthropic.claude-v2:1',
      'claude-2': 'anthropic.claude-v2',
      'claude-instant': 'anthropic.claude-instant-v1',
      'titan-text-express': 'amazon.titan-text-express-v1',
      'titan-text-lite': 'amazon.titan-text-lite-v1',
      'j2-ultra': 'ai21.j2-ultra-v1',
      'j2-mid': 'ai21.j2-mid-v1'
    };
    
    return modelMap[modelId] || modelId;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);
    if (maxLength === 0) return 1.0;
    return 1 - (distance / maxLength);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i] + 1, // deletion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private async validateTeeAttestation(signature: string): Promise<boolean> {
    // Placeholder for TEE attestation validation
    // In production, this would verify against known TEE public keys
    // For AWS Nitro Enclaves, you'd verify the attestation document
    
    try {
      // Basic signature format validation
      if (!signature || signature.length < 64) {
        return false;
      }
      
      // In a real implementation, you would:
      // 1. Parse the attestation document
      // 2. Verify the signature chain
      // 3. Check against trusted root certificates
      // 4. Validate enclave measurements (PCR values)
      // 5. Ensure the enclave is running the expected code
      
      // For now, just validate that it looks like a valid signature
      const signatureRegex = /^[0-9a-fA-F]+$/;
      return signatureRegex.test(signature);
      
    } catch (error) {
      console.error('TEE attestation validation error:', error);
      return false;
    }
  }
}