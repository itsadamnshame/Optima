import React from 'react';
import { Trophy, Target, Zap, Activity, Package, TrendingUp } from 'lucide-react';

export default function Playbook({ recommendations = {}, isGenerating }) {
  
  // Helper to render a category section (Fixed the colon error here)
  const renderCategory = (title, Icon, colorClass, data) => (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-3 px-4">
        <div className={`p-2 rounded-lg ${colorClass} text-white shadow-sm`}>
          <Icon size={18} />
        </div>
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">{title}</h3>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {data.map((play, index) => (
          <div key={index} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden hover:border-indigo-500 transition-all flex flex-col md:flex-row group">
            {/* Metric Sidebar */}
            <div className="p-6 bg-slate-900 text-white md:w-32 flex flex-col justify-center items-center text-center">
              <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Lift</p>
              <p className="text-2xl font-black text-emerald-400 italic">x{play.lift}</p>
            </div>
            
            {/* Play Details */}
            <div className="p-6 flex-1">
              <div className="flex justify-between items-start mb-3">
                <h4 className="text-md font-black uppercase italic tracking-tighter text-slate-900">
                  {play.strategy_name}
                </h4>
                <div className="flex flex-col items-end">
                   <span className="text-[8px] font-black text-slate-400 uppercase">Confidence</span>
                   <span className="text-[10px] font-black text-indigo-600">{play.confidence}%</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Leader SKU</p>
                  <p className="text-[10px] font-bold text-slate-700 truncate uppercase">{play.leader}</p>
                </div>
                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                  <p className="text-[8px] font-black text-indigo-400 uppercase mb-0.5">Target Follower</p>
                  <p className="text-[10px] font-bold text-indigo-900 truncate uppercase">{play.follower}</p>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 font-medium italic border-t border-slate-50 pt-3 flex items-center gap-2">
                <Activity size={12} className="text-indigo-400" />
                "{play.logic}"
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const hasData = recommendations && (
    (recommendations.velocity && recommendations.velocity.length > 0) ||
    (recommendations.affinity && recommendations.affinity.length > 0) ||
    (recommendations.clearout && recommendations.clearout.length > 0)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-900 flex items-center gap-3 tracking-tight uppercase italic">
            <Trophy className="text-amber-500" size={40} />
            Strategic Playbook
          </h2>
          <p className="text-slate-500 font-medium ml-12 italic text-sm">
              Generated Tactical Bundles based on Leader-Follower Affinity.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
        {isGenerating ? (
          <div className="bg-white rounded-[3rem] p-24 border border-slate-100 flex flex-col items-center justify-center space-y-6 shadow-sm">
            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[11px]">Syncing Association Rules...</p>
          </div>
        ) : hasData ? (
          <div className="space-y-12">
            {recommendations.velocity?.length > 0 && 
              renderCategory("Velocity Boosters", Zap, "bg-amber-500", recommendations.velocity)}
            
            {recommendations.affinity?.length > 0 && 
              renderCategory("High-Affinity Pairs", TrendingUp, "bg-indigo-600", recommendations.affinity)}
            
            {recommendations.clearout?.length > 0 && 
              renderCategory("Inventory Clearout", Package, "bg-slate-700", recommendations.clearout)}

            <div className="flex items-center justify-center gap-4 text-slate-300 py-10">
              <div className="h-px bg-slate-200 flex-1"></div>
              <p className="text-[8px] font-black uppercase tracking-[0.4em]">Audit Strategy Complete</p>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[3rem] p-32 border border-dashed border-slate-200 flex flex-col items-center text-center shadow-sm">
            <div className="bg-slate-50 p-6 rounded-full mb-6">
              <Target size={48} className="text-slate-300" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 uppercase italic">No Active Plays</h3>
            <p className="text-slate-500 text-sm max-w-sm mt-2 leading-relaxed">
              Run a <b className="text-indigo-600 uppercase">Quantitative Audit</b> first to identify Leaders and generate seasonal association rules.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}