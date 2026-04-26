import React, { useState } from 'react';
import axios from 'axios';
import { Lightbulb, Loader2, TrendingUp, PackagePlus, ArrowRight, CheckCircle2, Zap } from 'lucide-react';

export default function Playbook() {
  const [recommendations, setRecommendations] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const runDecisionEngine = async () => {
    setIsGenerating(true);
    setError('');
    
    try {
      const response = await axios.get('http://localhost:8000/api/generate-recommendations');
      
      // Syncing with backend keys: 'recommendations' and 'bundles'
      setRecommendations(response.data.recommendations || []);
      setBundles(response.data.bundles || []); 
      
      if (response.data.recommendations.length === 0 && response.data.bundles.length === 0) {
        setError("Data analyzed, but no actionable rules or strategies found for this period.");
      }
    } catch (err) {
      console.error(err);
      setError("Error running engine. Please upload data on the Data Ingestion page first.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      
      {/* PAGE HEADER */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Lightbulb className="text-amber-500" size={32} />
          Strategic Playbook
        </h2>
        <p className="text-gray-500 mt-2">Actionable business strategies and algorithmically-filtered product bundles.</p>
      </div>

      {/* CONTROL PANEL */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8 flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-gray-800">OPTIMA Decision Engine</h3>
          <p className="text-sm text-gray-500">Run the logic layer to translate math into marketing advice.</p>
        </div>
        <button 
          onClick={runDecisionEngine}
          disabled={isGenerating}
          className="bg-gray-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-black disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
        >
          {isGenerating ? <><Loader2 className="animate-spin w-5 h-5" /> Compiling Playbook...</> : 'Generate Strategies'}
        </button>
      </div>

      {error && (
        <div className="bg-amber-50 text-amber-800 p-4 rounded-lg mb-8 text-sm font-medium border border-amber-200">
          {error}
        </div>
      )}

      {/* SECTION 1: EXECUTIVE STRATEGIES (from Rule Engine) */}
      {recommendations.length > 0 && (
        <div className="mb-12">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="text-blue-600" />
            Executive Strategy
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.map((rec, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all overflow-hidden flex flex-col h-full group">
                <div className={`px-6 py-4 border-b flex items-start justify-between ${rec.type === 'Bundle Strategy' ? 'bg-indigo-50 border-indigo-100' : 'bg-blue-50 border-blue-100'}`}>
                  <div>
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md ${rec.type === 'Bundle Strategy' ? 'bg-indigo-200 text-indigo-800' : 'bg-blue-200 text-blue-800'}`}>
                      {rec.type}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 mt-3 group-hover:text-indigo-600 transition-colors">
                      {rec.target_item}
                    </h3>
                  </div>
                  {rec.type === "Bundle Strategy" ? <PackagePlus className="text-indigo-500 mt-1" /> : <TrendingUp className="text-blue-500 mt-1" />}
                </div>
                <div className="p-6 flex-grow flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recommended Action</p>
                    <p className="text-gray-900 font-medium mb-6 text-base">{rec.action}</p>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        Algorithmic Rationale <ArrowRight size={12} />
                      </p>
                      <p className="text-sm text-gray-600 leading-relaxed italic">"{rec.justification}"</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: RANKED PRODUCT BUNDLES (from Random Forest) */}
      {bundles.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Zap className="text-emerald-500" />
            Predictive Marketing Bundles
          </h3>
          <div className="grid grid-cols-1 gap-6">
            {bundles.map((rule, idx) => (
              <div key={idx} className={`p-6 rounded-xl border transition-all ${rule.success_probability >= 70 ? 'bg-white border-emerald-200 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-80'}`}>
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      {rule.antecedents} <ArrowRight size={18} className="text-gray-400" /> {rule.consequents}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {rule.success_probability >= 70 
                        ? "High-yield combination identified by Random Forest analysis." 
                        : "Moderate association detected; monitor performance before scaling."}
                    </p>
                  </div>
                  
                  {/* Badge displays if probability is high (>= 70) */}
                  {rule.success_probability >= 70 && (
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                      <CheckCircle2 size={14} /> High Potential
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-gray-100">
                  {/* Random Forest Confidence Score */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-2">Success Probability</p>
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-bold ${rule.success_probability >= 70 ? 'text-emerald-600' : rule.success_probability >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                        {rule.success_probability}%
                      </span>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 max-w-[100px]">
                        <div 
                          className={`h-2.5 rounded-full transition-all duration-500 ${rule.success_probability >= 70 ? 'bg-emerald-600' : rule.success_probability >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} 
                          style={{ width: `${rule.success_probability}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">Confidence (Reliability)</p>
                    <p className="text-lg font-semibold text-gray-800">{(rule.confidence * 100).toFixed(1)}%</p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">Lift (Cross-Sell Multiplier)</p>
                    <p className="text-lg font-semibold text-gray-800">{rule.lift.toFixed(2)}x</p>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}