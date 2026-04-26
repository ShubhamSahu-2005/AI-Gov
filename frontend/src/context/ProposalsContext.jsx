import { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const ProposalsContext = createContext();
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export function ProposalsProvider({ children }) {
  const [proposals, setProposals] = useState([]);
  const [hasLoadedMock, setHasLoadedMock] = useState(false);
  
  // Voter tracking: { [proposalId]: { [address]: 'for' | 'against' } }
  const [votes, setVotes] = useState({});

  const [delegateConfig, setDelegateConfigState] = useState(() => {
    const saved = localStorage.getItem('delegateConfig');
    if (saved) return JSON.parse(saved);
    return {
      isEnabled: false,
      riskTolerance: 3,
      strategy: 'balanced',
      categories: { financial: true, community: false, protocol: true, technical: false },
      customRule: ''
    };
  });

  const setDelegateConfig = (settings) => {
    setDelegateConfigState(settings);
    localStorage.setItem('delegateConfig', JSON.stringify(settings));
  };

  // Load data from backend
  useEffect(() => {
    if (!hasLoadedMock) {
      axios.get(`${API_URL}/proposals`, { withCredentials: true })
        .then(res => {
          if (res.data.success) {
            setProposals(res.data.data);
          }
        })
        .catch(err => {
          console.error("Failed to load proposals, falling back to mock", err);
          // Only fallback if backend completely fails
          setProposals([
            { id: '550e8400-e29b-41d4-a716-446655440000', title: 'Upgrade Protocol to v3.0', description: 'This proposal outlines technical changes. It outlines the specific changes to the smart contracts, the migration path, and the expected benefits for the ecosystem.', aiRiskScore: 4.2, category: 'technical', requestedAmount: 50000, status: 'active', aiSummary: 'Summary of technical changes. The proposal has medium-low technical risk and significant gas optimizations. The code changes appear sound.', aiCategory: 'technical', votesFor: 1250, votesAgainst: 300, votesAbstain: 50 },
            { id: '550e8400-e29b-41d4-a716-446655440001', title: 'Q3 Marketing & Growth Fund', description: 'Budget allocation for Q3. Allocate 120,000 USDC for Q3 marketing efforts including conferences, hackathons, and developer grants. The goal is to grow active users by 40%.', aiRiskScore: 7.8, category: 'budget', requestedAmount: 120000, status: 'active', aiSummary: 'Summary of marketing budget. This budget proposal has higher risk due to a large requested amount. Spending metrics and milestones should be strictly defined.', aiCategory: 'budget', votesFor: 800, votesAgainst: 950, votesAbstain: 120 },
          ]);
        })
        .finally(() => {
          setHasLoadedMock(true);
        });
    }
  }, [hasLoadedMock]);

  const addProposal = (newProposal) => {
    setProposals(prev => [{ ...newProposal, isNew: true }, ...prev]);
  };

  const updateProposal = (id, updates) => {
    setProposals(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const voteOnProposal = (id, type, address, skipIncrement = false) => {
    setVotes(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [address]: type
      }
    }));
    
    if (!skipIncrement) {
      setProposals(prev => prev.map(p => {
        if (p.id === id) {
          if (type === 'for') {
            return { ...p, votesFor: (p.votesFor || 0) + 1 };
          } else if (type === 'against') {
            return { ...p, votesAgainst: (p.votesAgainst || 0) + 1 };
          } else {
            return { ...p, votesAbstain: (p.votesAbstain || 0) + 1 };
          }
        }
        return p;
      }));
    }
  };

  const revokeVote = (id, address) => {
    setVotes(prev => {
      const newVotes = { ...prev };
      if (newVotes[id]) {
        const type = newVotes[id][address];
        delete newVotes[id][address];
        
        // Decrement from proposals array
        setProposals(currentProposals => currentProposals.map(p => {
          if (p.id === id) {
            if (type === 'for') return { ...p, votesFor: Math.max(0, (p.votesFor || 0) - 1) };
            if (type === 'against') return { ...p, votesAgainst: Math.max(0, (p.votesAgainst || 0) - 1) };
            if (type === 'abstain') return { ...p, votesAbstain: Math.max(0, (p.votesAbstain || 0) - 1) };
          }
          return p;
        }));
      }
      return newVotes;
    });
  };

  return (
    <ProposalsContext.Provider value={{ proposals, addProposal, updateProposal, voteOnProposal, revokeVote, votes, delegateConfig, setDelegateConfig, setProposals }}>
      {children}
    </ProposalsContext.Provider>
  );
}

export const useProposalsData = () => useContext(ProposalsContext);
