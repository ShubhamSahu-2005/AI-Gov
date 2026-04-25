import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, BrainCircuit, CheckCircle2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export default function CreateProposalModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ title: '', description: '', requestedAmount: '' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFormData({ title: '', description: '', requestedAmount: '' });
      setAiResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAnalyze = () => {
    if (!formData.title || !formData.description) return toast.error('Please fill all required fields');
    setStep(2);
    setIsAnalyzing(true);
    
    // Simulate AI delay
    setTimeout(() => {
      setIsAnalyzing(false);
      const mockCategories = ['Technical', 'Governance', 'Budget', 'Community', 'Partnership'];
      const autoCategory = mockCategories[Math.floor(Math.random() * mockCategories.length)];
      setAiResult({
        aiRiskScore: (Math.random() * 5 + 3).toFixed(1), // 3.0 to 8.0
        aiCategory: autoCategory,
        aiSummary: `AI Summary: This proposal seeks to address ${autoCategory} aspects by introducing "${formData.title}". It appears well-structured but carries some implementation risks depending on scope.`
      });
    }, 1500);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        requestedAmount: Number(formData.requestedAmount) || 0
      };
      const res = await axios.post(`${API_URL}/proposals`, payload, { withCredentials: true });
      if (res.data.success) {
        setStep(3);
        onSuccess(res.data.data);
      } else {
        toast.error(res.data.message || 'Failed to create proposal');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Database disconnected. Failed to create proposal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-white z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            {/* STEP 1: INPUT */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <h2 className="text-2xl font-bold text-white mb-6">Create Proposal</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1">Proposal Title</label>
                    <input 
                      type="text" 
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                      placeholder="e.g., Q3 Protocol Upgrade"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1">Description</label>
                    <textarea 
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows={4}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors resize-none"
                      placeholder="Detailed explanation of your proposal..."
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-muted mb-1">Requested Amount ($)</label>
                      <input 
                        type="number" 
                        value={formData.requestedAmount}
                        onChange={(e) => setFormData({...formData, requestedAmount: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-8 flex justify-end">
                  <button onClick={handleAnalyze} className="btn-primary flex items-center gap-2 px-6 py-2.5">
                    <Sparkles className="w-4 h-4" /> Submit for AI Analysis
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: AI ANALYSIS */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <BrainCircuit className="w-6 h-6 text-accent" /> AI Risk Analysis
                </h2>
                
                {isAnalyzing ? (
                  <div className="space-y-4 py-8 animate-pulse">
                    <div className="h-4 bg-white/5 rounded-md w-1/3 mx-auto mb-8"></div>
                    <div className="h-24 bg-white/5 rounded-xl w-full"></div>
                    <div className="h-24 bg-white/5 rounded-xl w-full"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-surface/50 border border-white/5 rounded-xl p-4 text-center">
                        <p className="text-sm text-muted mb-1">AI Risk Score</p>
                        <p className="text-3xl font-bold text-white">{aiResult?.aiRiskScore}/10</p>
                      </div>
                      <div className="bg-surface/50 border border-white/5 rounded-xl p-4 text-center">
                        <p className="text-sm text-muted mb-1 flex items-center justify-center gap-1"><Sparkles className="w-3 h-3 text-accent" /> AI-Determined Category</p>
                        <p className="text-xl font-bold text-white uppercase">{aiResult?.aiCategory}</p>
                      </div>
                    </div>
                    <div className="bg-accent/10 border border-accent/20 rounded-xl p-5">
                      <h4 className="text-sm font-semibold text-accent mb-2 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> Automated Summary
                      </h4>
                      <p className="text-white/80 text-sm leading-relaxed">{aiResult?.aiSummary}</p>
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4">
                      <button onClick={() => setStep(1)} className="btn-secondary px-6 py-2.5">
                        Edit Proposal
                      </button>
                      <button onClick={handleSubmit} disabled={isSubmitting} className="btn-primary px-6 py-2.5 flex items-center gap-2">
                        {isSubmitting ? 'Submitting...' : 'Confirm & Submit to Blockchain'}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 3: SUCCESS */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
                <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Proposal Submitted Successfully</h2>
                <p className="text-muted mb-8 max-w-md mx-auto">Your proposal has been submitted to the blockchain and is now available for voting.</p>
                
                <div className="flex justify-center gap-4">
                  <button onClick={() => setStep(1)} className="btn-secondary px-6 py-2.5">
                    Submit Another Proposal
                  </button>
                  <button onClick={onClose} className="btn-primary px-6 py-2.5 flex items-center gap-2">
                    View All Proposals <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
