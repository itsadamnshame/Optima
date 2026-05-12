import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  TrendingUp, Clock, FileBarChart, PlayCircle, 
  Trash2, Search, ArrowLeft, Activity, Sparkles,
  Layers, Package, ChevronRight, AlertCircle, Info,
  Calendar, Maximize2, Download, Filter
} from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, ComposedChart, Scatter, Bar
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

// --- UI COMPONENTS ---

const Card = ({ children, className = "", title, subtitle, icon: Icon, action }) => (
  <div className={`rounded-[2rem] p-8 space-y-6 transition-all border ${className}`}
    style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
    {(title || Icon) && (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Icon && <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400"><Icon size={18} /></div>}
          <div>
            <h4 className="text-white font-black text-sm uppercase tracking-tight">{title}</h4>
            {subtitle && <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{subtitle}</p>}
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
    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{label}</p>
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-black text-white tracking-tighter">{value}</span>
      {trend && <span className={`text-[10px] font-black ${trend > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
        {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
      </span>}
    </div>
    {sub && <p className="text-[10px] text-zinc-600 font-bold">{sub}</p>}
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
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState(existingChart || []);
  const [metrics, setMetrics] = useState(existingMetrics || {});
  
  const [runs, setRuns] = useState([]);
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

  // --- DATA TRANSFORMS ---

  const getChartData = (itemKey) => {
    if (!runDetails || !runDetails[itemKey]) return [];
    const raw = runDetails[itemKey].data || [];
    return raw.map(d => ({
      ...d,
      date: d.forecast_date ? new Date(d.forecast_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : '',
      timestamp: d.forecast_date,
      actual: d.actual_quantity,
      forecast: d.predicted_quantity,
      lower: d.yhat_lower,
      upper: d.yhat_upper
    }));
  };

  const getMonthlyData = (fullData) => {
    const firstForecastIdx = fullData.findIndex(d => !d.actual);
    if (firstForecastIdx === -1) return [];
    // Take 4 points around the transition for context
    return fullData.slice(Math.max(0, firstForecastIdx - 2), firstForecastIdx + 4);
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
          <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
          <div className="relative w-32 h-32 rounded-full border-4 border-indigo-500/20 flex items-center justify-center">
            <Brain size={48} className="text-indigo-500 animate-bounce" />
            <div className="absolute inset-0 rounded-full border-t-4 border-indigo-500 animate-spin" />
          </div>
        </div>
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-3xl font-black tracking-tighter uppercase italic" style={{ color: 'var(--text-heading)' }}>Synthesizing Models</h2>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div className="h-full bg-indigo-500 transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.5)]" style={{ width: `${progress}%` }} />
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
    const stl = metrics.stl || null;
    const tags = metrics.tags || [];

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
              <div className="flex items-center gap-2 text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">
                <Clock size={12} /> {new Date(selectedRun.created_at).toLocaleDateString()} Run
              </div>
              <h2 className="text-3xl font-black tracking-tighter" style={{ color: 'var(--text-heading)' }}>{selectedRun.name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1 rounded-2xl border" style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)' }}>
            <button 
              onClick={() => setActiveTab('global')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'global' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Layers size={14} className="inline mr-2" /> Global Strategy
            </button>
            <button 
              onClick={() => setActiveTab('product')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'product' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
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
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input 
                    type="text" 
                    placeholder="Search catalog..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-white outline-none focus:border-indigo-500/50 transition-all"
                  />
                </div>
                <div className="space-y-1 mt-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredItems.map(item => (
                    <button 
                      key={item}
                      onClick={() => setSelectedProduct(item)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${selectedProduct === item ? 'bg-indigo-500/10 border border-indigo-500/30 text-white' : 'text-zinc-500 hover:bg-white/5'}`}
                    >
                      <span className="text-[11px] font-bold truncate uppercase">{item}</span>
                      {selectedProduct === item && <ChevronRight size={14} className="text-indigo-400" />}
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
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400">
                  <Calendar size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                    {activeTab === 'global' ? 'Store-Wide Outlook' : 'Item Strategy Hub'}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">12-Month Forecast Horizon</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {metrics.mape_pct !== undefined && (
                  <div className="flex flex-wrap gap-4">
                    <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5">
                      <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Model Accuracy</p>
                      <p className="text-sm font-bold text-white">{Math.max(0, 100 - metrics.mape_pct).toFixed(1)}% <span className="text-[10px] text-zinc-500 ml-1">Accuracy</span></p>
                    </div>
                    {metrics.mae !== undefined && (
                      <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5">
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Avg. Error Magnitude</p>
                        <p className="text-sm font-bold text-white">{(typeof metrics.mae === 'number' ? metrics.mae : 0).toFixed(2)} <span className="text-[10px] text-zinc-500 ml-1">MAE</span></p>
                      </div>
                    )}
                    {metrics.rmse !== undefined && (
                      <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5">
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Peak Error Sensitivity</p>
                        <p className="text-sm font-bold text-white">{(typeof metrics.rmse === 'number' ? metrics.rmse : 0).toFixed(2)} <span className="text-[10px] text-zinc-500 ml-1">RMSE</span></p>
                      </div>
                    )}
                    <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5">
                      <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Model Health</p>
                      <p className="text-sm font-bold text-white flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${metrics.is_zombie ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        {metrics.is_zombie ? 'STAGNANT' : 'HEALTHY'}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <span key={tag} className="px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-black uppercase tracking-widest">
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
                    <Line type="monotone" dataKey="forecast" stroke={chartColors.forecast} strokeWidth={4} dot={false} name="Hybrid Prediction" />
                    <Line type="monotone" dataKey="actual" stroke={chartColors.actual} strokeWidth={4} dot={{ r: 5, fill: chartColors.actual }} name="Historical Actual" />
                    <ReferenceLine x={chartData.find(d => !d.actual)?.date} stroke={chartColors.forecast} strokeDasharray="3 3" label={{ value: 'PREDICTION', position: 'insideTopRight', fill: chartColors.forecast, fontSize: 8, fontWeight: 900 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* MONTHLY ZOOM */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card title="Current Month Snap" subtitle="Short-term Detail" className="md:col-span-2" icon={Clock}>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: chartColors.axis, fontSize: 10, fontWeight: 700}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: chartColors.axis, fontSize: 10, fontWeight: 700}} />
                      <Tooltip 
                        contentStyle={{ 
                          background: chartColors.tooltip.bg, 
                          border: `1px solid ${chartColors.tooltip.border}`, 
                          borderRadius: '16px', 
                          fontSize: '11px',
                          color: chartColors.tooltip.text
                        }} 
                        itemStyle={{ color: chartColors.tooltip.text }}
                      />
                      <Line type="monotone" dataKey="forecast" stroke={chartColors.forecast} strokeWidth={4} dot={{ r: 5, fill: chartColors.forecast }} name="Target" />
                      <Line type="monotone" dataKey="actual" stroke={chartColors.actual} strokeWidth={3} dot={{ r: 4, fill: chartColors.actual }} name="History" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Decomposition" subtitle="Trend Analysis" icon={Layers}>
                <div className="space-y-4 pt-2">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Status</p>
                    <p className="text-xs font-bold text-white uppercase tracking-tight flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${metrics.is_zombie ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                      {metrics.is_zombie ? 'Stagnant' : 'Healthy Signal'}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Historical Depth</p>
                    <p className="text-xs font-bold text-white tracking-tight">Active Coverage</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* STRATEGIC STL HUB */}
            {stl && (
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3 px-4">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400"><Layers size={20} /></div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Strategic STL Hub</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Seasonal-Trend-Loess Decomposition</p>
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
                              <XAxis dataKey="date" hide={idx !== 3} axisLine={false} tickLine={false} tick={{fill: chartColors.axis, fontSize: 8}} />
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
          <p className="text-indigo-400 text-[9px] font-black uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
            Audit Repository
          </p>
          <h2 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
            <TrendingUp className="text-indigo-400" size={36} /> Analytics Vault
          </h2>
          <p className="text-zinc-500 text-sm font-medium mt-2 ml-1">
            Persisted 12-month hybrid models and strategic audit trails.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center space-y-4">
            <Activity className="animate-spin text-indigo-500" size={40} />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Accessing Models...</p>
          </div>
        ) : runs.length > 0 ? (
          runs.map(run => (
            <div key={run.id} 
              onClick={() => handleOpenRun(run)}
              className="group relative rounded-[2.5rem] p-8 space-y-4 transition-all hover:scale-[1.02] cursor-pointer hover:border-indigo-500/50"
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400">
                  <FileBarChart size={24} />
                </div>
                <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={12} /> {new Date(run.created_at).toLocaleDateString()}
                </div>
              </div>
              <div>
                <h4 className="text-xl font-black text-white tracking-tighter group-hover:text-indigo-300 transition-colors">{run.name}</h4>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                  Horizon: 12 Months • {run.config?.item_count || 0} Products
                </p>
              </div>
              <div className="pt-4 flex items-center gap-3">
                <div className="flex-1 py-3 bg-white/5 border border-white/5 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-600/30 transition-all">
                  <PlayCircle size={14} /> Open Result
                </div>
                <button 
                  onClick={(e) => handleDeleteRun(e, run.id)}
                  className="p-3 rounded-xl bg-white/5 text-zinc-600 hover:text-rose-400 hover:bg-rose-400/10 transition-all border border-white/5"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center space-y-4"
            style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
            <div className="p-5 rounded-full bg-zinc-800/50 text-zinc-600">
              <Search size={40} />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-black text-white uppercase italic">No saved runs found</h3>
              <p className="text-zinc-500 text-sm mt-1">Head over to the Management Hub to train your first model.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
