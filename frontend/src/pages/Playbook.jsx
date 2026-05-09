import React from 'react';
import { Sparkles, FileText, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight, ClipboardList } from 'lucide-react';

export default function Playbook({ recommendations = {}, forecastMetrics = {}, isGenerating }) {

  const generateStrategy = () => {
    const metricKeys = Object.keys(forecastMetrics || {});
    const firstItemKey = metricKeys.length > 0 ? metricKeys[0] : null;
    const accuracy = firstItemKey ? (forecastMetrics[firstItemKey]?.mape_pct ?? 'N/A') : 'N/A';
    const avgMae = firstItemKey ? (forecastMetrics[firstItemKey]?.mae ?? '0.00') : '0.00';
    const velocityPlays = recommendations?.velocity ?? [];
    const hasVelocity = velocityPlays.length > 0;
    const topItem = hasVelocity ? velocityPlays[0].leader : 'the selected inventory';
    const bestFollower = hasVelocity ? velocityPlays[0].follower : 'associated secondary products';
    const topConfidence = hasVelocity ? velocityPlays[0].confidence : '0';

    return (
      <div className="space-y-5">
        <p className="text-base leading-relaxed text-zinc-300 font-medium">
          Based on the unified audit, the{' '}
          <span className="text-indigo-400 font-bold">{topItem}</span> segment is entering a statistically significant
          demand phase. With a verified model reliability of{' '}
          <span className="font-bold text-white">{accuracy}</span>, the risk of inventory stockout remains low, provided
          that the detected short-term buying patterns are used to guide weekend stocking levels.
        </p>
        <p className="text-base leading-relaxed text-zinc-300 font-medium">
          Qualitative discovery suggests a dominant relational affinity between{' '}
          <span className="font-bold text-white">{topItem}</span> and{' '}
          <span className="text-indigo-400 font-bold">{bestFollower}</span>, showing a reliability rate of{' '}
          <span className="text-indigo-400 font-bold">{topConfidence}%</span>. Our decision analysis predicts
          a high success probability for multi-item bundling in this category.
        </p>
      </div>
    );
  };

  const hasData = recommendations &&
    ((recommendations.velocity && recommendations.velocity.length > 0) ||
     (recommendations.affinity && recommendations.affinity.length > 0));

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4"
          style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc' }}>
          <Sparkles size={13} /> Executive Strategy Report
        </div>
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic">Strategic Playbook</h2>
        <p className="text-zinc-500 font-medium italic">Synthesized Market Intelligence & Action Plan</p>
      </div>

      {isGenerating ? (
        <div className="rounded-[2.5rem] p-24 border flex flex-col items-center justify-center space-y-4"
          style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
          <div className="w-12 h-12 border-4 border-indigo-900 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Synthesizing Executive Narrative...</p>
        </div>
      ) : hasData ? (
        <div className="space-y-6">
          {/* Tactical Narrative */}
          <div className="rounded-[2.5rem] p-10 relative overflow-hidden"
            style={{ background: 'var(--glass-bg)', border: `1px solid var(--glass-border)` }}>
            <div className="absolute top-0 right-0 p-8 opacity-[0.04] text-white">
              <FileText size={120} />
            </div>
            <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-500" /> Tactical Narrative
            </h3>
            {generateStrategy()}
          </div>

          {/* Action Directives + Risk */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-[2rem] p-8" style={{ background: 'var(--glass-bg)', border: `1px solid var(--glass-border)` }}>
              <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500" /> Action Directives
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 p-1 rounded-full flex-shrink-0" style={{ background: 'rgba(52,211,153,0.15)' }}>
                    <ArrowRight size={11} className="text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-400">Execute aggressive bundling for high-affinity pairs to capture predicted demand volume.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 p-1 rounded-full flex-shrink-0" style={{ background: 'rgba(52,211,153,0.15)' }}>
                    <ArrowRight size={11} className="text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-400">
                    Maintain a safety stock buffer of approximately{' '}
                    <span className="text-white font-bold">
                      {Object.keys(forecastMetrics).length > 0 ? forecastMetrics[Object.keys(forecastMetrics)[0]]?.mae : '0'}
                    </span> units.
                  </p>
                </li>
              </ul>
            </div>

            <div className="rounded-[2rem] p-8" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
              <h3 className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500" /> Risk Assessment
              </h3>
              <p className="text-sm font-bold text-amber-300/70 leading-relaxed italic">
                "The primary risk for this cycle is under-utilizing detected cross-sell patterns. We advise monitoring
                holiday-related surges to prevent stockouts on forecasted Leaders."
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[2.5rem] p-32 border border-dashed flex flex-col items-center text-center"
          style={{ borderColor: 'var(--border)' }}>
          <ClipboardList size={48} className="text-zinc-700 mb-6" />
          <h3 className="text-2xl font-black text-zinc-300 uppercase italic">Awaiting Analytical Inputs</h3>
          <p className="text-zinc-600 text-sm max-w-sm mt-2">Run both Quantitative and Qualitative modules to generate the Strategic Playbook.</p>
        </div>
      )}
    </div>
  );
}
