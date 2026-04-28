import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Loader2, Activity, Calendar, AlertTriangle, 
  Zap, Info, TrendingUp, ShieldCheck, CheckSquare, 
  ListOrdered, Filter, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ComposedChart, Area, Line 
} from 'recharts';

import SpecialDaysManager from '../components/SpecialDaysManager';
import { useAuth } from '../contexts/AuthContext';

export default function Analytics({ 
  setGlobalRecommendations, 
  setGlobalLoading, 
  setPersistedChart, 
  setPersistedMetrics, 
  setLastForecastTime,
  existingChart,
  existingMetrics 
}) {
  const { token } = useAuth();
  // 1. Initialize local state with existing data from the Global Vault
  const [chartData, setChartData] = useState(existingChart || []);
  const [performanceMetrics, setPerformanceMetrics] = useState(existingMetrics || {});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [calendarEvents, setCalendarEvents] = useState([]);

  // Selection States
  const [selectionMode, setSelectionMode] = useState('top'); 
  const [topN, setTopN] = useState(5);
  const [availableItems, setAvailableItems] = useState([]);
  const [selectedManualItems, setSelectedManualItems] = useState([]);
  const [endDate, setEndDate] = useState('');
  
  // If we have data already, we might want to hide filters by default
  const [showFilters, setShowFilters] = useState(chartData.length === 0);

  const fetchCalendar = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/get-events');
      setCalendarEvents(res.data.events || []);
    } catch (err) {
      console.error("Calendar sync failed");
    }
  };

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await axios.get('http://localhost:8000/api/get-items');
        setAvailableItems(res.data.items || []);
      } catch (err) { console.error(err); }
    };
    fetchItems();
    fetchCalendar();
  }, []);

  const runSpecialistAnalysis = async () => {
    if (!endDate) {
      setError("Please select a target end date.");
      return;
    }
    if (selectionMode === 'manual' && selectedManualItems.length === 0) {
      setError("Please select at least one item.");
      return;
    }
    
    setIsGenerating(true);
    if (setGlobalLoading) setGlobalLoading(true);
    setError('');
    
    try {
      const response = await axios.get('http://localhost:8000/api/generate-recommendations', {
        params: { 
          end_date: endDate,
          mode: selectionMode,
          top_n: topN,
          selected_items: selectedManualItems.join(',')
        },
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = response.data.chart_data;
      const metrics = response.data.performance_metrics;
      const recs = response.data.recommendations;

      // Update Local State
      setChartData(data);
      setPerformanceMetrics(metrics);

      // UPDATE GLOBAL VAULT (Persists across page switches)
      setPersistedChart(data);
      setPersistedMetrics(metrics);
      setGlobalRecommendations(recs);
      setLastForecastTime(new Date().getTime()); // Start the 10-minute timer
      
      setShowFilters(false); 
    } catch (err) {
      setError("Analysis failed. Check your connection or date range.");
    } finally {
      setIsGenerating(false);
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

  const resultItems = [...new Set(chartData.map(d => d.item_description))];
  const [activeItem, setActiveItem] = useState('');

  useEffect(() => {
    if (resultItems.length > 0 && !activeItem) setActiveItem(resultItems[0]);
  }, [resultItems, activeItem]);

  const filteredData = chartData.filter(d => d.item_description === activeItem);
  const peaks = [...filteredData].sort((a, b) => b.predicted_quantity - a.predicted_quantity).slice(0, 3);
  const holidays = filteredData.filter(d => d.special_day_detected === 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            <TrendingUp className="text-indigo-600" size={40} />
            Quantitative Specialist
          </h2>
          <p className="text-slate-500 font-medium ml-12 italic">
            Hybrid Analytical Engine: Macro (Prophet) + Micro (SARIMA) Forecasting.
          </p>
        </div>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-all px-5 py-3 bg-white rounded-2xl border border-slate-200 shadow-sm"
        >
          <Filter size={16} />
          {showFilters ? 'Minimize Config' : 'Adjust Parameters'}
          {showFilters ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </button>
      </div>

      {/* 1. CONFIGURATION BLOCK */}
      {showFilters && (
        <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Mode Selection */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Forecast Mode</label>
              <div className="space-y-3">
                <button onClick={() => setSelectionMode('top')} className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${selectionMode === 'top' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>
                  <ListOrdered size={20} /><span className="font-bold text-sm text-center">Top Velocity Items</span>
                </button>
                <button onClick={() => setSelectionMode('manual')} className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${selectionMode === 'manual' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>
                  <CheckSquare size={20} /><span className="font-bold text-sm text-center">Manual SKU Selection</span>
                </button>
              </div>
            </div>

            {/* Scope & Date */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Scope & Horizon</label>
              {selectionMode === 'top' ? (
                <div className="py-2">
                  <input type="range" min="3" max="10" value={topN} onChange={(e) => setTopN(parseInt(e.target.value))} className="w-full h-2 bg-slate-100 rounded-lg accent-indigo-600 mb-2" />
                  <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest italic font-black">Analyzing Top {topN} Products</p>
                </div>
              ) : (
                <div className="h-28 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
                  {availableItems.map(item => (
                    <label key={item} className="flex items-center gap-3 p-1 hover:bg-slate-50 rounded-lg cursor-pointer">
                      <input type="checkbox" checked={selectedManualItems.includes(item)} onChange={() => handleManualToggle(item)} className="rounded text-indigo-600" />
                      <span className="text-[10px] font-bold text-slate-600 truncate uppercase">{item}</span>
                    </label>
                  ))}
                </div>
              )}
              <input type="date" className="w-full border-slate-200 rounded-xl py-2.5 px-4 text-sm font-bold text-slate-600" onChange={(e) => setEndDate(e.target.value)} />
            </div>

            {/* Execute Button */}
            <div className="bg-indigo-600 p-6 rounded-3xl shadow-xl shadow-indigo-100 flex flex-col justify-center items-center text-center space-y-4">
               <div className="bg-indigo-500 p-3 rounded-full text-white animate-pulse"><Sparkles size={24}/></div>
               <div>
                  <h4 className="text-white font-black text-lg uppercase tracking-tight italic">Ready for Audit?</h4>
                  <p className="text-indigo-200 text-[10px] font-medium leading-relaxed px-4">Reconciling Trends with {calendarEvents.length} Calendar Disruptions.</p>
               </div>
               <button onClick={runSpecialistAnalysis} disabled={isGenerating} className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20">
                  {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                  GENERATE SPECIALIST AUDIT
               </button>
            </div>
          </div>

          {/* Calendar Logic Monitor */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> 
            <SpecialDaysManager onUpdate={fetchCalendar} />

            <div className="sticky top-6">
              <div className="bg-slate-900 p-10 rounded-[3rem] flex flex-col justify-between border-l-[12px] border-indigo-500 shadow-2xl relative overflow-hidden group h-[550px]">
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700"></div>

                <div className="relative z-10">
                    <p className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.3em] mb-8 flex items-center gap-3 italic">
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]"></div>
                      Engine Status: Listener Active
                    </p>
                    
                    <h3 className="text-white text-4xl font-black leading-[1.1] tracking-tighter uppercase italic">
                      Hybrid Specialist <br/>Context.
                    </h3>
                    
                    <div className="mt-12 grid grid-cols-2 gap-6">
                      <div className="bg-slate-800/40 p-6 rounded-[2rem] border border-slate-700/50 backdrop-blur-md">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Calendar Load</p>
                          <p className="text-3xl font-black text-white italic">{calendarEvents.length} <span className="text-xs font-normal text-slate-500">Days</span></p>
                      </div>
                      <div className="bg-slate-800/40 p-6 rounded-[2rem] border border-slate-700/50 backdrop-blur-md">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Impact Level</p>
                          <p className="text-3xl font-black text-emerald-400 italic">High</p>
                      </div>
                    </div>
                </div>

                <div className="relative z-10 mt-12">
                    <div className="p-6 bg-indigo-600/10 rounded-3xl border border-indigo-500/20 backdrop-blur-sm">
                      <p className="text-indigo-200 text-xs font-bold italic leading-relaxed text-center">
                        "Prophet will treat these {calendarEvents.length} entries as structural breaks, adjusting trends to neutralize holiday variance in core calculations."
                      </p>
                    </div>
                    <div className="flex justify-between items-center mt-6 px-2">
                      <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest italic">Protocol v1.4</p>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-600 p-5 rounded-2xl flex items-center gap-4 text-sm font-black"><AlertTriangle size={24} />{error}</div>}

      {/* 2. RESULTS SECTION (PERSISTENT) */}
      {filteredData.length > 0 && (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700 pt-8 border-t border-slate-100">
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
            {resultItems.map(item => (
              <button key={item} onClick={() => setActiveItem(item)} className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeItem === item ? 'bg-indigo-600 text-white shadow-xl -translate-y-1' : 'bg-white text-slate-400 border border-slate-100 hover:border-indigo-200'}`}>{item}</button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 relative overflow-hidden group shadow-sm">
               <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><ShieldCheck size={80}/></div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Model Accuracy (MAPE)</p>
               <h3 className="text-5xl font-black text-indigo-600 tracking-tighter">{performanceMetrics[activeItem]?.mape_pct || "N/A"}</h3>
               <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase italic">Verified Reliability Fit</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-sm">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Avg Error (MAE)</p>
               <h3 className="text-5xl font-black text-slate-800 tracking-tighter">±{performanceMetrics[activeItem]?.mae || "0"}</h3>
               <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase italic">Units Deviation Factor</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-sm">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Stability (RMSE)</p>
               <h3 className="text-5xl font-black text-slate-800 tracking-tighter">{performanceMetrics[activeItem]?.rmse || "0"}</h3>
               <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase italic">Outlier Sensitivity Score</p>
            </div>
          </div>

          <div className="space-y-10">
            {/* MICRO CHART */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start mb-8">
                  <div><h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">SARIMA Component</h3><p className="text-sm text-slate-500 font-medium italic">High-Frequency Micro-Patterns (The Seasonal Heartbeat).</p></div>
                  <div className="px-4 py-2 bg-blue-50 text-blue-600 text-[10px] font-black rounded-xl uppercase tracking-widest text-center">Micro-Specialist</div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={filteredData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="forecast_date" hide />
                      <YAxis stroke="#cbd5e1" fontSize={11} fontWeight="bold" />
                      <Tooltip cursor={{stroke: '#e2e8f0'}} contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)' }} />
                      <Area type="monotone" dataKey="sarima_pattern_correction" name="Seasonal Offset" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth={4} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-slate-900 p-8 rounded-[3rem] text-white flex flex-col shadow-xl">
                <h4 className="font-black text-indigo-400 text-[10px] uppercase mb-8 tracking-[0.2em] flex items-center gap-2 italic"><Activity size={16} /> Pattern Peaks</h4>
                <div className="space-y-8 flex-1">
                  {peaks.map((day, i) => (
                    <div key={i} className="border-l-2 border-slate-800 pl-4">
                        <p className="text-[10px] text-slate-500 font-mono mb-1">{day.forecast_date}</p>
                        <p className="text-3xl font-black text-white italic">{day.predicted_quantity} <span className="text-[11px] font-normal text-slate-500 tracking-widest uppercase">Units</span></p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* MACRO CHART */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start mb-8">
                  <div><h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Prophet Component</h3><p className="text-sm text-slate-500 font-medium italic">Low-Frequency Structural Shifts (The Yearly Trend Skeleton).</p></div>
                  <div className="px-4 py-2 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-xl uppercase tracking-widest text-center">Macro-Specialist</div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={filteredData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="forecast_date" fontSize={10} tickMargin={10} fontWeight="bold" stroke="#cbd5e1" />
                      <YAxis stroke="#cbd5e1" fontSize={11} fontWeight="bold" />
                      <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)' }} />
                      <Line type="monotone" dataKey="prophet_trend" name="Core Trend" stroke="#6366f1" strokeWidth={6} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 flex flex-col shadow-sm">
                <h4 className="font-black text-slate-400 text-[10px] uppercase mb-6 tracking-[0.2em] flex items-center gap-2 italic"><Calendar size={16} className="text-indigo-500" /> Hybrid Audit</h4>
                <div className="space-y-4 h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                  {holidays.length > 0 ? holidays.map((day, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100">
                      <div className="bg-white p-2 rounded-xl text-indigo-500 shadow-sm"><Info size={16} /></div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400">{day.forecast_date}</p>
                        <p className="text-[11px] font-black text-slate-900 uppercase leading-tight tracking-tighter">Event Detected</p>
                      </div>
                    </div>
                  )) : <div className="text-center h-40 flex flex-col justify-center opacity-20 text-center"><Calendar size={48} className="mx-auto" /><p className="text-[10px] font-black uppercase mt-2 italic">Clear Horizon</p></div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}