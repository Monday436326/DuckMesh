import { APIGatewayProxyHandler } from 'aws-lambda';
import { BlockchainService } from '../services/blockchain';
import { AssignmentService } from '../services/assignment';
import { StorageService } from '../services/storage';
import { ProviderCommunicationService } from '../services/providerComm';

export const assignJob: APIGatewayProxyHandler = async (event) => {
  try {
    const { jobId } = JSON.parse(event.body || '{}');
    
    const blockchain = new BlockchainService(
      process.env.RPC_URL!,
      process.env.COORDINATOR_PRIVATE_KEY!,
      process.env.JOB_MARKET_ADDRESS!,
      process.env.PROVIDER_REGISTRY_ADDRESS!
    );
    
    const assignment = new AssignmentService();
    const storage = new StorageService();
    const providerComm = new ProviderCommunicationService();

    // Get job details
    const job = await blockchain.getJob(jobId);
    if (!job) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Job not found' })
      };
    }

    // Get active providers
    const providers = await blockchain.getActiveProviders();
    
    // Select best provider(s)
    let selectedProviders;
    if (job.verificationMode === 0) { // Redundant
      selectedProviders = assignment.selectProvidersForRedundancy(providers, 3);
    } else {
      const bestProvider = assignment.selectBestProvider(providers, job);
      selectedProviders = bestProvider ? [bestProvider] : [];
    }

    if (selectedProviders.length === 0) {
      return {
        statusCode: 503,
        body: JSON.stringify({ error: 'No available providers' })
      };
    }

    // Get job specification - try by hash first, then by job ID
    let jobSpec;
    try {
      jobSpec = await storage.getJobSpec(job.specHash);
    } catch (error) {
      console.warn('Could not get job spec by hash, trying by job ID');
      jobSpec = await storage.getJobSpecByJobId(job.id);
      if (!jobSpec) {
        throw new Error('Job specification not found');
      }
    }

    // Send job to provider(s)
    const assignmentPromises = selectedProviders.map(provider =>
      providerComm.assignJob(provider, job, jobSpec)
    );

    await Promise.all(assignmentPromises);

    // Clean up blockchain connection
    await blockchain.disconnect();

    return {
      statusCode: 200,
      body: JSON.stringify({
        jobId,
        assignedProviders: selectedProviders.map(p => p.address),
        status: 'assigned'
      })
    };

  } catch (error) {
    console.error('Job assignment failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Assignment failed' })
    };
  }
};