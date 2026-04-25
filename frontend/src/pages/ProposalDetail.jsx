import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Send, ThumbsUp, ThumbsDown, Bot, CheckCircle2, XCircle, Undo2 } from 'lucide-react';
import toast from 'react-hot-toast';
import AIPanel from '../components/AIPanel';
import { useProposalsData } from '../context/ProposalsContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export default function ProposalDetail({ address }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { proposals, voteOnProposal, revokeVote, votes, delegateConfig, updateProposal } = useProposalsData();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const match = proposals.find(p => p.id === id);
    if (match) {
      setProposal(match);
      if (address && !votes[id]?.[address]) {
        axios.get(`${API_URL}/votes/proposal/${id}`, { withCredentials: true })
          .then(res => {
            const userVoteRecord = res.data.data.find(v => v.voter?.walletAddress?.toLowerCase() === address.toLowerCase());
            if (userVoteRecord) {
              voteOnProposal(id, userVoteRecord.choice, address, true);
            }
          })
          .catch(err => console.error("Failed to fetch votes", err));
      }
    } else {
      toast.error("Proposal not found");
    }
    setLoading(false);
  }, [id, proposals, address]);

  const handleAction = async () => {
    if (!address) return toast.error("Please connect your wallet first");
    
    if (proposal.status === 'draft') {
      try {
        await axios.post(`${API_URL}/proposals/${id}/submit`, {}, { withCredentials: true });
        toast.success("Submitted to Chain Successfully!");
        setProposal({ ...proposal, status: 'active' });
        if (updateProposal) updateProposal(id, { status: 'active' });
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to submit");
      }
    }
  };

  const handleVote = async (type) => {
    if (!address) return toast.error("Please connect your wallet first");
    
    try {
      await axios.post(`${API_URL}/votes`, { proposalId: id, choice: type }, { withCredentials: true });
      toast.success(`Successfully voted ${type.toUpperCase()}`);
      voteOnProposal(id, type, address);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to vote");
    }
  };

  const handleRevoke = async () => {
    try {
      await axios.delete(`${API_URL}/votes/proposal/${id}`, { withCredentials: true });
      revokeVote(id, address);
      toast.success('Vote revoked');
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to revoke vote");
    }
  };

  const handleAIVote = async () => {
    if (!delegateConfig.isEnabled) return;
    
    const score = Number(proposal.aiRiskScore || 0);
    const tolerance = delegateConfig.riskTolerance * 2;
    const cat = proposal.category || proposal.aiCategory || 'technical';
    const isPriority = delegateConfig.categories[cat.toLowerCase()] !== false; 
    
    let decision = 'for';
    if (score > tolerance && !isPriority) decision = 'against';
    if (score > 8 && delegateConfig.strategy === 'conservative') decision = 'against';

    try {
      await axios.post(`${API_URL}/votes`, { proposalId: id, choice: decision }, { withCredentials: true });
      toast.success(`AI Delegate voted ${decision.toUpperCase()}: Risk score is within your tolerance.`);
      voteOnProposal(id, decision, address);
    } catch (err) {
      toast.error(err.response?.data?.message || "AI Delegate failed to vote");
    }
  };

  const userVote = votes[id]?.[address];
  const hasVoted = !!userVote;

  const totalVotes = (proposal?.votesFor || 0) + (proposal?.votesAgainst || 0);
  const approvalPercent = totalVotes > 0 ? Math.round(((proposal?.votesFor || 0) / totalVotes) * 100) : 0;

  if (loading) return <div className="animate-pulse flex items-center justify-center p-20">Loading...</div>;
  if (!proposal) return <div className="text-center p-20 text-white">Proposal not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted hover:text-white transition-colors">
        <ArrowLeft className="w-5 h-5" /> Back to Dashboard
      </button>

      <div className="glass-panel p-8 relative overflow-hidden">
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className="px-3 py-1 rounded-md text-xs font-medium bg-white/10 text-white border border-white/5 mb-4 inline-block">
              {proposal.category || "Uncategorized"}
            </span>
            <h1 className="text-3xl font-bold text-white mb-2">{proposal.title}</h1>
            <p className="text-muted">Requested Amount: <span className="text-white font-mono">${proposal.requestedAmount || 0}</span></p>
          </div>
          <span className={`px-3 py-1 rounded-md text-sm font-bold uppercase ${proposal.status === 'active' ? 'bg-secondary/20 text-secondary' : 'bg-yellow-500/20 text-yellow-500'}`}>
            {proposal.status}
          </span>
        </div>

        {proposal.status === 'active' && (
          <div className="mb-8 p-6 bg-surface/50 border border-white/5 rounded-xl">
            <h3 className="text-lg font-semibold mb-4 text-white">Current Voting Results</h3>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white font-medium">{approvalPercent}% Approval</span>
              <span className="text-muted">{totalVotes} Total Votes</span>
            </div>
            <div className="w-full h-3 bg-red-500/20 rounded-full overflow-hidden flex mb-2">
              <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${approvalPercent}%` }}></div>
            </div>
            <div className="flex justify-between text-xs text-muted">
              <span>{proposal.votesFor || 0} For</span>
              <span>{proposal.votesAgainst || 0} Against</span>
            </div>
          </div>
        )}

        <div className="bg-surface/50 rounded-xl p-6 border border-white/5 mb-8">
          <h3 className="text-lg font-semibold mb-4 text-white">Description</h3>
          <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{proposal.description}</p>
        </div>

        <AIPanel 
          aiSummary={proposal.aiSummary}
          aiRiskScore={proposal.aiRiskScore}
          aiCategory={proposal.aiCategory}
        />

        <div className="mt-8 pt-8 border-t border-white/10 flex justify-end gap-4">
          {proposal.status === 'draft' ? (
            <button 
              onClick={handleAction}
              className="btn-primary flex items-center gap-2 px-8 py-3"
            >
              Submit to Chain <Send className="w-5 h-5" />
            </button>
          ) : hasVoted ? (
            <div className="flex flex-col items-end gap-3">
              <div className={`px-6 py-3 rounded-xl border flex items-center gap-2 font-bold ${userVote === 'for' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                {userVote === 'for' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                Voted {userVote.toUpperCase()}
              </div>
              <button onClick={handleRevoke} className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors">
                <Undo2 className="w-3.5 h-3.5" /> Revoke Vote
              </button>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row w-full md:w-auto gap-4">
              {delegateConfig.isEnabled && (
                <button 
                  onClick={handleAIVote}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/40 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/10"
                >
                  <Bot className="w-5 h-5" /> Vote with AI Delegate
                </button>
              )}
              <button 
                onClick={() => handleVote('against')}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-xl font-bold transition-colors"
              >
                <ThumbsDown className="w-5 h-5" /> Vote Against
              </button>
              <button 
                onClick={() => handleVote('for')}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30 rounded-xl font-bold transition-colors"
              >
                <ThumbsUp className="w-5 h-5" /> Vote For
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
