import { useState, useEffect } from 'react';
import { Bot, ShieldAlert, Settings2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProposalsData } from '../context/ProposalsContext';

export default function AIDelegatePanel() {
  const { delegateConfig, setDelegateConfig } = useProposalsData();
  
  const [isEnabled, setIsEnabled] = useState(delegateConfig.isEnabled);
  const [riskTolerance, setRiskTolerance] = useState(delegateConfig.riskTolerance);
  const [strategy, setStrategy] = useState(delegateConfig.strategy);
  const [customRule, setCustomRule] = useState(delegateConfig.customRule);
  const [categories, setCategories] = useState(delegateConfig.categories);

  useEffect(() => {
    setIsEnabled(delegateConfig.isEnabled);
    setRiskTolerance(delegateConfig.riskTolerance);
    setStrategy(delegateConfig.strategy);
    setCustomRule(delegateConfig.customRule);
    setCategories(delegateConfig.categories);
  }, [delegateConfig]);
  
  const handleToggleCategory = (cat) => {
    setCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleSave = () => {
    setDelegateConfig({
      isEnabled,
      riskTolerance: Number(riskTolerance),
      strategy,
      customRule,
      categories
    });
    toast.success('AI Delegate preferences saved!');
  };

  return (
    <div className="glass-panel p-6 mt-8 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -z-10 group-hover:bg-accent/10 transition-colors"></div>
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center border border-accent/30">
            <Bot className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">AI Delegate Configuration</h3>
            <p className="text-sm text-muted">Automate your voting based on your risk profile.</p>
          </div>
        </div>
        
        {/* Master Toggle */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={isEnabled}
            onChange={() => setIsEnabled(!isEnabled)}
          />
          <div className="w-14 h-7 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-accent"></div>
        </label>
      </div>

      {isEnabled && (
        <div className="space-y-8 animate-fade-in pt-4 border-t border-white/10">
          
          {/* Risk Tolerance */}
          <div>
            <label className="flex justify-between text-sm font-medium text-white mb-4">
              <span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-orange-400"/> Risk Tolerance</span>
              <span className="text-muted text-xs">Level: {riskTolerance}</span>
            </label>
            <input 
              type="range" 
              min="1" max="5" 
              value={riskTolerance}
              onChange={(e) => setRiskTolerance(e.target.value)}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
            />
            <div className="flex justify-between text-xs text-muted mt-2">
              <span>Conservative (1)</span>
              <span>Aggressive (5)</span>
            </div>
          </div>

          {/* Category Priority */}
          <div>
            <label className="block text-sm font-medium text-white mb-3">Category Priority</label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(categories).map(cat => (
                <button
                  key={cat}
                  onClick={() => handleToggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                    categories[cat] 
                    ? 'bg-primary/20 border-primary text-primary' 
                    : 'bg-white/5 border-white/10 text-muted hover:bg-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Voting Strategy */}
          <div>
            <label className="block text-sm font-medium text-white mb-3">Voting Strategy</label>
            <div className="space-y-3">
              {[
                { id: 'conservative', label: 'Conservative', desc: 'Only votes on low-risk proposals with high community consensus.' },
                { id: 'balanced', label: 'Balanced', desc: 'Weighs risk vs. reward evenly across chosen categories.' },
                { id: 'progressive', label: 'Progressive', desc: 'Favors high-impact proposals even with higher technical risk.' }
              ].map(strat => (
                <label key={strat.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${strategy === strat.id ? 'bg-accent/10 border-accent/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                  <input 
                    type="radio" 
                    name="strategy" 
                    value={strat.id} 
                    checked={strategy === strat.id}
                    onChange={() => setStrategy(strat.id)}
                    className="mt-1 accent-accent"
                  />
                  <div>
                    <div className={`text-sm font-semibold ${strategy === strat.id ? 'text-accent' : 'text-white'}`}>{strat.label}</div>
                    <div className="text-xs text-muted mt-0.5">{strat.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Rule */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Custom Rule (Optional)</label>
            <textarea 
              value={customRule}
              onChange={(e) => setCustomRule(e.target.value)}
              rows={2}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent transition-colors resize-none"
              placeholder="e.g., Never vote FOR proposals requesting more than $100k USDC."
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button onClick={handleSave} className="btn-primary flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent/80 text-black font-bold">
              <Settings2 className="w-4 h-4" /> Save Preferences
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
