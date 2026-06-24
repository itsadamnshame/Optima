import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  TrendingUp, Clock, FileBarChart, PlayCircle, 
  Trash2, Search, ArrowLeft, Activity, Sparkles,
  Layers, Package, ChevronRight, AlertCircle, Info,
  Calendar, Maximize2, Download, Filter, BookOpen, ArrowRight
} from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, ComposedChart, Scatter, Bar
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Link } from 'react-router-dom';
import InfoTooltip from '../components/InfoTooltip';

// --- UI COMPONENTS ---

const Card = ({ children, className = "", title, subtitle, icon: Icon, action }) => (
  <div className={`rounded-[2rem] p-8 space-y-6 transition-all border ${className}`}
    style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
    {(title || Icon) && (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Icon && <div className="p-2 rounded-xl" style={{ background: 'var(--card-accent-bg)', color: 'var(--accent)' }}><Icon size={18} /></div>}
          <div>
            <h4 className="font-black text-sm uppercase tracking-tight" style={{ color: 'var(--text-heading)' }}>{title}</h4>
            {subtitle && <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
    )}
    {children}
  </div>
);

const Metric = ({ label, value, sub, trend }) => (
  <div className="space-y-1">
    <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{label}</p>
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-black tracking-tighter" style={{ color: 'var(--text-heading)' }}>{value}</span>
      {trend && <span className={`text-[10px] font-black ${trend > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
        {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
      </span>}
    </div>
    {sub && <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
  </div>
);

// --- MAIN PAGE ---

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
  // Persisted Config
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
  const { theme } = useTheme();
  
  // States
  const [recommendations, setRecommendations] = useState(existingMetrics?.recommendations || {});
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState(existingChart || []);
  const [metrics, setMetrics] = useState(existingMetrics || {});
  const [runs, setRuns] = useState([]);
  const [benchmarkYearOffset, setBenchmarkYearOffset] = useState(1);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runDetails, setRunDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  const [activeTab, setActiveTab] = useState('global'); 
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Get dynamic colors from CSS variables
  const getChartColors = () => {
    return {
      grid: 'var(--chart-grid)',
      axis: 'var(--chart-axis)',
      label: 'var(--chart-label)',
      actual: 'var(--chart-line-actual)',
      forecast: 'var(--chart-line-forecast)',
      area: 'var(--chart-area-fill)',
      tooltip: {
        bg: 'var(--chart-tooltip-bg)',
        border: 'var(--chart-tooltip-border)',
        text: 'var(--chart-tooltip-text)'
      }
    };
  };

  const chartColors = getChartColors();

  useEffect(() => {
    fetchRuns();
  }, [token]);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/forecast/runs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setRuns(res.data.runs || []);
    } catch (err) {
      console.error("Failed to fetch runs", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRun = async (run) => {
    setSelectedRun(run);
    setLoadingDetails(true);
    try {
      const res = await axios.get(`/api/forecast/runs/${run.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = res.data;
      setRunDetails(data);
      
      const items = Object.keys(data).filter(k => k !== 'GLOBAL_BASELINE');
      if (items.length > 0) setSelectedProduct(items[0]);
    } catch (err) {
      console.error("Failed to fetch run details", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDeleteRun = async (e, runId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this run?")) return;
    try {
      await axios.delete(`/api/forecast/runs/${runId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchRuns();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const formatMetric = (val, dec = 0) => {
    if (val === undefined || val === null || val === 'N/A') return 'N/A';
    const num = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(num) ? 'N/A' : num.toFixed(dec);
  };

  // --- DATA TRANSFORMS ---

  const getChartData = (itemKey) => {
    if (!runDetails || !runDetails[itemKey]) return [];
    const raw = runDetails[itemKey].data || [];
    return raw.map(d => {
      const act = d.actual_value ?? d.actual_quantity ?? null;
      const fcast = d.predicted_value ?? d.predicted_quantity ?? null;
      return {
        ...d,
        date: d.forecast_date ? new Date(d.forecast_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '',
        timestamp: d.forecast_date,
        actual: act !== null ? Math.round(act) : null,
        forecast: fcast !== null ? Math.round(fcast) : null,
        lower: d.yhat_lower !== null && d.yhat_lower !== undefined ? Math.round(d.yhat_lower) : null,
        upper: d.yhat_upper !== null && d.yhat_upper !== undefined ? Math.round(d.yhat_upper) : null
      };
    });
  };

  const getMonthlyData = (fullData) => {
    const firstForecastIdx = fullData.findIndex(d => d.actual === null || d.actual === undefined);
    if (firstForecastIdx === -1) return [];
    // Take 4 points around the transition for context
    return fullData.slice(Math.max(0, firstForecastIdx - 2), firstForecastIdx + 4);
  };

  const getYoYData = (fullData, offset) => {
    const firstForecastIdx = fullData.findIndex(d => d.actual === null || d.actual === undefined);
    if (firstForecastIdx === -1) return null;
    
    const current = fullData[firstForecastIdx];
    if (!current || !current.timestamp) return null;

    const currentDate = new Date(current.timestamp);
    const targetDate = new Date(currentDate);
    targetDate.setFullYear(currentDate.getFullYear() - offset);

    // Find the closest historical match
    const match = fullData.find(d => {
      if (!d.timestamp || d.actual === null || d.actual === undefined) return false;
      const dDate = new Date(d.timestamp);
      return dDate.getMonth() === targetDate.getMonth() && dDate.getFullYear() === targetDate.getFullYear();
    });

    if (!match) return null;

    return {
      current: { label: 'Forecast', value: current.forecast, date: current.date },
      previous: { label: `${offset}Y Ago`, value: match.actual, date: match.date },
      diff: match.actual !== 0 ? ((current.forecast - match.actual) / match.actual) * 100 : 0
    };
  };

  const getYoYChartData = (fullData, offset) => {
    const firstForecastIdx = fullData.findIndex(d => d.actual === null || d.actual === undefined);
    if (firstForecastIdx === -1) return null;
    
    const startIdx = firstForecastIdx;
    const endIdx = fullData.length;
    
    const slice = fullData.slice(startIdx, endIdx);
    
    return slice.map(currentPoint => {
      const currentDate = new Date(currentPoint.timestamp);
      const targetDate = new Date(currentDate);
      targetDate.setFullYear(currentDate.getFullYear() - offset);
      
      const match = fullData.find(d => {
        if (!d.timestamp || d.actual === null || d.actual === undefined) return false;
        const dDate = new Date(d.timestamp);
        return dDate.getMonth() === targetDate.getMonth() && dDate.getFullYear() === targetDate.getFullYear();
      });

      return {
        displayDate: currentPoint.date,
        current: currentPoint.forecast !== null && currentPoint.forecast !== undefined ? currentPoint.forecast : currentPoint.actual,
        historical: match ? match.actual : null,
        benchmarkYear: targetDate.getFullYear(),
      };
    });
  };

  const filteredItems = useMemo(() => {
    if (!runDetails) return [];
    return Object.keys(runDetails)
      .filter(k => k !== 'GLOBAL_BASELINE')
      .filter(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [runDetails, searchQuery]);

  // --- RENDERERS ---

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-8 animate-in fade-in zoom-in-95 duration-700">
        <div className="relative">
          <div className="absolute inset-0 blur-3xl rounded-full animate-pulse" style={{ background: 'var(--accent-glow)', opacity: 0.2 }} />
          <div className="relative w-32 h-32 rounded-full border-4 flex items-center justify-center" style={{ borderColor: 'var(--border-subtle)' }}>
            <Brain size={48} className="animate-bounce" style={{ color: 'var(--accent)' }} />
            <div className="absolute inset-0 rounded-full border-t-4 animate-spin" style={{ borderColor: 'var(--accent)' }} />
          </div>
        </div>
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-3xl font-black tracking-tighter uppercase italic" style={{ color: 'var(--text-heading)' }}>Synthesizing Models</h2>
          <div className="w-full h-2 rounded-full overflow-hidden border" style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)' }}>
            <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: 'var(--accent)', boxShadow: '0 0 15px var(--accent-glow)' }} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>
            Processing Active Dataset — {Math.round(progress)}%
          </p>
          <p className="text-xs font-medium italic" style={{ color: 'var(--text-secondary)' }}>
            The hybrid model is currently aligning historical seasonal signals with trend-loess decomposition. This may take a moment.
          </p>
        </div>
      </div>
    );
  }

  if (selectedRun && runDetails) {
    const currentItem = activeTab === 'global' ? 'GLOBAL_BASELINE' : selectedProduct;
    const chartData = getChartData(currentItem);
    const monthlyData = getMonthlyData(chartData);
    const meta = runDetails[currentItem]?.meta || {};
    const metrics = meta.metrics || {};
    const stl = metrics.stl && metrics.stl.dates ? metrics.stl : null;
    const tags = metrics.tags || [];

    const getAvailableHistoricalYears = (data) => {
      if (!data || data.length === 0) return [1, 2, 3];
      const firstActual = data.find(d => d.actual !== null && d.actual !== undefined);
      const firstForecast = data.find(d => d.actual === null || d.actual === undefined);
      if (!firstActual || !firstForecast || !firstActual.timestamp || !firstForecast.timestamp) return [1, 2, 3];
      
      const startYear = new Date(firstActual.timestamp).getFullYear();
      const endYear = new Date(firstForecast.timestamp).getFullYear();
      const diff = endYear - startYear;
      
      if (diff <= 0) return [1];
      return Array.from({ length: Math.min(diff, 10) }, (_, i) => i + 1);
    };

    const historicalYears = getAvailableHistoricalYears(chartData);
    const yoy = getYoYData(chartData, Math.min(benchmarkYearOffset, historicalYears.length || 1));
    const yoyChartData = getYoYChartData(chartData, Math.min(benchmarkYearOffset, historicalYears.length || 1));
    const benchmarkYear = yoyChartData && yoyChartData.length > 0 ? yoyChartData[0].benchmarkYear : `${benchmarkYearOffset}Y Ago`;
    
    const metricLabel = 'Volume';

    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-20">
        {/* RUN HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedRun(null)}
              className="p-3 rounded-2xl transition-all"
              style={{ background: 'var(--input-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
                <Clock size={12} /> {new Date(selectedRun.created_at).toLocaleDateString()} Run
              </div>
              <h2 className="text-3xl font-black tracking-tighter" style={{ color: 'var(--text-heading)' }}>{selectedRun.name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1 rounded-2xl border" style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)' }}>
            <button 
              onClick={() => setActiveTab('global')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'global' ? 'text-white shadow-lg' : ''}`}
              style={{ background: activeTab === 'global' ? 'var(--accent)' : 'transparent', color: activeTab === 'global' ? '#fff' : 'var(--text-faint)', boxShadow: activeTab === 'global' ? '0 10px 15px -3px var(--accent-glow)' : 'none' }}
            >
              <Layers size={14} className="inline mr-2" /> Global Strategy
            </button>
            <button 
              onClick={() => setActiveTab('product')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'product' ? 'text-white shadow-lg' : ''}`}
              style={{ background: activeTab === 'product' ? 'var(--accent)' : 'transparent', color: activeTab === 'product' ? '#fff' : 'var(--text-faint)', boxShadow: activeTab === 'product' ? '0 10px 15px -3px var(--accent-glow)' : 'none' }}
            >
              <Package size={14} className="inline mr-2" /> Product Analysis
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* SIDEBAR */}
          {activeTab === 'product' && (
            <div className="lg:col-span-1 space-y-4 sticky top-4 self-start">
              <Card title="Product Library" subtitle={`${filteredItems.length} active items`}>
                <div className="relative">
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
                  <input 
                    type="text" 
                    placeholder="Search catalog..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-2xl pl-10 pr-4 py-3 text-xs font-bold outline-none transition-all"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--input-text)' }}
                  />
                </div>
                <div className="space-y-1 mt-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredItems.map(item => (
                    <button 
                      key={item}
                      onClick={() => setSelectedProduct(item)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${selectedProduct === item ? 'shadow-sm' : 'hover:opacity-70'}`}
                      style={{ 
                        background: selectedProduct === item ? 'var(--card-accent-bg)' : 'transparent',
                        border: `1px solid ${selectedProduct === item ? 'var(--accent)' : 'transparent'}`,
                        color: selectedProduct === item ? 'var(--text-primary)' : 'var(--text-muted)'
                      }}
                    >
                      <span className="text-[11px] font-bold truncate uppercase">{item}</span>
                      {selectedProduct === item && <ChevronRight size={14} style={{ color: 'var(--accent)' }} />}
                    </button>
                  ))}
                </div>
              </Card>

            </div>
          )}

          {/* MAIN CHARTS */}
          <div className={activeTab === 'product' ? "lg:col-span-3 space-y-8" : "lg:col-span-4 space-y-8"}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl" style={{ background: 'var(--card-accent-bg)', color: 'var(--accent)' }}>
                  <Calendar size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight" style={{ color: 'var(--text-heading)' }}>
                    {activeTab === 'global' ? 'Store-Wide Outlook' : 'Item Strategy Hub'}
                  </h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>12-Month Forecast Horizon</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {metrics.mape_pct !== undefined && (
                  <div className="flex flex-wrap gap-4">
                    <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5">
                      <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1">Error Percentage <InfoTooltip term="MAPE" size={10} side="bottom" /></p>
                      <p className="text-sm font-bold text-white">{formatMetric(metrics.mape_pct, 1)}% <span className="text-[10px] text-zinc-500 ml-1">MAPE</span></p>
                    </div>
                    <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5">
                      <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1">Avg. Error Magnitude <InfoTooltip term="MAE" size={10} side="bottom" /></p>
                      <p className="text-sm font-bold text-white">{formatMetric(metrics.mae, 2)} <span className="text-[10px] text-zinc-500 ml-1">MAE</span></p>
                    </div>
                    <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5">
                      <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1">Peak Error Sensitivity <InfoTooltip term="RMSE" size={10} side="bottom" /></p>
                      <p className="text-sm font-bold text-white">{formatMetric(metrics.rmse, 2)} <span className="text-[10px] text-zinc-500 ml-1">RMSE</span></p>
                    </div>
                    <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5">
                      <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1">Model Health <InfoTooltip term={metrics.is_zombie ? "Stagnant Trend" : "Healthy Trend"} size={10} side="bottom" /></p>
                      <p className="text-sm font-bold text-white flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${metrics.is_zombie ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        {metrics.is_zombie ? 'STAGNANT' : 'HEALTHY'}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <span key={tag} className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest"
                      style={{ background: 'var(--card-accent-bg)', border: '1px solid var(--border-subtle)', color: 'var(--accent)' }}>
                      {tag}
                    </span>
                  ))}
                  {metrics.is_zombie && (
                    <span className="px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                      <AlertCircle size={12} /> Stagnant Trend
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* YEARLY VIEW */}
            <Card title="Yearly Outlook" subtitle="12-Month Forecast Horizon" icon={TrendingUp}>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <defs>
                      <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors.forecast} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={chartColors.forecast} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: chartColors.axis, fontSize: 10, fontWeight: 700}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: chartColors.axis, fontSize: 10, fontWeight: 700}} />
                    <Tooltip 
                      contentStyle={{ 
                        background: chartColors.tooltip.bg, 
                        border: `1px solid ${chartColors.tooltip.border}`, 
                        borderRadius: '16px', 
                        fontSize: '11px',
                        color: chartColors.tooltip.text,
                        fontWeight: 'bold'
                      }} 
                      itemStyle={{ color: chartColors.tooltip.text }}
                      labelStyle={{ color: chartColors.label, marginBottom: '4px' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: chartColors.label }} />
                    <Area type="monotone" dataKey="upper" baseValue="lower" stroke={chartColors.forecast} strokeWidth={0.5} fill={chartColors.area} connectNulls name="Confidence Range" />
                    <Line type="monotone" dataKey="forecast" stroke={chartColors.forecast} strokeWidth={4} dot={false} connectNulls name={`Predicted ${metricLabel}`} />
                    <Line type="monotone" dataKey="actual" stroke={chartColors.actual} strokeWidth={4} dot={{ r: 5, fill: chartColors.actual }} connectNulls name={`Actual ${metricLabel}`} />
                    <ReferenceLine x={chartData.find(d => d.actual === null || d.actual === undefined)?.date} stroke={chartColors.forecast} strokeDasharray="3 3" label={{ value: 'PREDICTION', position: 'insideTopRight', fill: chartColors.forecast, fontSize: 8, fontWeight: 900 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* STRATEGIC BENCHMARKING */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card 
                title="Strategic Benchmarking" 
                subtitle="Historical YoY Performance" 
                className="md:col-span-2" 
                icon={TrendingUp}
                action={
                  <div className="flex bg-[var(--input-bg)] rounded-xl p-1 border border-[var(--border-subtle)] overflow-x-auto max-w-[200px] sm:max-w-none no-scrollbar">
                    {historicalYears.map(yr => (
                      <button
                        key={yr}
                        onClick={() => setBenchmarkYearOffset(yr)}
                        className={`px-3 py-1 text-[9px] font-black rounded-lg transition-all ${benchmarkYearOffset === yr ? 'text-white shadow-sm' : 'text-[var(--text-faint)]'}`}
                        style={{ background: benchmarkYearOffset === yr ? 'var(--accent)' : 'transparent' }}
                      >
                        {yr}Y
                      </button>
                    ))}
                  </div>
                }
              >
                <div className="h-[410px] w-full flex flex-col items-stretch justify-between">
                  {yoy ? (
                    <div className="w-full h-full flex flex-col justify-between">
                      <div className="flex-1 w-full pb-4 pt-4 min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={yoyChartData} margin={{ top: 10, right: 10, left: 24, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                            <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 9, fontWeight: 700}} interval={1} height={20} />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip 
                              formatter={(value, name) => [formatMetric(value), name]}
                              contentStyle={{ background: chartColors.tooltip.bg, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: '12px', fontSize: '9px', padding: '8px' }}
                              itemStyle={{ color: chartColors.tooltip.text, padding: 0 }}
                              cursor={{ stroke: 'rgba(99,102,241,0.2)', strokeWidth: 1 }}
                            />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: chartColors.label }} />
                            <Line type="monotone" name={`${benchmarkYear} (Actual)`} dataKey="historical" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
                            <Line type="monotone" name="Current / Forecast" dataKey="current" stroke="var(--accent)" strokeWidth={3} dot={false} connectNulls />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="p-4 rounded-2xl flex flex-col gap-3 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                        <div className="flex items-center justify-between px-2">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>{yoy.previous.label}</p>
                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatMetric(yoy.previous.value)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>vs</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>{yoy.current.label}</p>
                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatMetric(yoy.current.value)}</p>
                          </div>
                        </div>

                        <div className="h-[1px] w-full" style={{ background: 'var(--border-subtle)' }} />

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>Delta Variance</p>
                            <div className="flex items-baseline gap-2">
                              <p className={`text-xl font-black ${yoy.diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {yoy.diff >= 0 ? '+' : ''}{Number(yoy.diff || 0).toFixed(1)}%
                              </p>
                              <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-faint)' }}>
                                ({yoy.diff >= 0 ? '+' : ''}{formatMetric(yoy.current.value - yoy.previous.value)} units)
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>Analysis</p>
                            <p className="text-xs font-bold uppercase italic" style={{ color: 'var(--text-primary)' }}>
                              {yoy.diff >= 0 ? 'Exceeding Baseline' : 'Underperforming'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-3 opacity-50">
                      <AlertCircle size={32} className="mx-auto text-[var(--text-faint)]" />
                      <p className="text-xs font-bold uppercase tracking-widest">Insufficient Historical Depth</p>
                      <p className="text-[10px] max-w-[200px]">We need at least {benchmarkYearOffset} years of prior data to generate this benchmark.</p>
                    </div>
                  )}
                </div>
              </Card>

              <Card title="Trend Forecast" subtitle="What to expect" icon={Layers} className="self-start">
                <div className="space-y-4 pt-2">
                  <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                    <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>Status</p>
                    <p className="text-xs font-bold uppercase tracking-tight flex items-center gap-2 mb-3" style={{ color: 'var(--text-primary)' }}>
                      <div className={`w-2 h-2 rounded-full ${metrics.trend_status === 'STAGNANT' || metrics.trend_status === 'DECLINE' ? 'bg-rose-500' : metrics.trend_status === 'GROWTH' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                      {metrics.trend_status || (metrics.is_zombie ? 'STAGNANT' : 'UNKNOWN')}
                    </p>
                    <p className="text-[10px] leading-relaxed font-medium" style={{ color: 'var(--text-muted)' }}>
                      {metrics.story || "Forecast insights are unavailable for this run."}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                    <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>Data History</p>
                    <p className="text-xs font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Sufficient</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* STRATEGIC STL HUB */}
            {stl && stl.dates && (
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3 px-4">
                  <div className="p-2 rounded-xl" style={{ background: 'var(--card-accent-bg)', color: 'var(--accent)' }}><Layers size={20} /></div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight" style={{ color: 'var(--text-heading)' }}>Strategic STL Hub</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Seasonal-Trend-Loess Decomposition</p>
                  </div>
                </div>

                <Card className="!p-4 overflow-hidden border-indigo-500/10">
                  <div className="space-y-1">
                    {['observed', 'trend', 'seasonal', 'remainder'].map((component, idx) => (
                      <div key={component} className="relative group">
                        <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
                          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{component}</span>
                        </div>
                        <div className="h-32 w-full bg-white/[0.02] rounded-xl relative">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={stl.dates.map((d, i) => ({
                              date: d,
                              val: stl[component][i]
                            }))} margin={{ top: 15, right: 15, left: 15, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="0" stroke={chartColors.grid} vertical={true} />
                              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: chartColors.axis, fontSize: 8}} />
                              <YAxis hide domain={['auto', 'auto']} />
                              <Tooltip 
                                contentStyle={{ background: chartColors.tooltip.bg, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: '12px', fontSize: '9px', padding: '8px' }}
                                itemStyle={{ color: chartColors.tooltip.text, padding: 0 }}
                                cursor={{ stroke: 'rgba(99,102,241,0.2)', strokeWidth: 1 }}
                              />
                              {component === 'remainder' ? (
                                <>
                                  <ReferenceLine y={0} stroke={chartColors.axis} strokeWidth={1} />
                                  <Scatter 
                                    dataKey="val" 
                                    fill="#f59e0b"
                                  />
                                </>
                              ) : (
                                <Area 
                                  type="monotone" 
                                  dataKey="val" 
                                  stroke={component === 'observed' ? chartColors.actual : chartColors.forecast} 
                                  fill={component === 'observed' ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.05)'} 
                                  strokeWidth={2} 
                                  fillOpacity={1}
                                />
                              )}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                        {idx !== 3 && <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-white/5" />}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- RUN BROWSER ---
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="relative rounded-[2.5rem] p-10 overflow-hidden" 
        style={{ background: 'var(--gradient-hero)', border: `1px solid var(--glass-border)` }}>
        <div className="relative z-10">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-2 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: 'var(--accent)' }} />
            Audit Repository
          </p>
          <h2 className="text-4xl font-black tracking-tight flex items-center gap-3" style={{ color: 'var(--text-heading)' }}>
            <TrendingUp size={36} style={{ color: 'var(--accent)' }} /> Analytics Vault
          </h2>
          <p className="text-sm font-medium mt-2 ml-1" style={{ color: 'var(--text-muted)' }}>
            Persisted 12-month hybrid models and strategic audit trails.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center space-y-4">
            <Activity className="animate-spin" size={40} style={{ color: 'var(--accent)' }} />
            <p className="font-bold uppercase tracking-widest text-xs" style={{ color: 'var(--text-faint)' }}>Accessing Models...</p>
          </div>
        ) : runs.length > 0 ? (
          runs.map(run => (
            <div key={run.id} 
              onClick={() => handleOpenRun(run)}
              className="group relative rounded-[2.5rem] p-8 space-y-4 transition-all hover:scale-[1.02] cursor-pointer hover:border-indigo-500/50"
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl" style={{ background: 'var(--card-accent-bg)', color: 'var(--accent)' }}>
                  <FileBarChart size={24} />
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-faint)' }}>
                  <Clock size={12} /> {new Date(run.created_at).toLocaleDateString()}
                </div>
              </div>
              <div>
                <h4 className="text-xl font-black tracking-tighter transition-colors" style={{ color: 'var(--text-heading)' }}>{run.name}</h4>
                <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-faint)' }}>
                  Horizon: 12 Months • {run.config?.item_count || 0} Products
                </p>
              </div>
              <div className="pt-4 flex items-center gap-3">
                <div className="flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                  style={{ background: 'var(--card-accent-bg)', border: '1px solid var(--border-subtle)', color: 'var(--accent)' }}>
                  {loadingDetails && selectedRun?.id === run.id ? (
                    <><Activity size={14} className="animate-spin" /> Loading...</>
                  ) : (
                    <><PlayCircle size={14} /> Open Result</>
                  )}
                </div>
                <button 
                  onClick={(e) => handleDeleteRun(e, run.id)}
                  className="p-3 rounded-xl transition-all border"
                  style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-faint)' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center space-y-5"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--glass-bg)' }}>
            <div className="p-5 rounded-full" style={{ background: 'var(--input-bg)', color: 'var(--text-faint)' }}>
              <Search size={40} />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-black uppercase italic" style={{ color: 'var(--text-heading)' }}>No saved runs found</h3>
              <p className="text-sm mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>Head to the Management Hub to train your first forecast model. Once complete, your results will appear here.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:opacity-80" style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 8px 20px -4px var(--accent-glow)' }}>
                Go to Management Hub <ArrowRight size={13} />
              </Link>
              <Link to="/help" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all hover:opacity-80" style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                <BookOpen size={13} /> Help Center
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
