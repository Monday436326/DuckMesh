// coordinator/src/services/assignment.ts

import { Provider, Job } from '../types';

export class AssignmentService {
  selectBestProvider(providers: Provider[], job: Job): Provider | null {
    if (providers.length === 0) return null;
    
    // Filter providers that support the model
    const eligibleProviders = providers.filter(p => 
      p.isActive && 
      Date.now() / 1000 - p.lastHeartbeat < 3600 // Active within last hour
    );
    
    if (eligibleProviders.length === 0) return null;
    
    // Score providers based on reputation, stake, and randomness
    const scoredProviders = eligibleProviders.map(provider => ({
      provider,
      score: this.calculateProviderScore(provider, job)
    }));
    
    // Sort by score (highest first)
    scoredProviders.sort((a, b) => b.score - a.score);
    
    return scoredProviders[0].provider;
  }

  private calculateProviderScore(provider: Provider, job: Job): number {
    const reputationScore = provider.reputation / 100; // Normalize to 1.0 base
    const stakeScore = Math.min(provider.stakedAmount / 10000, 2); // Max 2x multiplier
    const randomness = Math.random() * 0.1; // Small randomness factor
    
    return reputationScore * stakeScore + randomness;
  }

  selectProvidersForRedundancy(providers: Provider[], count: number = 3): Provider[] {
    const eligible = providers.filter(p => p.isActive);
    
    if (eligible.length <= count) return eligible;
    
    // Select top N providers by reputation and stake
    return eligible
      .sort((a, b) => (b.reputation * b.stakedAmount) - (a.reputation * a.stakedAmount))
      .slice(0, count);
  }
}
