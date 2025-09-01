// dapp/src/components/JobSubmission.tsx

import React, { useState } from 'react';
import { DuckMeshClient } from 'duckmesh-sdk';
import { JobSpec, VerificationMode } from 'duckmesh-sdk';

interface JobSubmissionProps {
  client: DuckMeshClient;
}

const JobSubmission: React.FC<JobSubmissionProps> = ({ client }) => {
  const [formData, setFormData] = useState({
    modelId: 'claude-3-sonnet',
    prompt: '',
    maxTokens: 1000,
    temperature: 0.7,
    maxPrice: 1000,
    verificationMode: VerificationMode.Redundant,
    timeout: 3600
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const jobSpec: JobSpec = {
        prompt: formData.prompt,
        maxTokens: formData.maxTokens,
        temperature: formData.temperature,
        modelParameters: {}
      };

      const jobId = await client.submitJob(
        formData.modelId,
        jobSpec,
        formData.maxPrice,
        formData.verificationMode,
        formData.timeout
      );

      console.log(`Job submitted with ID: ${jobId}`);

      // Wait for result
      const inferenceResult = await client.waitForResult(jobId);
      setResult(inferenceResult.output);

    } catch (error) {
      console.error('Job submission failed:', error);
      setResult('Error: ' + error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="job-submission">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="modelId">Model:</label>
          <select
            id="modelId"
            value={formData.modelId}
            onChange={(e) => setFormData({...formData, modelId: e.target.value})}
          >
            <option value="claude-3-sonnet">Claude 3 Sonnet</option>
            <option value="gpt-4">GPT-4</option>
            <option value="llama-2-70b">Llama 2 70B</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="prompt">Prompt:</label>
          <textarea
            id="prompt"
            value={formData.prompt}
            onChange={(e) => setFormData({...formData, prompt: e.target.value})}
            rows={6}
            placeholder="Enter your prompt here..."
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="maxTokens">Max Tokens:</label>
            <input
              type="number"
              id="maxTokens"
              value={formData.maxTokens}
              onChange={(e) => setFormData({...formData, maxTokens: parseInt(e.target.value)})}
              min="1"
              max="8000"
            />
          </div>

          <div className="form-group">
            <label htmlFor="temperature">Temperature:</label>
            <input
              type="number"
              id="temperature"
              value={formData.temperature}
              onChange={(e) => setFormData({...formData, temperature: parseFloat(e.target.value)})}
              min="0"
              max="1"
              step="0.1"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="maxPrice">Max Price (DUCK):</label>
            <input
              type="number"
              id="maxPrice"
              value={formData.maxPrice}
              onChange={(e) => setFormData({...formData, maxPrice: parseInt(e.target.value)})}
              min="1"
            />
          </div>

          <div className="form-group">
            <label htmlFor="verificationMode">Verification:</label>
            <select
              id="verificationMode"
              value={formData.verificationMode}
              onChange={(e) => setFormData({...formData, verificationMode: parseInt(e.target.value) as VerificationMode})}
            >
              <option value={VerificationMode.Redundant}>Redundant (3 providers)</option>
              <option value={VerificationMode.ReferenceCheck}>Reference Check</option>
              <option value={VerificationMode.Attestation}>TEE Attestation</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={submitting || !formData.prompt.trim()}>
          {submitting ? 'Processing...' : 'Submit Job'}
        </button>
      </form>

      {result && (
        <div className="result-section">
          <h3>Result:</h3>
          <div className="result-content">
            {result}
          </div>
        </div>
      )}
    </div>
  );
};

export default JobSubmission;