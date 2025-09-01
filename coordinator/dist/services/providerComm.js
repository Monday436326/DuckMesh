"use strict";
// coordinator/src/services/providerComm.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderCommunicationService = void 0;
const axios_1 = __importDefault(require("axios"));
class ProviderCommunicationService {
    async assignJob(provider, job, jobSpec) {
        try {
            const response = await axios_1.default.post(`${provider.endpoint}/jobs`, {
                jobId: job.id,
                spec: jobSpec,
                timeout: job.timeout,
                client: job.client
            }, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.COORDINATOR_API_KEY}`
                }
            });
            if (response.status !== 200) {
                throw new Error(`Provider assignment failed: ${response.statusText}`);
            }
        }
        catch (error) {
            console.error(`Failed to assign job to provider ${provider.address}:`, error);
            throw error;
        }
    }
    async getJobResult(provider, jobId) {
        try {
            const response = await axios_1.default.get(`${provider.endpoint}/jobs/${jobId}/result`, {
                timeout: 10000,
                headers: {
                    'Authorization': `Bearer ${process.env.COORDINATOR_API_KEY}`
                }
            });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to get result from provider ${provider.address}:`, error);
            return null;
        }
    }
    async checkProviderHealth(provider) {
        try {
            const response = await axios_1.default.get(`${provider.endpoint}/health`, {
                timeout: 5000
            });
            return response.status === 200;
        }
        catch (error) {
            return false;
        }
    }
}
exports.ProviderCommunicationService = ProviderCommunicationService;
