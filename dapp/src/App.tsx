/* eslint-disable react-hooks/exhaustive-deps */
// dapp/src/App.tsx

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { DuckMeshClient } from 'duckmesh-sdk';
import JobSubmission from './components/JobSubmission';
import JobList from './components/JobList';
import ProviderDashboard from './components/ProviderDashboard';
import './App.css';

// Add this type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

interface AppState {
  account: string | null;
  client: DuckMeshClient | null;
  isProvider: boolean;
  loading: boolean;
}

function App() {
  const [state, setState] = useState<AppState>({
    account: null,
    client: null,
    isProvider: false,
    loading: true
  });

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
  const provider = new ethers.BrowserProvider(window.ethereum);
await provider.send('eth_requestAccounts', []);
const signer =  await provider.getSigner();
        const account = signer.address;

        const client = new DuckMeshClient(
          provider,        
          signer,  
          process.env.REACT_APP_JOB_MARKET_ADDRESS!,
          process.env.REACT_APP_DUCK_TOKEN_ADDRESS!,
          process.env.REACT_APP_COORDINATOR_URL!
        );

        // Check if user is a registered provider
        const isProvider = await checkIfProvider(account);

        setState({
          account,
          client,
          isProvider,
          loading: false
        });
      } else {
        console.error('Please install MetaMask');
        setState(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('App initialization failed:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const checkIfProvider = async (account: string): Promise<boolean>  => {
    // Check if account is registered as provider
    // This would query the ProviderRegistry contract
    return false
  };

  if (state.loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Loading DuckMesh...</p>
      </div>
    );
  }

  if (!state.account) {
    return (
      <div className="app-error">
        <h1>DuckMesh</h1>
        <p>Please connect your wallet to continue</p>
        <button onClick={initializeApp}>Connect Wallet</button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🦆 DuckMesh</h1>
        <div className="account-info">
          <span>Connected: {state.account.slice(0, 6)}...{state.account.slice(-4)}</span>
        </div>
      </header>

      <main className="app-main">
        <div className="tabs">
          {!state.isProvider && (
            <div className="tab-content">
              <h2>Submit Inference Job</h2>
              <JobSubmission client={state.client!} />
              
              <h2>My Jobs</h2>
              <JobList client={state.client!} account={state.account} />
            </div>
          )}
          
          {state.isProvider && (
            <div className="tab-content">
              <h2>Provider Dashboard</h2>
              <ProviderDashboard client={state.client!} account={state.account} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
