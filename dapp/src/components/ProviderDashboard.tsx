// dapp/src/components/ProviderDashboard.tsx

import React, { useState, useEffect } from 'react';
import { DuckMeshClient } from 'duckmesh-sdk';

interface ProviderStats {
  stakedAmount: number;
  reputation: number;
  totalJobs: number;
  successfulJobs: number;
  earnings: number;
  isActive: boolean;
}

interface ProviderDashboardProps {
  client: DuckMeshClient;
  account: string;
}

const ProviderDashboard: React.FC<ProviderDashboardProps> = ({ client, account }) => {
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProviderStats();
  }, [client, account]);

  const loadProviderStats = async () => {
    try {
      // In production, this would query the blockchain
      const mockStats: ProviderStats = {
        stakedAmount: 5000,
        reputation: 95,
        totalJobs: 150,
        successfulJobs: 147,
        earnings: 12500,
        isActive: true
      };
      
      setStats(mockStats);
    } catch (error) {
      console.error('Failed to load provider stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading provider dashboard...</div>;
  }

  if (!stats) {
    return <div className="error">Failed to load provider stats</div>;
  }

  const successRate = stats.totalJobs > 0 ? (stats.successfulJobs / stats.totalJobs * 100) : 0;

  return (
    <div className="provider-dashboard">
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Staked Amount</h3>
          <div className="stat-value">{stats.stakedAmount.toLocaleString()} DUCK</div>
        </div>
        
        <div className="stat-card">
          <h3>Reputation</h3>
          <div className="stat-value">{stats.reputation}/100</div>
        </div>
        
        <div className="stat-card">
          <h3>Success Rate</h3>
          <div className="stat-value">{successRate.toFixed(1)}%</div>
        </div>
        
        <div className="stat-card">
          <h3>Total Earnings</h3>
          <div className="stat-value">{stats.earnings.toLocaleString()} DUCK</div>
        </div>
      </div>

      <div className="provider-actions">
        <button className="action-button primary">
          Increase Stake
        </button>
        <button className="action-button secondary">
          Update Endpoint
        </button>
        <button className="action-button danger">
          Unstake & Exit
        </button>
      </div>

      <div className="provider-status">
        <div className={`status-indicator ${stats.isActive ? 'active' : 'inactive'}`}>
          {stats.isActive ? '🟢 Active' : '🔴 Inactive'}
        </div>
        <p>Node Status: {stats.isActive ? 'Online and accepting jobs' : 'Offline'}</p>
      </div>
    </div>
  );
};

export default ProviderDashboard;