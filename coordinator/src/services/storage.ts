import AWS from 'aws-sdk';
import { JobSpec, InferenceResult } from '../types';

export class StorageService {
  private s3: AWS.S3;
  private dynamodb: AWS.DynamoDB.DocumentClient;

  constructor() {
    // AWS_REGION is automatically available in Lambda environment
    const region = process.env.AWS_REGION || 'us-east-1';
    this.s3 = new AWS.S3({ region });
    this.dynamodb = new AWS.DynamoDB.DocumentClient({ region });
  }

  async storeJobSpec(jobId: number, spec: JobSpec): Promise<string> {
    const specHash = this.generateHash(JSON.stringify(spec));
    
    await this.s3.putObject({
      Bucket: process.env.S3_BUCKET!,
      Key: `specs/${specHash}.json`,
      Body: JSON.stringify(spec),
      ContentType: 'application/json'
    }).promise();

    // Store metadata in DynamoDB
    await this.dynamodb.put({
      TableName: process.env.DYNAMODB_TABLE!,
      Item: {
        PK: `JOB#${jobId}`,
        SK: 'SPEC',
        specHash,
        createdAt: new Date().toISOString(),
        ...spec
      }
    }).promise();

    return specHash;
  }

  async getJobSpec(specHash: string): Promise<JobSpec> {
    try {
      const result = await this.s3.getObject({
        Bucket: process.env.S3_BUCKET!,
        Key: `specs/${specHash}.json`
      }).promise();
      
      return JSON.parse(result.Body!.toString());
    } catch (error) {
      console.error('Error retrieving job spec:', error);
      throw new Error(`Failed to retrieve job spec for hash: ${specHash}`);
    }
  }

  async storeInferenceResult(jobId: number, providerId: string, result: InferenceResult): Promise<void> {
    const resultKey = `results/${jobId}/${providerId}/${Date.now()}.json`;
    
    await this.s3.putObject({
      Bucket: process.env.S3_BUCKET!,
      Key: resultKey,
      Body: JSON.stringify(result),
      ContentType: 'application/json'
    }).promise();

    await this.dynamodb.put({
      TableName: process.env.DYNAMODB_TABLE!,
      Item: {
        PK: `JOB#${jobId}`,
        SK: `RESULT#${providerId}`,
        resultKey,
        providerId,
        createdAt: new Date().toISOString(),
        tokensUsed: result.metadata.tokensUsed,
        executionTime: result.metadata.executionTime
      }
    }).promise();
  }

  async getJobResults(jobId: number): Promise<InferenceResult[]> {
    const results = await this.dynamodb.query({
      TableName: process.env.DYNAMODB_TABLE!,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `JOB#${jobId}`,
        ':sk': 'RESULT#'
      }
    }).promise();

    const inferenceResults: InferenceResult[] = [];
    
    for (const item of results.Items || []) {
      const s3Result = await this.s3.getObject({
        Bucket: process.env.S3_BUCKET!,
        Key: item.resultKey
      }).promise();
      
      inferenceResults.push(JSON.parse(s3Result.Body!.toString()));
    }

    return inferenceResults;
  }

  async getJobSpecByJobId(jobId: number): Promise<JobSpec | null> {
    try {
      const result = await this.dynamodb.get({
        TableName: process.env.DYNAMODB_TABLE!,
        Key: {
          PK: `JOB#${jobId}`,
          SK: 'SPEC'
        }
      }).promise();

      if (!result.Item) {
        return null;
      }

      const { specHash, ...spec } = result.Item;
      return spec as JobSpec;
    } catch (error) {
      console.error('Error retrieving job spec by job ID:', error);
      return null;
    }
  }

  private generateHash(input: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(input).digest('hex');
  }
}