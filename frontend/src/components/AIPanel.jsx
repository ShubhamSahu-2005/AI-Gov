import { BrainCircuit, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function AIPanel({ aiSummary, aiRiskScore, aiCategory }) {
  if (!aiSummary && !aiRiskScore) {
    return (
      <div className="glass-panel p-6 flex flex-col items-center justify-center text-muted gap-2 min-h-[150px]">
        <BrainCircuit className="w-8 h-8 opacity-50" />
        <p className="text-sm">AI Analysis is still processing...</p>
      </div>
    );
  }

  const getRiskColor = (score) => {
    if (score < 4) return 'text-secondary bg-secondary/10 border-secondary/20';
    if (score < 7) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    return 'text-accent bg-accent/10 border-accent/20';
  };

  return (
    <div className="glass-panel p-6 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BrainCircuit className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-semibold text-white">AI Analysis</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className={`p-4 rounded-xl border ${getRiskColor(aiRiskScore)} flex items-center justify-between`}>
          <span className="text-sm font-medium">Risk Score</span>
          <div className="flex items-center gap-2 font-mono text-xl font-bold">
            {aiRiskScore >= 7 ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            {aiRiskScore}/10
          </div>
        </div>
        
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/10 text-primary-hover flex items-center justify-between">
          <span className="text-sm font-medium">Category</span>
          <span className="capitalize font-bold text-lg">{aiCategory}</span>
        </div>
      </div>

      <div className="bg-surface/50 rounded-xl p-4 border border-white/5">
        <p className="text-sm text-white/80 leading-relaxed">{aiSummary}</p>
      </div>
    </div>
  );
}
