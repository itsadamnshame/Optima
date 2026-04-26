import React from 'react';
import { Trophy, Target, Zap, ArrowRight, Activity } from 'lucide-react';

// We accept the shared state from App.jsx as props
export default function Playbook({ recommendations = [], isGenerating }) {
  
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-900 flex items-center gap-3 tracking-tight uppercase italic">
            <Trophy className="text-amber-500" size={40} />
            Strategic Playbook
          </h2>
          <p className="text-slate-500 font-medium ml-12 italic">
            AI-Generated Tactical Bundles based on Leader-Follower Affinity.
          </p>
        </div>
      </div>

      {/* THE CENTERED MODULE CONTAINER */}
      <div className="max-w-5xl mx-auto">
        {isGenerating ? (
          /* LOADING STATE */
          <div className="bg-white rounded-[3rem] p-24 border border-slate-100 flex flex-col items-center justify-center space-y-6 shadow-sm">
            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[11px]">Assembling Tactical Plays...</p>
          </div>
        ) : recommendations && recommendations.length > 0 ? (
          /* ACTIVE STATE: Displaying the Tactical Cards */
          <div className="space-y-6">
            {recommendations.map((play, index) => (
              <div key={index} className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden hover:border-indigo-500 transition-all flex flex-col md:flex-row group">
                {/* Lift Score Side-bar */}
                <div className="p-8 bg-slate-900 text-white md:w-48 flex flex-col justify-center items-center text-center">
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Lift Score</p>
                  <p className="text-4xl font-black text-emerald-400 italic">x{play.lift_score}</p>
                </div>
                
                {/* Tactical Content */}
                <div className="p-8 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">
                      {play.strategy_name}
                    </h4>
                    <span className="bg-indigo-50 text-indigo-600 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                      Confirmed Affinity
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Leader SKU</p>
                      <p className="text-[11px] font-bold text-slate-700 truncate uppercase">{play.leader}</p>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                      <p className="text-[9px] font-black text-indigo-400 uppercase mb-1">Target Follower</p>
                      <p className="text-[11px] font-bold text-indigo-900 truncate uppercase">{play.follower}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 border-t border-slate-50 pt-4">
                    <Activity size={14} className="text-indigo-500 mt-0.5" />
                    <p className="text-xs text-slate-500 font-medium italic leading-relaxed">
                      "{play.logic}"
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* EMPTY STATE: Your original UI */
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

      {/* FOOTER NOTE (Optional - keeps the centered aesthetic) */}
      {recommendations.length > 0 && (
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-4 text-slate-400">
          <div className="h-px bg-slate-200 flex-1"></div>
          <p className="text-[9px] font-black uppercase tracking-[0.3em]">End of Tactical Suggestions</p>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>
      )}
    </div>
  );
}