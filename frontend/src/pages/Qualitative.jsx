import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Trophy, Target, Zap, Activity, Package, TrendingUp, Calculator, 
  AlertCircle, Sparkles, Brain, CheckCircle2, ArrowRight, Loader2,   Info, Calendar, Save, RefreshCw, Sliders, Search, X, ChevronLeft, PlusCircle, Database
} from 'lucide-react';

const cardStyle = { background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' };

export default function Qualitative({ activeDatasetId, sidebarDatasets = [] }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bundlerRuns, setBundlerRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [isSandbox, setIsSandbox] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [stagedInfo, setStagedInfo] = useState(null);
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: '' }
  
  // SIMULATOR STATE
  const [viewMode, setViewMode] = useState('discovery'); // 'discovery' or 'simulator'
  const [simItemA, setSimItemA] = useState('');
  const [simItemB, setSimItemB] = useState('');
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [showDropdownA, setShowDropdownA] = useState(false);
  const [showDropdownB, setShowDropdownB] = useState(false);
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [selectedDatasetIds, setSelectedDatasetIds] = useState([]);
  
  useEffect(() => {
    if (selectedDatasetIds.length === 0 && activeDatasetId) {
      setSelectedDatasetIds([activeDatasetId]);
    }
  }, [activeDatasetId]);

  useEffect(() => {
    if (selectedDatasetIds.length > 0) {
      fetchCatalog();
    }
  }, [selectedDatasetIds]);

  const fetchCatalog = async () => {
    if (selectedDatasetIds.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      const ids = selectedDatasetIds.join(',');
      const res = await axios.get(`/api/get-items?dataset_ids=${ids}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCatalog(res.data.items || []);
    } catch (err) {
      console.error("Failed to fetch catalog", err);
    }
  };

  const runSimulation = async () => {
    if (!simItemA || !simItemB) return;
    setSimLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/bundler/simulate', {
        dataset_ids: selectedDatasetIds,
        item_a: simItemA,
        item_b: simItemB,
        ref_forecast_id: stagedInfo?.refId || selectedRunId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSimResult(res.data.result);
    } catch (err) {
      console.error("Simulation failed", err);
    } finally {
      setSimLoading(false);
    }
  };

  useEffect(() => {
    if (simItemA && simItemB) runSimulation();
  }, [simItemA, simItemB]);

  useEffect(() => {
    // Check if we arrived with staged bundles
    if (location.state?.stagedBundles) {
      // If it was auto-saved by the dual-run, treat as non-sandbox
      if (location.state.autoSaved) {
        setIsSandbox(false);
        fetchBundlerRuns(); // Refresh to find the new run
      } else {
        setIsSandbox(true);
        setBundles(location.state.stagedBundles);
        setStagedInfo({
          name: location.state.stagedName,
          datasetId: location.state.stagedDatasetId,
          refId: location.state.stagedRefId
        });
      }
    } else {
      fetchBundlerRuns();
    }
  }, [activeDatasetId, location.state]);

  useEffect(() => {
    if (selectedRunId && !isSandbox) {
      fetchBundlerResults(selectedRunId);
    }
  }, [selectedRunId, isSandbox]);

  const fetchBundlerRuns = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/datasets/${activeDatasetId}/bundler-runs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBundlerRuns(res.data.runs);
      if (res.data.runs.length > 0 && !selectedRunId) {
        setSelectedRunId(res.data.runs[0].id.toString());
      }
    } catch (err) {
      console.error("Failed to fetch bundler runs", err);
    }
  };

  const fetchBundlerResults = async (runId) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/bundler/runs/${runId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBundles(res.data.bundles || []);
    } catch (err) {
      setError("Failed to load bundling results.");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    setSaveLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/bundler/runs/commit', {
        name: stagedInfo.name,
        dataset_id: stagedInfo.datasetId,
        forecast_ref_id: stagedInfo.refId,
        bundles: bundles
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsSandbox(false);
      fetchBundlerRuns();
      setNotification({ type: 'success', message: 'Strategy successfully committed to the vault.' });
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      console.error("Failed to save strategy", err);
      setNotification({ type: 'error', message: 'Failed to save strategy. Please check system logs.' });
    } finally {
      setSaveLoading(false);
    }
  };

  const getBadgeStyle = (badge) => {
    switch (badge) {
      case 'STRATEGIC': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'EMERGING': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'SEASONAL': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'RISK': return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* NOTIFICATION SYSTEM */}
      {notification && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md animate-in slide-in-from-top-8 duration-500`}>
          <div className={`p-4 rounded-2xl border shadow-2xl flex items-center justify-between gap-4 ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}
               style={{ backdropFilter: 'blur(12px)' }}>
            <div className="flex items-center gap-3">
              {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <p className="text-xs font-black uppercase tracking-widest">{notification.message}</p>
            </div>
            <button onClick={() => setNotification(null)} className="opacity-50 hover:opacity-100 transition-opacity">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="relative rounded-[2.5rem] p-10 overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-8"
        style={{ background: 'var(--glass-bg)', border: `1px solid var(--glass-border)` }}>
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 space-y-4 max-w-xl">
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] flex items-center gap-2">
            <Sparkles size={14} /> Intelligence Strategy Hub
          </p>
          <div className="flex items-center p-1 bg-white/5 rounded-2xl border border-white/10 w-fit">
            <button 
              onClick={() => setViewMode('discovery')}
              className={`px-8 py-3 text-2xl font-black tracking-tighter italic transition-all rounded-xl flex items-center gap-2 ${viewMode === 'discovery' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-white/30 hover:text-white/50 hover:bg-white/5'}`}
            >
              <Sparkles size={20} className={viewMode === 'discovery' ? 'animate-pulse' : ''} />
              Discovery
            </button>
            <button 
              onClick={() => setViewMode('simulator')}
              className={`px-8 py-3 text-2xl font-black tracking-tighter italic transition-all rounded-xl flex items-center gap-2 ${viewMode === 'simulator' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-white/30 hover:text-white/50 hover:bg-white/5'}`}
            >
              <Sliders size={20} className={viewMode === 'simulator' ? 'animate-bounce' : ''} />
              Simulator
            </button>
          </div>
          <p className="text-zinc-500 text-sm leading-relaxed">
            {viewMode === 'discovery' 
              ? 'Reviewing association patterns identified via Apriori and ranked by Random Forest logic.'
              : 'Manually test bundling hypotheses against historical affinity and predicted demand alignment.'}
          </p>
        </div>

        <div className="relative z-10 flex flex-col gap-2 w-full md:w-auto">
          {isSandbox ? (
            <div className="space-y-4">
              <button 
                onClick={handleCommit}
                disabled={saveLoading}
                className="w-80 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-3"
              >
                {saveLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Strategy to Vault
              </button>
              <button 
                onClick={() => { setIsSandbox(false); navigate('/', { replace: true, state: {} }); }}
                className="w-full text-[9px] font-black text-zinc-600 uppercase tracking-widest hover:text-zinc-400 transition-colors flex items-center justify-center gap-2"
              >
                <ChevronLeft size={10} />
                Return to Model Training
              </button>
            </div>
          ) : (
            <>
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Select Analysis Session</label>
              <select 
                value={selectedRunId}
                onChange={(e) => setSelectedRunId(e.target.value)}
                className="w-full md:w-80 bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-xs font-bold text-white outline-none focus:border-emerald-500/50 transition-all shadow-2xl appearance-none cursor-pointer"
              >
                {bundlerRuns.map(run => (
                  <option key={run.id} value={run.id}>{run.name} ({new Date(run.created_at).toLocaleDateString()})</option>
                ))}
                {bundlerRuns.length === 0 && <option value="">No analysis runs found</option>}
              </select>
              <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest mt-1 text-right italic">
                Models are trained in the Management Hub
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-6 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 flex items-center gap-4 animate-in slide-in-from-top-2">
          <AlertCircle className="text-rose-400" size={24} />
          <p className="text-sm font-bold text-rose-400">{error}</p>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="max-w-6xl mx-auto">
        {viewMode === 'discovery' ? (
          <>
            {!loading && bundles.length > 0 ? (
              <div className="rounded-[2.5rem] border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700" style={cardStyle}>
                <div className="p-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-black text-white uppercase italic tracking-tight">
                        {isSandbox ? 'Strategic Discovery Sandbox' : 'Active Strategic Recommendations'}
                      </h3>
                      {isSandbox && (
                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[8px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                          <Sparkles size={10} /> Pending Review
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">
                      {isSandbox ? 'Discovering Emerging Patterns...' : 'Cross-Engine Verification Complete'}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center">
                       <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">Pairs Identified</p>
                       <p className="text-xl font-black text-white italic">{bundles.length}</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-zinc-500 uppercase tracking-widest bg-black/20">
                        <th className="px-8 py-5">Rank</th>
                        <th className="px-8 py-5">Bundle Pair</th>
                        <th className="px-8 py-5 text-center">Probability of Success</th>
                        <th className="px-8 py-5 text-center">Market Context</th>
                        <th className="px-8 py-5">Strategic Rationale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {bundles.map((bundle, idx) => (
                        <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                          <td className="px-8 py-8 font-black text-zinc-700 italic text-2xl group-hover:text-emerald-500 transition-colors">#{idx + 1}</td>
                          <td className="px-8 py-8">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <Package size={14} className="text-emerald-400" />
                              </div>
                              <span className="text-xs font-black text-white uppercase tracking-tight leading-relaxed max-w-xs">{bundle.pair}</span>
                            </div>
                          </td>
                          <td className="px-8 py-8">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-sm font-black text-emerald-400 italic">{bundle.probability}%</span>
                              <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${bundle.probability}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-8">
                            <div className="flex justify-center">
                              <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${getBadgeStyle(bundle.badge)}`}>
                                {bundle.badge}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-8">
                            <div className="flex items-start gap-3 group/info">
                              <Info size={14} className="text-zinc-600 mt-0.5 group-hover/info:text-emerald-400 transition-colors" />
                              <p className="text-[10px] font-bold text-zinc-500 leading-relaxed italic group-hover/info:text-zinc-300 transition-colors">
                                "{bundle.why || 'Strong historical affinity combined with emerging market trends.'}"
                              </p>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : loading ? (
              <div className="rounded-[2.5rem] p-32 border flex flex-col items-center justify-center space-y-8"
                style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-emerald-900 border-t-emerald-500 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Brain className="text-emerald-400 animate-pulse" size={24} />
                  </div>
                </div>
                <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em]">Loading Strategic Matrix...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center animate-in fade-in zoom-in duration-500">
                <div className="p-6 rounded-full bg-zinc-900 border border-white/5">
                  <Calendar size={48} className="text-zinc-700" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-zinc-300 uppercase italic">No Sessions Found</h3>
                  <p className="text-zinc-600 text-sm max-w-sm">Use the Management Hub to initiate a Product Bundling analysis session for this dataset.</p>
                  <button 
                    onClick={() => navigate('/')}
                    className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all mt-4"
                  >
                    Go to Management Hub
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ITEM SELECTORS */}
            <div className="space-y-6">
              {/* DATA SCOPING (LIKE TRAINING) */}
              <div className="rounded-[2.5rem] p-8 space-y-6" style={cardStyle}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                      <Database size={20} className="text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-widest">Strategic Scoping</h4>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase">Select Year Ranges / Models</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 overflow-y-auto max-h-[200px] pr-2 custom-scrollbar">
                  {sidebarDatasets.map(ds => (
                    <label key={ds.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${selectedDatasetIds.includes(ds.id) ? 'bg-indigo-500/10 border-indigo-500/30 text-white shadow-lg shadow-indigo-500/10' : 'bg-black/20 border-white/5 text-zinc-500 hover:border-white/10'}`}>
                      <input
                        type="checkbox"
                        checked={selectedDatasetIds.includes(ds.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedDatasetIds([...selectedDatasetIds, ds.id]);
                          else setSelectedDatasetIds(selectedDatasetIds.filter(id => id !== ds.id));
                        }}
                        className="w-4 h-4 rounded accent-indigo-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black truncate uppercase">{ds.title}</p>
                        <p className="text-[9px] opacity-40 font-bold tracking-wider uppercase">{(ds.row_count || 0).toLocaleString()} Transaction Records</p>
                      </div>
                    </label>
                  ))}
                  {sidebarDatasets.length === 0 && (
                    <p className="text-center py-8 text-[10px] font-black text-zinc-600 uppercase tracking-widest italic">No datasets available</p>
                  )}
                </div>
              </div>

              <div className="rounded-[2.5rem] p-8 space-y-8" style={cardStyle}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                      <Target size={20} className="text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-widest">Bundle Hypothesis</h4>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase">Manual Pair Selection</p>
                    </div>
                  </div>
                  
                  {(!stagedInfo?.refId && (!selectedRunId || selectedRunId === 'none' || selectedRunId === '')) && (
                    <div className="px-3 py-1.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-2 text-amber-500/60" title="Predictive demand models have not been trained for this session. Simulation uses historical affinity only.">
                      <Info size={12} />
                      <span className="text-[8px] font-black uppercase tracking-tighter">Historical Only</span>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {/* Item A */}
                  <div className="relative">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">Primary Item</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                      <input 
                        type="text"
                        placeholder="Search primary item..."
                        value={simItemA || searchA}
                        onChange={(e) => { setSearchA(e.target.value); setSimItemA(''); setShowDropdownA(true); }}
                        onFocus={() => setShowDropdownA(true)}
                        className="w-full bg-black/40 border border-white/5 rounded-2xl pl-11 pr-4 py-4 text-xs font-bold text-white outline-none focus:border-indigo-500/50 transition-all shadow-xl"
                      />
                      {simItemA && <button onClick={() => setSimItemA('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"><X size={14} /></button>}
                    </div>
                    {showDropdownA && !simItemA && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar p-2">
                        {catalog.filter(i => i.toLowerCase().includes(searchA.toLowerCase())).length > 0 ? (
                          catalog.filter(i => i.toLowerCase().includes(searchA.toLowerCase())).slice(0, 50).map(item => (
                            <button 
                              key={item}
                              onClick={() => { setSimItemA(item); setSearchA(item); setShowDropdownA(false); }}
                              className="w-full text-left px-4 py-3 rounded-xl text-[10px] font-black text-zinc-400 hover:text-white hover:bg-white/5 transition-all uppercase"
                            >
                              {item}
                            </button>
                          ))
                        ) : (
                          <p className="p-4 text-[10px] font-black text-zinc-600 uppercase italic">
                            {(!activeDatasetId && !location.state?.stagedDatasetId) ? "Select active dataset in sidebar" : "No items found"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* PLUS ICON */}
                  <div className="flex justify-center">
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                      <PlusCircle size={14} className="text-zinc-600" />
                    </div>
                  </div>

                  {/* Item B */}
                  <div className="relative">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">Secondary Item</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                      <input 
                        type="text"
                        placeholder="Search secondary item..."
                        value={simItemB || searchB}
                        onChange={(e) => { setSearchB(e.target.value); setSimItemB(''); setShowDropdownB(true); }}
                        onFocus={() => setShowDropdownB(true)}
                        className="w-full bg-black/40 border border-white/5 rounded-2xl pl-11 pr-4 py-4 text-xs font-bold text-white outline-none focus:border-emerald-500/50 transition-all shadow-xl"
                      />
                      {simItemB && <button onClick={() => setSimItemB('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"><X size={14} /></button>}
                    </div>
                    {showDropdownB && !simItemB && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar p-2">
                        {catalog.filter(i => i.toLowerCase().includes(searchB.toLowerCase())).length > 0 ? (
                          catalog.filter(i => i.toLowerCase().includes(searchB.toLowerCase())).slice(0, 50).map(item => (
                            <button 
                              key={item}
                              onClick={() => { setSimItemB(item); setSearchB(item); setShowDropdownB(false); }}
                              className="w-full text-left px-4 py-3 rounded-xl text-[10px] font-black text-zinc-400 hover:text-white hover:bg-white/5 transition-all uppercase"
                            >
                              {item}
                            </button>
                          ))
                        ) : (
                          <p className="p-4 text-[10px] font-black text-zinc-600 uppercase italic">
                            {(!activeDatasetId && !location.state?.stagedDatasetId) ? "Select active dataset in sidebar" : "No items found"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-4">
                <Info size={20} className="text-indigo-400 mt-1" />
                <p className="text-xs text-zinc-500 font-bold leading-relaxed italic">
                  The simulator cross-references your manual pairing against historical transactional affinity and predicted demand alignment. Scores reflect the probability of this bundle succeeding in the current market window.
                </p>
              </div>
            </div>

            {/* RESULTS VIEW */}
            <div className="flex flex-col">
              {simLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-10 rounded-[2.5rem] border border-white/5 bg-white/[0.02] border-dashed">
                  <Loader2 size={48} className="text-emerald-500 animate-spin mb-4" />
                  <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Simulating Strategy...</p>
                </div>
              ) : simResult ? (
                <div className="flex-1 rounded-[2.5rem] overflow-hidden flex flex-col border shadow-2xl animate-in zoom-in-95 duration-500" style={cardStyle}>
                  <div className="p-8 bg-gradient-to-br from-emerald-500/20 to-transparent border-b border-white/5 space-y-6">
                    <div className="flex justify-between items-start">
                      <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${getBadgeStyle(simResult.badge)}`}>
                        {simResult.badge}
                      </span>
                      <div className="text-right">
                        <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Model Score</p>
                        <p className="text-4xl font-black text-white italic tracking-tighter">{simResult.probability}%</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 py-4">
                      <div className="flex-1 text-center px-4 py-3 rounded-2xl bg-white/5 border border-white/5">
                        <p className="text-[8px] font-bold text-zinc-600 uppercase mb-1">Lift</p>
                        <p className="text-sm font-black text-white italic">{simResult.lift}</p>
                      </div>
                      <div className="flex-1 text-center px-4 py-3 rounded-2xl bg-white/5 border border-white/5">
                        <p className="text-[8px] font-bold text-zinc-600 uppercase mb-1">Confidence</p>
                        <p className="text-sm font-black text-white italic">{Math.round(simResult.confidence * 100)}%</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-6 flex-1 bg-white/[0.01]">
                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <Brain size={12} className="text-emerald-400" /> Strategic Rationale
                      </label>
                      <div className="p-6 rounded-3xl bg-black/40 border border-white/5 shadow-inner">
                        <p className="text-sm font-bold text-zinc-300 leading-relaxed italic">
                          "{simResult.why}"
                        </p>
                      </div>
                    </div>
                  </div>



                  <div className="p-6 bg-black/40 border-t border-white/5">
                    <button 
                      onClick={async () => {
                        setSaveLoading(true);
                        try {
                          const token = localStorage.getItem('token');
                          await axios.post('/api/bundler/runs/commit', {
                            name: `Manual: ${simResult.pair}`,
                            dataset_id: activeDatasetId,
                            forecast_ref_id: stagedInfo?.refId || selectedRunId,
                            bundles: [simResult]
                          }, { headers: { Authorization: `Bearer ${token}` } });
                          setNotification({ type: 'success', message: 'Simulation results added to Strategy Vault.' });
                          setTimeout(() => setNotification(null), 5000);
                        } catch (err) {
                          console.error("Save failed", err);
                          setNotification({ type: 'error', message: 'Failed to save simulation. Integrity check failed.' });
                        } finally {
                          setSaveLoading(false);
                        }
                      }}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20"
                    >
                      {saveLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      Add Simulation to Strategy Vault
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-10 rounded-[2.5rem] border border-white/5 bg-white/[0.02] border-dashed text-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-6 border border-white/5">
                    <Sliders size={24} className="text-zinc-700" />
                  </div>
                  <h3 className="text-xl font-black text-zinc-500 uppercase italic">Hypothesis Required</h3>
                  <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-2 max-w-[240px]">
                    Select two items from the catalog to begin the predictive simulation.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
