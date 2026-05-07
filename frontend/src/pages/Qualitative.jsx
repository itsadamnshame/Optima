import React, { useState, useEffect } from 'react';
import { Trophy, Target, Zap, Activity, Package, TrendingUp, Calculator } from 'lucide-react';
import BundleCalculator from '../components/BundleCalculator';

const card = 'rounded-[2rem] border p-6';
const cardStyle = { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' };

export default function Qualitative({ recommendations = {}, isGenerating }) {
  const [activeSize, setActiveSize] = useState(2);
  const [view, setView] = useState('recs');

  const filterBySize = (data) => (!data ? [] : data.filter(item => item.bundle_size === activeSize));

  const renderCategory = (title, Icon, accentColor, rawData) => {
    const filteredData = filterBySize(rawData).slice(0, 5);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-1">
          <div className={`p-2 rounded-xl text-white`} style={{ background: accentColor }}>
            <Icon size={16} />
          </div>
          <h3 className="text-xs font-black text-zinc-200 uppercase tracking-[0.2em]">{title}</h3>
        </div>
        <div className="space-y-4">
          {filteredData.length > 0 ? filteredData.map((play, i) => (
            <div key={i} className="rounded-[1.75rem] border overflow-hidden flex flex-col md:flex-row group transition-all hover:border-indigo-500/40"
              style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}>
              {/* Lift sidebar */}
              <div className="p-6 md:w-32 flex flex-col justify-center items-center text-center"
                style={{ background: 'rgba(99,102,241,0.12)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[8px] font-black text-indigo-400 uppercase mb-1 tracking-wider">Impact</p>
                <p className="text-2xl font-black text-emerald-400 italic">x{play.lift}</p>
                <p className="text-[8px] font-bold text-zinc-600 mt-1 uppercase tracking-wider">Lift</p>
              </div>
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-sm font-black uppercase italic tracking-tight text-white">{play.strategy_name}</h4>
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-tight">Reliability</span>
                    <span className="text-xs font-black text-indigo-400">{play.confidence}%</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[8px] font-black text-zinc-500 uppercase mb-1">Leader Set</p>
                    <p className="text-[10px] font-bold text-zinc-300 uppercase leading-relaxed">{play.leader}</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)' }}>
                    <p className="text-[8px] font-black text-indigo-400 uppercase mb-1">Target Follower(s)</p>
                    <p className="text-[10px] font-bold text-indigo-200 uppercase leading-relaxed">{play.follower}</p>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 font-medium italic border-t pt-3 flex items-center gap-2"
                  style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <Activity size={11} className="text-indigo-400" />"{play.logic}"
                </p>
              </div>
            </div>
          )) : (
            <div className="p-10 rounded-[2rem] border-2 border-dashed text-center"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] font-black text-zinc-600 uppercase italic tracking-widest">
                No {activeSize}-Item {title} Available
              </p>
              <p className="text-[8px] text-zinc-700 uppercase mt-1">Adjust support thresholds or forecast items</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const hasData = recommendations && Object.values(recommendations).some(arr => arr.length > 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="relative rounded-[2rem] p-8 overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10">
          <p className="text-[9px] font-black text-amber-400 uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
            Association Engine Active
          </p>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <Trophy className="text-amber-400" size={28} /> Strategic Playbook
          </h2>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setView('recs')}
              className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${view === 'recs' ? 'bg-white/10 text-white border border-white/10' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <Trophy size={12} /> Recommendations
            </button>
            <button onClick={() => setView('simulator')}
              className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${view === 'simulator' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <Calculator size={12} /> Bundle Simulator
            </button>
          </div>
        </div>

        {view === 'recs' && (
          <div className="relative z-10 flex flex-col items-end gap-2">
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Bundle Complexity</span>
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {[2, 3, 4].map(size => (
                <button key={size} onClick={() => setActiveSize(size)}
                  className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeSize === size ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  {size}-Item
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto">
        {view === 'simulator' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500"><BundleCalculator /></div>
        ) : isGenerating ? (
          <div className="rounded-[2.5rem] p-24 border flex flex-col items-center justify-center space-y-6"
            style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="w-14 h-14 border-4 border-indigo-900 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-zinc-500 font-black uppercase tracking-[0.2em] text-[10px]">Identifying High-Dimensional Patterns...</p>
          </div>
        ) : hasData ? (
          <div className="space-y-12">
            {renderCategory("Velocity Boosters", Zap, "#f59e0b", recommendations.velocity)}
            {renderCategory("High-Affinity Pairs", TrendingUp, "#6366f1", recommendations.affinity)}
            {renderCategory("Inventory Clearout", Package, "#52525b", recommendations.clearout)}
            <div className="flex items-center justify-center gap-4 text-zinc-700 py-8">
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.05)' }} />
              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-700">Audit Strategy Complete</p>
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.05)' }} />
            </div>
          </div>
        ) : (
          <div className="rounded-[2.5rem] p-32 border border-dashed flex flex-col items-center text-center"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <Target size={48} className="text-zinc-700 mb-6" />
            <h3 className="text-2xl font-black text-zinc-300 uppercase italic">No Strategic Matches</h3>
            <p className="text-zinc-600 text-sm max-w-sm mt-2">The system found no bundles meeting the current quality criteria. Try forecasting more items.</p>
          </div>
        )}
      </div>
    </div>
  );
}
