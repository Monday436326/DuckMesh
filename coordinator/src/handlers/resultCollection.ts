// coordinator/src/handlers/resultCollection.ts

import { APIGatewayProxyHandler } from 'aws-lambda';
import { BlockchainService } from '../services/blockchain';
import { StorageService } from '../services/storage';
import { VerificationService } from '../services/verification';
import { ProviderCommunicationService } from '../services/providerComm';

export const collectResults: APIGatewayProxyHandler = async (event) => {
  try {
    const { jobId } = JSON.parse(event.body || '{}');
    
    const blockchain = new BlockchainService(
      process.env.RPC_URL!,
      process.env.COORDINATOR_PRIVATE_KEY!,
      process.env.JOB_MARKET_ADDRESS!,
      process.env.PROVIDER_REGISTRY_ADDRESS!
    );
    
    const storage = new StorageService();
    const verification = new VerificationService();
    const providerComm = new ProviderCommunicationService();

    // Get job details
    const job = await blockchain.getJob(jobId);
    if (!job) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Job not found' })
      };
    }

    // Collect results from all assigned providers
    const results = await storage.getJobResults(jobId);
    
    if (results.length === 0) {
      return {
        statusCode: 202,
        body: JSON.stringify({ message: 'Results not ready yet' })
      };
    }

    // Verify results
    const verificationResult = await verification.verifyResult(
      job,
      results,
      job.verificationMode
    );

    if (verificationResult.isValid) {
      // Finalize job on blockchain
      await blockchain.finalizeJob(jobId);
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          jobId,
          status: 'finalized',
          result: results[0].output,
          verification: 'passed'
        })
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({
          jobId,
          status: 'verification_failed',
          reason: verificationResult.reason
        })
      };
    }

  } catch (error) {
    console.error('Result collection failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Collection failed' })
    };
  }
};