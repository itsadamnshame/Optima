import React, { useState } from 'react';
import { Trophy, Target, Zap, Activity, Package, TrendingUp, HelpCircle, Calculator } from 'lucide-react';
import BundleCalculator from '../components/BundleCalculator';

export default function Playbook({ recommendations = {}, isGenerating }) {
  // Complexity Toggle: Defaulting to 2-item bundles
  const [activeSize, setActiveSize] = useState(2);
  const [view, setView] = useState('recs'); // 'recs' or 'simulator'

  // Filters the raw data pool by the selected bundle size
  const filterBySize = (data) => {
    if (!data) return [];
    return data.filter(item => item.bundle_size === activeSize);
  };

  const renderCategory = (title, Icon, colorClass, rawData) => {
    // 1. Filter by 2, 3, or 4 item logic
    // 2. Slice strictly to top 5 to avoid UI overflow
    const filteredData = filterBySize(rawData).slice(0, 5);

    return (
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-3 px-4">
          <div className={`p-2 rounded-lg ${colorClass} text-white shadow-sm`}>
            <Icon size={18} />
          </div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">{title}</h3>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {filteredData.length > 0 ? filteredData.map((play, index) => (
            <div key={index} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden hover:border-indigo-500 transition-all flex flex-col md:flex-row group animate-in slide-in-from-bottom-2 duration-300">

              {/* IMPACT MULTIPLIER (LIFT) SIDEBAR */}
              <div className="p-6 bg-slate-900 text-white md:w-36 flex flex-col justify-center items-center text-center">
                <p className="text-[7px] font-black text-indigo-400 uppercase mb-1 tracking-tighter">Impact Multiplier</p>
                <p className="text-2xl font-black text-emerald-400 italic">x{play.lift}</p>
                <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-widest">(Lift)</p>
              </div>

              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-md font-black uppercase italic tracking-tighter text-slate-900">
                    {play.strategy_name}
                  </h4>

                  {/* PREDICTIVE RELIABILITY (CONFIDENCE) */}
                  <div className="flex flex-col items-end">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-tight">Predictive Reliability</span>
                    <span className="text-[10px] font-black text-indigo-600">
                      {play.confidence}%
                      <span className="text-[8px] text-slate-400 font-normal ml-1 uppercase tracking-tighter">(Confidence)</span>
                    </span>
                  </div>
                </div>

                {/* BUNDLE ITEM SETS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 group-hover:bg-white transition-colors">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Leader Set</p>
                    <p className="text-[10px] font-bold text-slate-700 uppercase leading-relaxed tracking-tight">
                      {play.leader}
                    </p>
                  </div>
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 group-hover:bg-white transition-colors">
                    <p className="text-[8px] font-black text-indigo-400 uppercase mb-1">Target Follower(s)</p>
                    <p className="text-[10px] font-bold text-indigo-900 uppercase leading-relaxed tracking-tight">
                      {play.follower}
                    </p>
                  </div>
                </div>

                {/* ANALYTICAL LOGIC */}
                <p className="text-[11px] text-slate-500 font-medium italic border-t border-slate-50 pt-3 flex items-center gap-2">
                  <Activity size={12} className="text-indigo-400" />
                  "{play.logic}"
                </p>
              </div>
            </div>
          )) : (
            <div className="p-10 border-2 border-dashed border-slate-100 rounded-[2.5rem] text-center flex flex-col items-center">
              <p className="text-[10px] font-black text-slate-300 uppercase italic tracking-widest">
                No {activeSize}-Item {title} Available
              </p>
              <p className="text-[8px] text-slate-300 uppercase mt-1">Adjust support thresholds or forecast items</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const hasData = recommendations && Object.values(recommendations).some(arr => arr.length > 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 flex items-center gap-3 tracking-tight uppercase italic">
            <Trophy className="text-amber-500" size={40} />
            Strategic Playbook
          </h2>
          <div className="flex gap-4 ml-12 mt-4">
            <button
              onClick={() => setView('recs')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${view === 'recs' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}
            >
              <Trophy size={14} /> Recommendations
            </button>
            <button
              onClick={() => setView('simulator')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${view === 'simulator' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}
            >
              <Calculator size={14} /> Bundle Simulator
            </button>
          </div>
        </div>

        {/* BUNDLE SIZE SELECTOR (Only show for recs) */}
        {view === 'recs' && (
          <div className="flex flex-col items-end gap-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2">Bundle Complexity Level</span>
            <div className="bg-white p-1.5 rounded-2xl border border-slate-200 flex gap-1 shadow-sm">
              {[2, 3, 4].map((size) => (
                <button
                  key={size}
                  onClick={() => setActiveSize(size)}
                  className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSize === size
                    ? 'bg-indigo-600 text-white shadow-lg scale-105'
                    : 'text-slate-400 hover:bg-slate-50'
                    }`}
                >
                  {size}-Item
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto">
        {view === 'simulator' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <BundleCalculator />
          </div>
        ) : isGenerating ? (
          <div className="bg-white rounded-[3rem] p-24 border border-slate-100 flex flex-col items-center justify-center space-y-6 shadow-sm">
            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[11px]">Identifying High-Dimensional Patterns...</p>
          </div>
        ) : hasData ? (
          <div className="space-y-12">
            {renderCategory("Velocity Boosters", Zap, "bg-amber-500", recommendations.velocity)}
            {renderCategory("High-Affinity Pairs", TrendingUp, "bg-indigo-600", recommendations.affinity)}
            {renderCategory("Inventory Clearout", Package, "bg-slate-700", recommendations.clearout)}

            <div className="flex items-center justify-center gap-4 text-slate-300 py-10">
              <div className="h-px bg-slate-200 flex-1"></div>
              <p className="text-[8px] font-black uppercase tracking-[0.4em]">Audit Strategy Complete</p>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[3rem] p-32 border border-dashed border-slate-200 flex flex-col items-center text-center shadow-sm">
            <Target size={48} className="text-slate-300 mb-6" />
            <h3 className="text-2xl font-black text-slate-800 uppercase italic">No Strategic Matches</h3>
            <p className="text-slate-500 text-sm max-w-sm mt-2">The system found no bundles meeting the current quality criteria. Try forecasting more items in the Quantitative tab.</p>
          </div>
        )}
      </div>
    </div>
  );
}
