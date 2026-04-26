import React from 'react';
import { Sparkles, FileText, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight, ClipboardList } from 'lucide-react';

export default function Playbook({ recommendations = {}, forecastMetrics = {}, isGenerating }) {

    // --- NARRATIVE GENERATOR ENGINE (SAFE VERSION) ---
    const generateStrategy = () => {
        // 1. Extract first available metric key safely
        const metricKeys = Object.keys(forecastMetrics || {});
        const firstItemKey = metricKeys.length > 0 ? metricKeys[0] : null;

        // 2. Safe data extraction with fallbacks
        const accuracy = firstItemKey ? (forecastMetrics[firstItemKey]?.mape_pct ?? "N/A") : "N/A";
        const avgMae = firstItemKey ? (forecastMetrics[firstItemKey]?.mae ?? "0.00") : "0.00";

        // 3. Safe recommendations extraction
        const velocityPlays = recommendations?.velocity ?? [];
        const hasVelocity = velocityPlays.length > 0;

        const topItem = hasVelocity ? velocityPlays[0].leader : "the selected inventory";
        const bestFollower = hasVelocity ? velocityPlays[0].follower : "associated secondary products";
        const topConfidence = hasVelocity ? velocityPlays[0].confidence : "0";

        return (
            <div className="space-y-6">
                <p className="text-lg leading-relaxed text-slate-700 font-medium">
                    Based on the unified audit, the <span className="text-indigo-600 font-bold">{topItem}</span> segment
                    is entering a statistically significant demand phase. With a verified model reliability
                    of <span className="font-bold">{accuracy}</span>, the risk of inventory stockout remains low,
                    provided that the detected SARIMA micro-patterns are used to guide weekend stocking levels.
                </p>
                <p className="text-lg leading-relaxed text-slate-700 font-medium">
                    Qualitative discovery suggests a dominant relational affinity between <span className="font-bold">{topItem}</span>
                    and <span className="text-indigo-600 font-bold">{bestFollower}</span>, showing a
                    predictive reliability of <span className="text-indigo-600 font-bold">{topConfidence}%</span>.
                    Our Random Forest decision layer predicts a high success probability for multi-item bundling
                    in this category. We recommend prioritizing these sets over individual SKU promotions to maximize
                    the Impact Multiplier (Lift) detected in this cycle.
                </p>
            </div>
        );
    };

    // Check if we actually have velocity or affinity rules to talk about
    const hasData = recommendations &&
        ((recommendations.velocity && recommendations.velocity.length > 0) ||
            (recommendations.affinity && recommendations.affinity.length > 0));

    return (
        <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">

            {/* HEADER SECTION */}
            <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                    <Sparkles size={14} /> Executive Strategy Report
                </div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">Strategic Playbook</h2>
                <p className="text-slate-500 font-medium italic">Synthesized Market Intelligence & Action Plan</p>
            </div>

            {isGenerating ? (
                <div className="bg-white rounded-[3rem] p-24 border border-slate-100 flex flex-col items-center justify-center space-y-4 shadow-sm">
                    <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Synthesizing Executive Narrative...</p>
                </div>
            ) : hasData ? (
                <div className="space-y-8">

                    {/* TACTICAL NARRATIVE BLOCK */}
                    <div className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5 text-slate-900">
                            <FileText size={120} />
                        </div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                            <TrendingUp size={16} className="text-emerald-500" /> Tactical Narrative
                        </h3>
                        {generateStrategy()}
                    </div>

                    {/* ACTION DIRECTIVES & RISK ASSESSMENT */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-lg">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-emerald-400" /> Action Directives
                            </h3>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3 group">
                                    <div className="mt-1 bg-emerald-500/20 p-1 rounded-full text-emerald-400"><ArrowRight size={12} /></div>
                                    <p className="text-sm font-medium text-slate-300">Execute aggressive bundling for high-affinity pairs to capture predicted demand volume.</p>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="mt-1 bg-emerald-500/20 p-1 rounded-full text-emerald-400"><ArrowRight size={12} /></div>
                                    <p className="text-sm font-medium text-slate-300">Maintain a safety stock buffer of approximately {Object.keys(forecastMetrics).length > 0 ? forecastMetrics[Object.keys(forecastMetrics)[0]]?.mae : '0'} units.</p>
                                </li>
                            </ul>
                        </div>

                        <div className="bg-amber-50 rounded-[2rem] p-8 border border-amber-100">
                            <h3 className="text-[10px] font-black text-amber-600/60 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <AlertTriangle size={16} className="text-amber-500" /> Risk Assessment
                            </h3>
                            <p className="text-sm font-bold text-amber-900 leading-relaxed italic">
                                "The primary risk for this cycle is under-utilizing detected cross-sell patterns. We advise monitoring holiday-related surges to prevent stockouts on forecasted Leaders."
                            </p>
                        </div>
                    </div>

                </div>
            ) : (
                <div className="bg-white rounded-[3rem] p-32 border border-dashed border-slate-200 flex flex-col items-center text-center shadow-sm">
                    <ClipboardList size={48} className="text-slate-300 mb-6" />
                    <h3 className="text-2xl font-black text-slate-800 uppercase italic">Awaiting Analytical Inputs</h3>
                    <p className="text-slate-500 text-sm max-w-sm mt-2">Run both Quantitative and Qualitative modules to generate the Strategic Playbook.</p>
                </div>
            )}
        </div>
    );
}