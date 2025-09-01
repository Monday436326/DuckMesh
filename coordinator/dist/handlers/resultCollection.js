"use strict";
// coordinator/src/handlers/resultCollection.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectResults = void 0;
const blockchain_1 = require("../services/blockchain");
const storage_1 = require("../services/storage");
const verification_1 = require("../services/verification");
const providerComm_1 = require("../services/providerComm");
const collectResults = async (event) => {
    try {
        const { jobId } = JSON.parse(event.body || '{}');
        const blockchain = new blockchain_1.BlockchainService(process.env.RPC_URL, process.env.COORDINATOR_PRIVATE_KEY, process.env.JOB_MARKET_ADDRESS, process.env.PROVIDER_REGISTRY_ADDRESS);
        const storage = new storage_1.StorageService();
        const verification = new verification_1.VerificationService();
        const providerComm = new providerComm_1.ProviderCommunicationService();
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
        const verificationResult = await verification.verifyResult(job, results, job.verificationMode);
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
        }
        else {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    jobId,
                    status: 'verification_failed',
                    reason: verificationResult.reason
                })
            };
        }
    }
    catch (error) {
        console.error('Result collection failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Collection failed' })
        };
    }
};
exports.collectResults = collectResults;
