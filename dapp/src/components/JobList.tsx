// dapp/src/components/JobList.tsx

import React, { useState, useEffect } from 'react';
import { DuckMeshClient } from 'duckmesh-sdk';
import { JobStatus } from 'duckmesh-sdk';

interface Job {
  id: number;
  modelId: string;
  status: JobStatus;
  maxPrice: number;
  actualPrice: number;
  createdAt: number;
  assignedProvider?: string;
}

interface JobListProps {
  client: DuckMeshClient;
  account: string;
}

const JobList: React.FC<JobListProps> = ({ client, account }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, [client, account]);

  const loadJobs = async () => {
    try {
      // In production, this would query the blockchain for user's jobs
      // For now, simulate some jobs
      const mockJobs: Job[] = [
        {
          id: 1,
          modelId: 'claude-3-sonnet',
          status: JobStatus.Finalized,
          maxPrice: 1000,
          actualPrice: 850,
          createdAt: Date.now() - 3600000,
          assignedProvider: '0x123...'
        },
        {
          id: 2,
          modelId: 'gpt-4',
          status: JobStatus.Assigned,
          maxPrice: 1500,
          actualPrice: 0,
          createdAt: Date.now() - 1800000,
          assignedProvider: '0x456...'
        }
      ];
      
      setJobs(mockJobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: JobStatus): string => {
    switch (status) {
      case JobStatus.Pending: return 'Pending';
      case JobStatus.Assigned: return 'Assigned';
      case JobStatus.Completed: return 'Completed';
      case JobStatus.Disputed: return 'Disputed';
      case JobStatus.Finalized: return 'Finalized';
      default: return 'Unknown';
    }
  };

  const getStatusColor = (status: JobStatus): string => {
    switch (status) {
      case JobStatus.Pending: return 'orange';
      case JobStatus.Assigned: return 'blue';
      case JobStatus.Completed: return 'purple';
      case JobStatus.Disputed: return 'red';
      case JobStatus.Finalized: return 'green';
      default: return 'gray';
    }
  };

  const handleDispute = async (jobId: number) => {
    try {
      await client.disputeJob(jobId, 'Unsatisfactory result quality');
      await loadJobs(); // Refresh list
    } catch (error) {
      console.error('Dispute failed:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading jobs...</div>;
  }

  return (
    <div className="job-list">
      {jobs.length === 0 ? (
        <p>No jobs found. Submit your first job above!</p>
      ) : (
        <div className="jobs-grid">
          {jobs.map(job => (
            <div key={job.id} className="job-card">
              <div className="job-header">
                <span className="job-id">Job #{job.id}</span>
                <span 
                  className="job-status"
                  style={{ color: getStatusColor(job.status) }}
                >
                  {getStatusLabel(job.status)}
                </span>
              </div>
              
              <div className="job-details">
                <p><strong>Model:</strong> {job.modelId}</p>
                <p><strong>Max Price:</strong> {job.maxPrice} DUCK</p>
                {job.actualPrice > 0 && (
                  <p><strong>Final Price:</strong> {job.actualPrice} DUCK</p>
                )}
                <p><strong>Created:</strong> {new Date(job.createdAt).toLocaleString()}</p>
                {job.assignedProvider && (
                  <p><strong>Provider:</strong> {job.assignedProvider.slice(0, 10)}...</p>
                )}
              </div>

              <div className="job-actions">
                {job.status === JobStatus.Completed && (
                  <button 
                    onClick={() => handleDispute(job.id)}
                    className="dispute-button"
                  >
                    Dispute Result
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobList;