import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Loader2, Activity, Calendar, AlertTriangle,
  Zap, Info, TrendingUp, ShieldCheck, CheckSquare,
  ListOrdered, Filter, ChevronDown, ChevronUp, Sparkles,
  BarChart2, ArrowUpRight, ArrowDownRight, Minus, X, CheckCircle
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Area, Line, ReferenceLine, BarChart, Bar, Cell
} from 'recharts';

import SpecialDaysManager from '../components/SpecialDaysManager';
import { useAuth } from '../contexts/AuthContext';

export default function Analytics({
  activeDatasetId,
  isGenerating,
  setGlobalRecommendations,
  setGlobalLoading,
  setPersistedChart,
  setPersistedMetrics,
  setLastForecastTime,
  existingChart,
  existingMetrics,
  endDate,
  setEndDate,
  selectionMode,
  setSelectionMode,
  topN,
  setTopN,
  selectedManualItems,
  setSelectedManualItems,
  progress
}) {
  const { token } = useAuth();
  // 1. Initialize local state with existing data from the Global Vault
  const [chartData, setChartData] = useState(existingChart || []);
  const [performanceMetrics, setPerformanceMetrics] = useState(existingMetrics || {});
  const [error, setError] = useState('');
  const [auditComplete, setAuditComplete] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);

  // If we have data already, we might want to hide filters by default
  const [showFilters, setShowFilters] = useState(chartData.length === 0);

  const fetchCalendar = async () => {
    try {
      const res = await axios.get('/api/get-events', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setCalendarEvents(res.data.events || []);
    } catch (err) {
      console.error("Calendar sync failed");
    }
  };

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await axios.get('/api/get-items', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setAvailableItems(res.data.items || []);
      } catch (err) { console.error(err); }
    };
    fetchItems();
    fetchCalendar();
  }, []);

  const runSpecialistAnalysis = async () => {
    if (!activeDatasetId) {
      setError("No active dataset selected. Please choose a source from the sidebar first.");
      return;
    }
    if (!endDate) {
      setError("Please select a target end date.");
      return;
    }
    if (selectionMode === 'manual' && selectedManualItems.length === 0) {
      setError("Please select at least one item.");
      return;
    }

    if (setGlobalLoading) setGlobalLoading(true);
    setAuditComplete(false);
    setError('');

    try {
      const response = await axios.get('/api/generate-recommendations', {
        params: {
          dataset_id: activeDatasetId,
          end_date: endDate,
          mode: selectionMode,
          top_n: topN,
          selected_items: selectedManualItems.join(',')
        },
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 120000  // 2-minute timeout for long-running analysis
      });

      // Validate response structure before rendering
      const data = Array.isArray(response.data.chart_data) ? response.data.chart_data : [];
      const metrics = response.data.performance_metrics || {};
      const recs = response.data.recommendations || {};

      if (data.length === 0) {
        setError("No forecast data returned. Try a different date range or items.");
        return;
      }

      // Update Local State with graceful rendering
      setChartData(data);
      setPerformanceMetrics(metrics);

      // UPDATE GLOBAL VAULT (Persists across page switches)
      setPersistedChart(data);
      setPersistedMetrics(metrics);
      setGlobalRecommendations(recs);
      setLastForecastTime(new Date().getTime()); // Start the 10-minute timer

      setShowFilters(false);
      setAuditComplete(true);
      setTimeout(() => setAuditComplete(false), 5000);
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setError("Session Expired. Please logout and login again to refresh your access.");
      } else if (err.code === 'ECONNABORTED') {
        setError("Analysis took too long (timeout). Try forecasting fewer items.");
      } else if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Analysis failed. Check your connection or date range.");
      }
      console.error("Analysis error:", err);
    } finally {
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };

  const handleManualToggle = (item) => {
    if (selectedManualItems.includes(item)) {
      setSelectedManualItems(selectedManualItems.filter(i => i !== item));
    } else {
      if (selectedManualItems.length >= 10) return;
      setSelectedManualItems([...selectedManualItems, item]);
    }
  };

  const resultItems = React.useMemo(() => {
    return Array.isArray(chartData) ? [...new Set(chartData.map(d => d.item_description))] : [];
  }, [chartData]);

  const [activeItem, setActiveItem] = useState('');
  const [showDecomp, setShowDecomp] = useState(false);

  useEffect(() => {
    if (resultItems.length > 0 && !activeItem) {
      setActiveItem(resultItems[0]);
    }
  }, [resultItems, activeItem]);

  const filteredData = chartData.filter(d => d.item_description === activeItem);
  const futureData = filteredData.filter(d => d.type === 'future');
  const peaks = [...futureData].sort((a, b) => b.predicted_quantity - a.predicted_quantity).slice(0, 3);
  const holidays = futureData.filter(d => d.special_day_detected === 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">

      {/* SUCCESS TOAST */}
      {auditComplete && (
        <div
          className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 duration-500"
          style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', backdropFilter: 'blur(12px)', color: '#6ee7b7' }}
        >
          <CheckCircle size={20} className="text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-black text-white">Audit Complete</p>
            <p className="text-[10px] text-emerald-400/80 font-medium">Specialist analysis ready — scroll down to view results</p>
          </div>
          <button onClick={() => setAuditComplete(false)} className="ml-2 text-emerald-400/50 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      )}
      {/* HEADER */}
      <div className="relative rounded-[2.5rem] p-8 overflow-hidden flex justify-between items-center"
        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/30 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10">
          <p className="text-indigo-400 text-[9px] font-black uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
            Hybrid Analytical Engine Active
          </p>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <TrendingUp className="text-indigo-400" size={30} /> Forecasting Specialist
          </h2>
          <p className="text-zinc-500 text-xs font-medium mt-1 ml-10">
            Prophet (Macro Trends) + SARIMA (Short-Term Corrections) · {calendarEvents.length} events loaded
          </p>
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className="relative z-10 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-300 hover:text-white transition-all px-5 py-3 rounded-2xl backdrop-blur-sm"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Filter size={13} />
          {showFilters ? 'Hide Config' : 'Configure'}
          {showFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Error Banner — fixed below header so it's always visible */}
      {error && (
        <div className="rounded-2xl flex items-center gap-4 text-sm font-black p-5 animate-in slide-in-from-top-2 duration-300"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
          <AlertTriangle size={22} className="flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-300 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* CONFIG BLOCK */}
      {showFilters && (
        <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Mode */}
            <div className="p-6 rounded-3xl space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">1. Forecast Mode</label>
              <div className="space-y-3">
                {[['top', 'Top Velocity Items'], ['manual', 'Manual SKU Selection']].map(([val, label]) => (
                  <button key={val} onClick={() => setSelectionMode(val)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${selectionMode === val ? 'border-indigo-500 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                    style={selectionMode === val ? { background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.4)' } : { background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
                    <span className="font-bold text-sm">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Scope */}
            <div className="p-6 rounded-3xl space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">2. Scope & Horizon</label>
              {selectionMode === 'top' ? (
                <div className="py-2">
                  <input type="range" min="3" max="10" value={topN} onChange={(e) => setTopN(parseInt(e.target.value))}
                    className="w-full h-2 rounded-lg accent-indigo-600 mb-2" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <p className="text-[10px] font-black text-zinc-500 text-center uppercase tracking-widest">Analyzing Top {topN} Products</p>
                </div>
              ) : (
                <div className="h-28 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
                  {availableItems.map(item => (
                    <label key={item} className="flex items-center gap-3 p-1 rounded-lg cursor-pointer hover:bg-white/5">
                      <input type="checkbox" checked={selectedManualItems.includes(item)} onChange={() => handleManualToggle(item)} className="rounded accent-indigo-600" />
                      <span className="text-[10px] font-bold text-zinc-400 truncate uppercase">{item}</span>
                    </label>
                  ))}
                </div>
              )}
              <input type="date" className="w-full rounded-xl py-2.5 px-4 text-sm font-bold text-zinc-300 outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                value={endDate || ''}
                onChange={(e) => setEndDate(e.target.value)} />
            </div>

          {/* Execute */}
            <div className="rounded-3xl p-6 flex flex-col justify-center items-center text-center space-y-4 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', boxShadow: '0 0 40px rgba(99,102,241,0.25)' }}>
              {isGenerating ? (
                <>
                  <div className="w-full space-y-4">
                    <div className="flex items-center gap-3 justify-center">
                      <Loader2 className="animate-spin text-white" size={22} />
                      <p className="text-white font-black text-base uppercase tracking-tight">
                        {progress < 20 ? 'Initializing Specialist Pipeline...' :
                         progress < 40 ? 'Phase 1: Multi-SKU Hyper-Tuning...' :
                         progress < 70 ? 'Phase 2: Hybrid Pattern Fitting...' :
                         progress < 90 ? 'Phase 3: Accuracy Validation...' :
                         'Finalizing Strategic Verdict...'}
                      </p>
                    </div>
                    <div className="bg-black/20 rounded-xl p-3 border border-white/5 space-y-1">
                       <p className="text-indigo-200 text-[9px] font-bold uppercase tracking-widest flex items-center gap-2">
                         <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                         Live Audit Status: {Math.round(progress)}%
                       </p>
                       <p className="text-indigo-300/60 text-[8px] font-medium italic">
                         Optimizing {selectionMode === 'top' ? topN : selectedManualItems.length} items @ 5 trials/SKU
                       </p>
                    </div>
                    {/* Simplified progress line */}
                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{
                          background: '#fff',
                          width: `${Math.min(progress, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white/20 p-3 rounded-full text-white animate-pulse"><Sparkles size={22} /></div>
                  <div>
                    <h4 className="text-white font-black text-lg uppercase tracking-tight italic">Ready for Audit?</h4>
                    <p className="text-indigo-200 text-[10px] font-medium leading-relaxed px-4 mt-1">
                      Reconciling Trends with {calendarEvents.length} Calendar Disruptions.
                    </p>
                  </div>
                  <button onClick={runSpecialistAnalysis}
                    className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 shadow-lg">
                    <Zap size={18} /> GENERATE SPECIALIST AUDIT
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Calendar Manager with integrated Hybrid Status */}
          <SpecialDaysManager onUpdate={fetchCalendar} />

        </div>
      )}

      {/* OLD error block removed — now lives above config */}

      {/* RESULTS */}
      {filteredData.length > 0 && (() => {
        const m = performanceMetrics[activeItem] || {};
        const totalFuture = futureData.reduce((s, r) => s + Number(r.predicted_quantity || 0), 0);
        const avgFuture = futureData.length ? (totalFuture / futureData.length).toFixed(1) : 0;
        const sarima0 = futureData[0]?.sarima_pattern_correction ?? 0;
        const sarimaDir = sarima0 > 0.5 ? 'boosting' : sarima0 < -0.5 ? 'dampening' : 'stable';

        return (
          <div className="space-y-6 animate-in fade-in duration-700">
            {/* Product Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {resultItems.map(item => (
                <button key={item} onClick={() => setActiveItem(item)}
                  className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${activeItem === item ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:text-zinc-200'}`}
                  style={activeItem !== item ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' } : {}}>
                  {item}
                </button>
              ))}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Model Accuracy', value: m.mape_pct || 'N/A', sub: 'sMAPE score', accent: '#818cf8', icon: <ShieldCheck size={16}/> },
                { label: 'Avg Error (MAE)', value: `±${m.mae || 0}`, sub: 'units deviation', accent: '#71717a', icon: <Activity size={16}/> },
                { label: 'Stability (RMSE)', value: m.rmse || 0, sub: 'outlier sensitivity', accent: '#71717a', icon: <BarChart2 size={16}/> },
                { label: 'Avg Daily Forecast', value: `${avgFuture}`, sub: 'units / day', accent: '#a78bfa', icon: <TrendingUp size={16}/> },
              ].map(({ label, value, sub, accent, icon }) => (
                <div key={label} className="rounded-[2rem] p-6 relative overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="absolute top-3 right-3 opacity-20" style={{ color: accent }}>{icon}</div>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">{label}</p>
                  <p className="text-3xl font-black tracking-tighter" style={{ color: accent }}>{value}</p>
                  <p className="text-[9px] text-zinc-600 font-medium mt-2 uppercase">{sub}</p>
                </div>
              ))}
            </div>

            {/* Hero Chart + Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 rounded-[3rem] p-8" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-black text-white tracking-tight uppercase">Final Hybrid Forecast</h3>
                    <p className="text-xs text-zinc-500 font-medium mt-0.5">Last 30 days of actuals → future predictions with 80% confidence band</p>
                  </div>
                  <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-zinc-600">
                    <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 bg-zinc-600 inline-block rounded-full"/>Historical</span>
                    <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-indigo-400 inline-block"/>Forecast</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block opacity-50" style={{ background: 'rgba(99,102,241,0.4)' }}/>Confidence</span>
                  </div>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={filteredData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.04)"/>
                      <XAxis dataKey="forecast_date" axisLine={false} tickLine={false} tick={{ fill: '#52525b', fontSize: 9 }} dy={8} minTickGap={28}/>
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#52525b', fontSize: 10 }} dx={-4} width={40}/>
                      <Tooltip contentStyle={{ borderRadius: '16px', background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', color: '#f4f4f5', fontSize: 12 }}/>
                      <Area type="monotone" dataKey="yhat_upper" stroke="none" fill="url(#confGrad)" fillOpacity={1}/>
                      <Area type="monotone" dataKey="yhat_lower" stroke="none" fill="transparent" fillOpacity={1}/>
                      <Line type="monotone" dataKey="actual_quantity" name="Actual Sales" stroke="#3f3f46" strokeWidth={2.5} dot={false} connectNulls/>
                      <Line type="monotone" dataKey="predicted_quantity" name="Predicted" stroke="#6366f1" strokeWidth={3} strokeDasharray="6 3" dot={false} connectNulls/>
                      {futureData[0] && <ReferenceLine x={futureData[0].forecast_date} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" label={{ value: 'Forecast Start', fill: '#52525b', fontSize: 9 }}/>}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Insights */}
              <div className="rounded-[3rem] p-8 flex flex-col gap-4" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <p className="text-indigo-400 text-[9px] font-black uppercase tracking-[0.25em] flex items-center gap-2">
                  <Sparkles size={12}/> Optima Insights
                </p>
                <div className="flex-1 space-y-3">
                  <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Peak Forecast</p>
                    <p className="text-2xl font-black text-white">{peaks[0]?.predicted_quantity ?? 0} <span className="text-xs font-normal text-zinc-500">units</span></p>
                    <p className="text-[9px] text-zinc-600 mt-1">{peaks[0]?.forecast_date}</p>
                  </div>
                  <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">SARIMA Status</p>
                    <p className={`text-xs font-bold ${sarimaDir === 'boosting' ? 'text-emerald-400' : sarimaDir === 'dampening' ? 'text-rose-400' : 'text-zinc-500'}`}>
                      {sarimaDir === 'boosting' ? <ArrowUpRight size={11} className="inline mr-1"/> : sarimaDir === 'dampening' ? <ArrowDownRight size={11} className="inline mr-1"/> : <Minus size={11} className="inline mr-1"/>}
                      {sarimaDir === 'stable' ? 'Residuals stable · no correction' : `${sarima0 > 0 ? '+' : ''}${sarima0.toFixed(1)} units correction`}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <p className="text-[9px] text-indigo-400/70 font-black uppercase tracking-widest mb-1.5">Model Narrative</p>
                    <p className="text-indigo-200/70 text-[10px] font-medium leading-relaxed italic">
                      The shaded band shows an 80% confidence interval. Prophet captures the yearly structural trend; SARIMA corrects for short-term volatility.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Data Table + Audit */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 rounded-[3rem] p-8" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-base font-black text-white uppercase tracking-tight">Forecast Data Table</h3>
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-1.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>{filteredData.length} rows</span>
                </div>
                <div className="overflow-y-auto max-h-96 rounded-2xl custom-scrollbar" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                  <table className="w-full text-left">
                    <thead className="sticky top-0 z-10" style={{ background: 'rgba(18,18,20,0.95)', backdropFilter: 'blur(8px)' }}>
                      <tr>
                        {['Date','Type','Qty','CI Low','CI High','Event Δ'].map(h => (
                          <th key={h} className="px-4 py-3 text-[9px] font-black text-zinc-600 uppercase tracking-widest border-b"
                            style={{ borderColor: 'rgba(255,255,255,0.05)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.slice().reverse().map((row, i) => {
                        const qty = row.type === 'historical' ? row.actual_quantity : row.predicted_quantity;
                        const impact = row.holiday_effect;
                        return (
                          <tr key={i} className="border-b transition-colors hover:bg-white/[0.02]"
                            style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                            <td className="px-4 py-3 text-xs font-bold text-zinc-500 font-mono">{row.forecast_date}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-full ${row.type === 'historical' ? 'text-zinc-500' : 'text-indigo-400'}`}
                                style={row.type === 'historical' ? { background: 'rgba(255,255,255,0.06)' } : { background: 'rgba(99,102,241,0.15)' }}>
                                {row.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-black text-white">{qty}</td>
                            <td className="px-4 py-3 text-xs text-zinc-600">{row.yhat_lower != null ? Number(row.yhat_lower).toFixed(0) : '—'}</td>
                            <td className="px-4 py-3 text-xs text-zinc-600">{row.yhat_upper != null ? Number(row.yhat_upper).toFixed(0) : '—'}</td>
                            <td className="px-4 py-3">
                              {impact != null && impact !== 0
                                ? <span className={`font-bold text-xs ${impact > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{impact > 0 ? '+' : ''}{Number(impact).toFixed(1)}</span>
                                : <span className="text-zinc-700 text-xs">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Hybrid Audit */}
              <div className="rounded-[3rem] p-8 flex flex-col" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                  <Calendar size={12} className="text-indigo-400"/> Hybrid Audit
                </h4>
                <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1 max-h-80">
                  {holidays.length > 0 ? holidays.map((day, i) => {
                    const eff = day.holiday_effect ?? 0;
                    const isPos = eff > 0.1; const isNeg = eff < -0.1;
                    return (
                      <div key={i} className="p-3 rounded-2xl flex items-start gap-3"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className={`mt-0.5 w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0`}
                          style={{ background: isPos ? 'rgba(52,211,153,0.1)' : isNeg ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)' }}>
                          <Info size={11} className={isPos ? 'text-emerald-400' : isNeg ? 'text-rose-400' : 'text-zinc-500'}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-mono text-zinc-600">{day.forecast_date}</p>
                          <p className="text-[10px] font-black text-zinc-300 uppercase leading-tight">Event</p>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[8px] font-black ${isPos ? 'text-emerald-400' : isNeg ? 'text-rose-400' : 'text-zinc-600'}`}
                            style={isPos ? { background: 'rgba(52,211,153,0.1)' } : isNeg ? { background: 'rgba(239,68,68,0.1)' } : { background: 'rgba(255,255,255,0.05)' }}>
                            {isPos ? '+' : ''}{eff.toFixed(1)} units
                          </span>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="flex flex-col items-center justify-center h-40 text-zinc-700">
                      <Calendar size={36}/>
                      <p className="text-[9px] font-black uppercase mt-2 tracking-widest">Clear Horizon</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* SIGNAL DECOMPOSITION PANELS */}
            {(() => {
              const combined = filteredData.map(d => ({
                ...d,
                decomp_seasonal: ((d.decomp_weekly ?? 0) + (d.decomp_yearly ?? 0)),
              }));

              const panels = [
                {
                  label: 'DATA', sub: 'Raw observed + predicted signal', color: '#a1a1aa',
                  dataKey: d => d.type === 'historical' ? d.actual_quantity : d.predicted_quantity,
                  valueKey: 'actual_quantity',
                  render: (data) => (
                    <>
                      <Line type="monotone" dataKey="actual_quantity" name="Actual" stroke="#a1a1aa" strokeWidth={2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="predicted_quantity" name="Predicted" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls />
                    </>
                  )
                },
                {
                  label: 'TREND', sub: "Prophet's long-run baseline curve", color: '#818cf8',
                  render: () => (
                    <Line type="monotone" dataKey="decomp_trend" name="Trend" stroke="#818cf8" strokeWidth={2.5} dot={false} connectNulls />
                  )
                },
                {
                  label: 'SEASONAL', sub: 'Weekly + yearly rhythms extracted by Prophet', color: '#34d399',
                  render: () => (
                    <>
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                      <Bar dataKey="decomp_seasonal" name="Seasonal" fill="#34d399" fillOpacity={0.5} radius={[2,2,0,0]}>
                        {combined.map((entry, i) => (
                          <Cell key={i} fill={(entry.decomp_seasonal ?? 0) >= 0 ? '#34d399' : '#f87171'} fillOpacity={0.55} />
                        ))}
                      </Bar>
                    </>
                  )
                },
                {
                  label: 'REMAINDER', sub: 'SARIMA short-term corrections (residuals)', color: '#fb923c',
                  render: () => (
                    <>
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                      <Bar dataKey="sarima_pattern_correction" name="Residual" fill="#fb923c" fillOpacity={0.5} radius={[2,2,0,0]}>
                        {combined.map((entry, i) => (
                          <Cell key={i} fill={(entry.sarima_pattern_correction ?? 0) >= 0 ? '#fb923c' : '#f87171'} fillOpacity={0.6} />
                        ))}
                      </Bar>
                    </>
                  )
                },
              ];

              return (
                <div className="rounded-[3rem] overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <button
                    onClick={() => setShowDecomp(!showDecomp)}
                    className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/[0.02] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <BarChart2 size={18} className="text-indigo-400" />
                      <div className="text-left">
                        <h3 className="text-base font-black text-white uppercase tracking-tight">Signal Decomposition</h3>
                        <p className="text-xs text-zinc-500 font-medium mt-0.5">Trend · Seasonal · Remainder — breakdown of the hybrid model components</p>
                      </div>
                    </div>
                    {showDecomp ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
                  </button>

                  {showDecomp && (
                    <div className="px-8 pb-8 space-y-2 animate-in slide-in-from-top-2 duration-300" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      {panels.map(({ label, sub, color, render }) => (
                        <div key={label}>
                          <div className="flex items-baseline gap-3 pt-5 pb-2">
                            <span className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color, writingMode: 'horizontal-tb' }}>{label}</span>
                            <span className="text-[9px] text-zinc-600 font-medium">{sub}</span>
                          </div>
                          <div className="h-28">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={combined} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                <XAxis dataKey="forecast_date" axisLine={false} tickLine={false} tick={{ fill: '#3f3f46', fontSize: 8 }} dy={6} minTickGap={40} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#3f3f46', fontSize: 9 }} dx={-2} width={36} />
                                <Tooltip
                                  contentStyle={{ borderRadius: '12px', background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f4f5', fontSize: 11 }}
                                  labelStyle={{ color: '#71717a', fontSize: 10 }}
                                />
                                {render(combined)}
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

          </div>
        );
      })()}
    </div>
  );
}

