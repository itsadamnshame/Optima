import React from 'react';
import { Sparkles, FileText, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight, ClipboardList } from 'lucide-react';

export default function Playbook({ recommendations = {}, forecastMetrics = {}, isGenerating }) {

  const generateStrategy = () => {
    const metricKeys = Object.keys(forecastMetrics || {});
    const firstItemKey = metricKeys.length > 0 ? metricKeys[0] : null;
    const mape = firstItemKey ? (forecastMetrics[firstItemKey]?.mape_pct ?? null) : null;
    const errorRate = mape !== null ? `${mape.toFixed(1)}%` : 'N/A';
    const avgMae = firstItemKey ? (forecastMetrics[firstItemKey]?.mae ?? '0.00') : '0.00';
    const velocityPlays = recommendations?.velocity ?? [];
    const hasVelocity = velocityPlays.length > 0;
    const topItem = hasVelocity ? velocityPlays[0].leader : 'the selected inventory';
    const bestFollower = hasVelocity ? velocityPlays[0].follower : 'associated secondary products';
    const topConfidence = hasVelocity ? velocityPlays[0].confidence : '0';

    return (
      <div className="space-y-5">
        <p className="text-base leading-relaxed font-medium" style={{ color: 'var(--text-secondary)' }}>
          Based on the unified audit, the{' '}
          <span className="font-bold" style={{ color: 'var(--accent)' }}>{topItem}</span> segment is entering a statistically significant
          demand phase. With a calculated forecast error percentage (MAPE) of{' '}
          <span className="font-bold" style={{ color: 'var(--text-heading)' }}>{errorRate}</span>, the risk of inventory stockout remains manageable, provided
          that the detected short-term buying patterns are used to guide weekend stocking levels.
        </p>
        <p className="text-base leading-relaxed font-medium" style={{ color: 'var(--text-secondary)' }}>
          Qualitative discovery suggests a dominant relational affinity between{' '}
          <span className="font-bold" style={{ color: 'var(--text-heading)' }}>{topItem}</span> and{' '}
          <span className="font-bold" style={{ color: 'var(--accent)' }}>{bestFollower}</span>, showing a reliability rate of{' '}
          <span className="font-bold" style={{ color: 'var(--accent)' }}>{topConfidence}%</span>. Our decision analysis predicts
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
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest mb-4"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--accent)' }}>
          <Sparkles size={13} /> Executive Strategy Report
        </div>
        <h2 className="text-4xl font-black tracking-tighter uppercase italic" style={{ color: 'var(--text-heading)' }}>Executive Output</h2>
        <p className="font-medium italic" style={{ color: 'var(--text-secondary)' }}>Synthesized Market Intelligence & Action Plan</p>
      </div>

      {isGenerating ? (
        <div className="rounded-[2.5rem] p-24 border flex flex-col items-center justify-center space-y-4"
          style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
          <div className="w-12 h-12 border-4 border-t-indigo-500 rounded-full animate-spin" style={{ borderColor: 'var(--border)' }} />
          <p className="font-black uppercase tracking-widest text-[10px]" style={{ color: 'var(--text-muted)' }}>Synthesizing Executive Narrative...</p>
        </div>
      ) : hasData ? (
        <div className="space-y-6">
          {/* Tactical Narrative */}
          <div className="rounded-[2.5rem] p-10 relative overflow-hidden"
            style={{ background: 'var(--glass-bg)', border: `1px solid var(--glass-border)` }}>
            <div className="absolute top-0 right-0 p-8 opacity-[0.04] text-white">
              <FileText size={120} />
            </div>
            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              <TrendingUp size={14} style={{ color: 'var(--accent)' }} /> Tactical Narrative
            </h3>
            {generateStrategy()}
          </div>

          {/* Action Directives + Risk */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-[2rem] p-8" style={{ background: 'var(--glass-bg)', border: `1px solid var(--glass-border)` }}>
              <h3 className="text-[9px] font-black uppercase tracking-widest mb-6 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <CheckCircle2 size={14} style={{ color: 'var(--accent)' }} /> Action Directives
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 p-1 rounded-full flex-shrink-0" style={{ background: 'var(--card-accent-bg)' }}>
                    <ArrowRight size={11} style={{ color: 'var(--accent)' }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Consider bundling opportunities for high-affinity pairs to capture potential demand volume.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 p-1 rounded-full flex-shrink-0" style={{ background: 'var(--card-accent-bg)' }}>
                    <ArrowRight size={11} style={{ color: 'var(--accent)' }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Maintain a safety stock buffer of approximately{' '}
                    <span className="font-bold" style={{ color: 'var(--text-heading)' }}>
                      {Object.keys(forecastMetrics).length > 0 ? forecastMetrics[Object.keys(forecastMetrics)[0]]?.mae : '0'}
                    </span> units.
                  </p>
                </li>
              </ul>
            </div>

            <div className="rounded-[2rem] p-8" style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)' }}>
              <h3 className="text-[9px] font-black uppercase tracking-widest mb-6 flex items-center gap-2" style={{ color: 'var(--sim-error-text)' }}>
                <AlertTriangle size={14} /> Risk Assessment
              </h3>
              <p className="text-sm font-bold leading-relaxed italic" style={{ color: 'var(--sim-error-text)', opacity: 0.8 }}>
                "The primary risk for this cycle involves the potential under-utilization of detected cross-sell patterns. Monitoring holiday-related surges may help prevent stockouts on forecasted Leaders."
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[2.5rem] p-32 border border-dashed flex flex-col items-center text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--glass-bg)' }}>
          <ClipboardList size={48} className="mb-6 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-2xl font-black uppercase italic" style={{ color: 'var(--text-secondary)' }}>Awaiting Analytical Inputs</h3>
          <p className="text-sm max-w-sm mt-2" style={{ color: 'var(--text-muted)' }}>Run both Quantitative and Qualitative modules to generate the Executive Output.</p>
        </div>
      )}
    </div>
  );
}
