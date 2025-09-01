// provider-node/src/main.ts
import express from 'express';
import cors from 'cors';
import { ProviderAgent } from './agent/ProviderAgent';
import { InferenceEngine } from './inference/InferenceEngine';
import { AttestationService } from './attestation/AttestationService';
import dotenv from 'dotenv';
dotenv.config()

const app = express();
app.use(cors());
app.use(express.json());

const agent = new ProviderAgent();
const inferenceEngine = new InferenceEngine();
const attestationService = new AttestationService();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  });
});

// Job assignment endpoint
app.post('/jobs', async (req, res) => {
  try {
    const { jobId, spec, timeout, client } = req.body;
    
    // Validate job
    if (!jobId || !spec || !timeout) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Accept job
    const accepted = await agent.acceptJob(jobId, spec, timeout, client);
    
    if (accepted) {
      res.json({ status: 'accepted', jobId });
    } else {
      res.status(503).json({ error: 'Cannot accept job at this time' });
    }
  } catch (error) {
    console.error('Job acceptance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Job result endpoint
app.get('/jobs/:jobId/result', async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const result = await agent.getJobResult(jobId);
    
    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ error: 'Result not found or not ready' });
    }
  } catch (error) {
    console.error('Result retrieval error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Provider node running on port ${port}`);
  
  // Start background services
  agent.start();
});

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  agent.stop();
  process.exit(0);
});