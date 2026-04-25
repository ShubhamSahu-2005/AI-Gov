import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Landmark, BarChart3, ArrowRight, BrainCircuit, Activity, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useWebSocket } from '../hooks/useWebSocket';
import CreateProposalModal from '../components/CreateProposalModal';
import AIDelegatePanel from '../components/AIDelegatePanel';
import { useProposalsData } from '../context/ProposalsContext';
import { Bot } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export default function Dashboard({ address }) {
  const [activeTab, setActiveTab] = useState('proposals');
  const [isLoading, setIsLoading] = useState(true);
  const { events } = useWebSocket();

  const tabs = [
    { id: 'proposals', label: 'Active Proposals', icon: LayoutGrid },
    { id: 'treasury', label: 'Treasury Tracking', icon: Landmark },
    { id: 'analytics', label: 'Governance Analytics', icon: BarChart3 },
    { id: 'ai-delegate', label: 'AI Delegate Settings', icon: Bot },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Governance Hub</h2>
          <p className="text-muted">Manage proposals, track treasury, and analyze DAO metrics.</p>
        </div>

        <div className="glass-panel p-1.5 flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setIsLoading(true); }}
                className={`relative px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors z-10
                  ${isActive ? 'text-white' : 'text-muted hover:text-white/80'}
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-tab"
                    className="absolute inset-0 bg-white/10 border border-white/10 rounded-xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'proposals' && <ProposalsView address={address} wsEvents={events} isLoading={isLoading} setIsLoading={setIsLoading} />}
            {activeTab === 'treasury' && <TreasuryView isLoading={isLoading} setIsLoading={setIsLoading} />}
            {activeTab === 'analytics' && <AnalyticsView isLoading={isLoading} setIsLoading={setIsLoading} />}
            {activeTab === 'ai-delegate' && (
              <div className="max-w-4xl mx-auto">
                <AIDelegatePanel />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function ProposalsView({ address, wsEvents, isLoading, setIsLoading }) {
  const { proposals, addProposal } = useProposalsData();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  // Listen for websocket events
  useEffect(() => {
    if (wsEvents.length > 0) {
      const lastEvent = wsEvents[wsEvents.length - 1];
      if (lastEvent.type === 'proposal:new') {
        toast.success('New proposal received!');
      }
      if (lastEvent.type === 'vote:cast') {
        toast.success('A new vote was cast live!');
      }
    }
  }, [wsEvents]);

  const handleSuccess = (newProposal) => {
    if (newProposal) {
      addProposal(newProposal);
    }
  };

  if (isLoading) return <LoadingSkeletons />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Active Proposals</h3>
        <button 
          onClick={() => {
            if (!address) return toast.error("Connect wallet first");
            setIsModalOpen(true);
          }}
          className="btn-primary py-2 text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Proposal
        </button>
      </div>
      
      <CreateProposalModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handleSuccess} 
      />
      
      {proposals.length === 0 ? (
        <div className="text-center p-12 text-muted glass-panel">No active proposals found. Create one!</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {proposals.map((p) => (
            <div key={p.id} className="glass-panel p-6 group hover:border-primary/50 transition-colors duration-300 relative overflow-hidden flex flex-col">
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-medium uppercase border ${
                    p.status === 'active' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                    p.status === 'rejected' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                    p.status === 'approved' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                    p.status === 'executed' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                    'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                  }`}>
                    {p.status}
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-white/10 text-white/90 border border-white/5 uppercase">
                    {p.category || p.aiCategory || 'Uncategorized'}
                  </span>
                  {p.isNew && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500 animate-pulse text-white shadow-lg shadow-blue-500/20">
                      New
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-surface/80 border border-white/5 text-muted">
                  <BrainCircuit className="w-3.5 h-3.5 text-accent" />
                  Risk: {p.aiRiskScore || 'N/A'}
                </div>
              </div>
              
              <h4 className="text-lg font-semibold text-white mb-2 leading-tight relative z-10 flex-grow">{p.title}</h4>
              <p className="text-sm text-muted mb-4 relative z-10">Requested: <span className="text-white font-mono">${p.requestedAmount || 0}</span></p>
              
              <div className="mb-6 relative z-10">
                {(() => {
                  const totalVotes = (p.votesFor || 0) + (p.votesAgainst || 0);
                  const approvalPercent = totalVotes > 0 ? Math.round(((p.votesFor || 0) / totalVotes) * 100) : 0;
                  return (
                    <>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-white font-medium">{approvalPercent}% Approval</span>
                        <span className="text-muted">{totalVotes} votes</span>
                      </div>
                      <div className="w-full h-1.5 bg-red-500/20 rounded-full overflow-hidden flex">
                        <div className="h-full bg-green-500" style={{ width: `${approvalPercent}%` }}></div>
                      </div>
                    </>
                  );
                })()}
              </div>
              
              <div className="flex gap-2 relative z-10 mt-auto">
                <Link to={`/proposals/${p.id}`} className="flex-1 btn-secondary py-2 text-sm text-center block">
                  View Details
                </Link>
                {address ? (
                  <Link to={`/proposals/${p.id}`} className="px-4 flex items-center justify-center gap-2 btn-primary py-2 text-sm font-medium transition-transform hover:scale-105">
                    Vote Now <ArrowRight size={16} />
                  </Link>
                ) : (
                  <Link to={`/proposals/${p.id}`} className="w-10 flex items-center justify-center btn-secondary py-2">
                    <ArrowRight size={16} />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TreasuryView({ isLoading, setIsLoading }) {
  const [treasury, setTreasury] = useState(null);

  useEffect(() => {
    const fetchTreasury = async () => {
      try {
        const res = await axios.get(`${API_URL}/treasury/balance`, { withCredentials: true });
        if (res.data.success) {
          setTreasury(res.data.data);
        }
      } catch (err) {
        // Fallback for demo
        setTreasury({ total: 1240500, assets: [{ name: 'USDC', value: 1000000, color: '#10b981' }, { name: 'DAO Token', value: 240500, color: '#4f46e5' }] });
      } finally {
        setIsLoading(false);
      }
    };
    fetchTreasury();
  }, []);

  if (isLoading || !treasury) return <div className="animate-pulse h-64 bg-surface/50 rounded-xl"></div>;

  const chartData = treasury.assets || [
    { name: 'USDC', value: 1000000, color: '#10b981' },
    { name: 'DAO Token', value: 240500, color: '#4f46e5' }
  ];

  return (
    <div className="glass-panel p-8 space-y-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary/20 to-teal-500/20 mx-auto flex items-center justify-center border border-secondary/30">
          <Landmark className="w-8 h-8 text-secondary" />
        </div>
        <h3 className="text-2xl font-semibold">Treasury Balance</h3>
        <p className="text-5xl font-bold font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
          ${treasury.total?.toLocaleString() || '1,240,500'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-4xl mx-auto border-t border-white/5 pt-8">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || '#4f46e5'} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#151520', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="space-y-4">
          {chartData.map((asset, idx) => (
            <div key={idx} className="bg-surface/50 p-4 rounded-xl flex justify-between items-center border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: asset.color || '#fff' }}></div>
                <span className="font-medium text-white/90">{asset.name}</span>
              </div>
              <span className="font-mono text-lg font-bold">${asset.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalyticsView({ isLoading, setIsLoading }) {
  const [analytics, setAnalytics] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAnalytics = async () => {
    setIsRefreshing(true);
    try {
      const [overviewRes, accuracyRes, compRes] = await Promise.all([
        axios.get(`${API_URL}/analytics/overview`, { withCredentials: true }),
        axios.get(`${API_URL}/analytics/ai/accuracy`, { withCredentials: true }),
        axios.get(`${API_URL}/analytics/comprehension`, { withCredentials: true })
      ]);

      if (overviewRes.data.success && accuracyRes.data.success && compRes.data.success) {
        setAnalytics({
          participationRate: `${overviewRes.data.data.avgParticipationPercent}%`,
          aiAccuracy: `${accuracyRes.data.data.accuracyPercent}%`,
          comprehensionLift: `+${compRes.data.data.comprehensionGapPercent}%`
        });
      } else {
        throw new Error("Failed to load");
      }
    } catch (err) {
      // Fallback demo data
      setAnalytics({ participationRate: '42.5%', aiAccuracy: '89.2%', comprehensionLift: '+38%' });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (isLoading || !analytics) return <div className="animate-pulse h-64 bg-surface/50 rounded-xl"></div>;

  return (
    <div className="glass-panel p-8 text-center space-y-4 relative">
      <button 
        onClick={fetchAnalytics}
        disabled={isRefreshing}
        className="absolute top-4 right-4 btn-secondary py-1.5 px-3 text-xs flex items-center gap-2"
      >
        <Activity className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </button>

      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-orange-500/20 mx-auto flex items-center justify-center border border-accent/30">
        <Activity className="w-8 h-8 text-accent" />
      </div>
      <h3 className="text-2xl font-semibold mb-6">Governance Analytics</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface/50 border border-white/5 rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <p className="text-sm text-muted mb-2 relative z-10">Participation Rate</p>
          <p className="text-3xl font-bold text-white relative z-10">{analytics.participationRate}</p>
        </div>
        <div className="bg-surface/50 border border-white/5 rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <p className="text-sm text-muted mb-2 relative z-10">AI Accuracy (vs Manual)</p>
          <p className="text-3xl font-bold text-white relative z-10">{analytics.aiAccuracy}</p>
        </div>
        <div className="bg-surface/50 border border-white/5 rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <p className="text-sm text-muted mb-2 relative z-10">Comprehension Lift</p>
          <p className="text-3xl font-bold text-white relative z-10">{analytics.comprehensionLift}</p>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeletons() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass-panel p-6 space-y-4 animate-pulse">
          <div className="w-12 h-12 rounded-xl bg-white/5"></div>
          <div className="h-6 bg-white/5 rounded-md w-3/4"></div>
          <div className="space-y-2 pt-4">
            <div className="h-4 bg-white/5 rounded-md w-full"></div>
            <div className="h-4 bg-white/5 rounded-md w-5/6"></div>
          </div>
          <div className="pt-6 flex justify-between items-center border-t border-white/5 mt-4">
            <div className="h-8 bg-white/5 rounded-lg w-1/3"></div>
            <div className="h-8 bg-white/5 rounded-lg w-1/4"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
