// coordinator/src/services/providerComm.ts

import axios from 'axios';
import { Provider, Job, JobSpec, InferenceResult } from '../types';

export class ProviderCommunicationService {
  async assignJob(provider: Provider, job: Job, jobSpec: JobSpec): Promise<void> {
    try {
      const response = await axios.post(`${provider.endpoint}/jobs`, {
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
    } catch (error) {
      console.error(`Failed to assign job to provider ${provider.address}:`, error);
      throw error;
    }
  }

  async getJobResult(provider: Provider, jobId: number): Promise<InferenceResult | null> {
    try {
      const response = await axios.get(`${provider.endpoint}/jobs/${jobId}/result`, {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${process.env.COORDINATOR_API_KEY}`
        }
      });

      return response.data;
    } catch (error) {
      console.error(`Failed to get result from provider ${provider.address}:`, error);
      return null;
    }
  }

  async checkProviderHealth(provider: Provider): Promise<boolean> {
    try {
      const response = await axios.get(`${provider.endpoint}/health`, {
        timeout: 5000
      });
      
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}