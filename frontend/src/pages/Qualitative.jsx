import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Trophy, Target, Zap, Activity, Package, TrendingUp, Calculator,
  AlertCircle, Sparkles, Brain, CheckCircle2, ArrowRight, Loader2, Info, Calendar, Save, RefreshCw, Sliders, Search, X, ChevronLeft, PlusCircle, Database, BookOpen
} from 'lucide-react';
import InfoTooltip from '../components/InfoTooltip';

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

  const dropdownRefA = useRef(null);
  const dropdownRefB = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRefA.current && !dropdownRefA.current.contains(event.target)) {
        setShowDropdownA(false);
      }
      if (dropdownRefB.current && !dropdownRefB.current.contains(event.target)) {
        setShowDropdownB(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredCatalogA = catalog.filter(item =>
    item && item.toLowerCase().includes((searchA || '').toLowerCase()) && item !== simItemB
  ).slice(0, 50);

  const filteredCatalogB = catalog.filter(item =>
    item && item.toLowerCase().includes((searchB || '').toLowerCase()) && item !== simItemA
  ).slice(0, 50);

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
    if (selectedDatasetIds.length === 0 || selectedDatasetIds.includes(null) || selectedDatasetIds.includes('null')) return;

    try {
      const token = localStorage.getItem('token');
      const ids = selectedDatasetIds.filter(id => id && id !== 'null').join(',');
      if (!ids) return;
      const res = await axios.get(`/api/get-items?dataset_ids=${ids}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCatalog(res.data.items || []);
    } catch (err) {
      console.error("Failed to fetch catalog", err);
    }
  };

  const runSimulation = async () => {
    if (!simItemA || !simItemB || selectedDatasetIds.length === 0) return;
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

  // Fetch saved runs whenever the active dataset changes
  useEffect(() => {
    if (!location.state?.stagedBundles) {
      fetchBundlerRuns();
    }
  }, [activeDatasetId]);

  // Handle navigation state (staged bundles from a run)
  useEffect(() => {
    if (location.state?.stagedBundles) {
      if (location.state.autoSaved) {
        setIsSandbox(false);
        fetchBundlerRuns();
      } else {
        setIsSandbox(true);
        setBundles(location.state.stagedBundles);
        setStagedInfo({
          name: location.state.stagedName,
          datasetId: location.state.stagedDatasetId,
          refId: location.state.stagedRefId
        });
      }
    }
  }, [location.state]);

  useEffect(() => {
    if (selectedRunId && !isSandbox) {
      fetchBundlerResults(selectedRunId);
    }
  }, [selectedRunId, isSandbox]);

  const openBundleDetail = (runId, bundleIndex) => {
    if (isSandbox) {
      navigate(`/bundler/runs/sandbox?bundle=${bundleIndex}`, {
        state: {
          bundles,
          run: {
            id: 'sandbox',
            name: stagedInfo?.name || 'Sandbox Preview',
            dataset_id: stagedInfo?.datasetId
          }
        }
      });
    } else {
      navigate(`/bundler/runs/${runId}?bundle=${bundleIndex}`);
    }
  };

  const fetchBundlerRuns = async (selectedId = null) => {
    try {
      const token = localStorage.getItem('token');
      // Fetch ALL runs across all datasets so the user always sees their saved work
      const res = await axios.get(`/api/bundler/runs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const runs = res.data.runs || [];
      setBundlerRuns(runs);
      if (runs.length > 0) {
        if (selectedId) {
          setSelectedRunId(selectedId.toString());
        } else {
          setSelectedRunId(runs[0].id.toString());
        }
      } else {
        setSelectedRunId('');
        setBundles([]);
      }
    } catch (err) {
      console.error("Failed to fetch bundler runs", err);
    }
  };

  const fetchBundlerResults = async (runId) => {
    if (!runId || runId === 'null' || runId === 'sandbox' || runId === 'undefined') return;
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
      const res = await axios.post('/api/bundler/runs/commit', {
        name: stagedInfo.name,
        dataset_id: stagedInfo.datasetId,
        forecast_ref_id: stagedInfo.refId,
        bundles: bundles
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsSandbox(false);
      fetchBundlerRuns(res.data?.run_id);
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
      case 'STRATEGIC': return { background: 'var(--success-bg)', color: '#10b981', borderColor: 'var(--success-border)' };
      case 'EMERGING': return { background: 'var(--card-accent-bg)', color: 'var(--accent)', borderColor: 'var(--border-subtle)' };
      case 'SEASONAL': return { background: 'var(--badge-yearly-bg)', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.3)' };
      case 'RISK': return { background: 'var(--error-bg)', color: '#f43f5e', borderColor: 'var(--error-border)' };
      default: return { background: 'var(--glass-bg)', color: 'var(--text-muted)', borderColor: 'var(--glass-border)' };
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* NOTIFICATION SYSTEM */}
      {notification && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 animate-in slide-in-from-top-4`}
          style={{ background: notification.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)', borderColor: notification.type === 'success' ? 'var(--success-border)' : 'var(--error-border)' }}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl`} style={{ background: notification.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: notification.type === 'success' ? '#10b981' : '#f43f5e' }}>
              {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            </div>
            <p className="text-xs font-black uppercase tracking-tight" style={{ color: notification.type === 'success' ? '#10b981' : '#f43f5e' }}>{notification.message}</p>
          </div>
          <button onClick={() => setNotification(null)} className="transition-all hover:opacity-70" style={{ color: notification.type === 'success' ? '#10b981' : '#f43f5e' }}><X size={16} /></button>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="relative rounded-[2.5rem] p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8"
        style={{ background: 'var(--glass-bg)', border: `1px solid var(--glass-border)` }}>
        <div className="absolute inset-0 pointer-events-none rounded-[2.5rem]" style={{ background: 'var(--gradient-hero)' }} />
        <div className="relative z-10 space-y-4 max-w-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2" style={{ color: 'var(--accent)' }}>
            <Sparkles size={14} /> Intelligence Strategy Hub
          </p>
          <div className="flex w-fit bg-white/5 p-1.5 rounded-2xl border" style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)' }}>
            <button
              onClick={() => setViewMode('discovery')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'discovery' ? 'text-white shadow-lg' : ''}`}
              style={{ background: viewMode === 'discovery' ? 'var(--accent)' : 'transparent', color: viewMode === 'discovery' ? '#fff' : 'var(--text-faint)', boxShadow: viewMode === 'discovery' ? '0 10px 15px -3px var(--accent-glow)' : 'none' }}
            >
              Product Bundling Insights
            </button>
            <button
              onClick={() => setViewMode('simulator')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'simulator' ? 'text-white shadow-lg' : ''}`}
              style={{ background: viewMode === 'simulator' ? 'var(--accent)' : 'transparent', color: viewMode === 'simulator' ? '#fff' : 'var(--text-faint)', boxShadow: viewMode === 'simulator' ? '0 10px 15px -3px var(--accent-glow)' : 'none' }}
            >
              Test a Bundle
            </button>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {viewMode === 'discovery'
              ? <span>Reviewing association patterns identified via <strong>Apriori</strong><InfoTooltip term="Apriori Algorithm" size={11} side="bottom" /> and ranked by <strong>Random Forest</strong><InfoTooltip term="Random Forest" size={11} side="bottom" /> logic.</span>
              : <span>Manually test bundling hypotheses.<InfoTooltip term="Choose Two Items" size={11} side="bottom" /></span>}
          </p>
        </div>

        <div className="relative z-10 flex flex-col gap-2 w-full md:w-auto">
          <div className="flex items-center gap-4">
            {isSandbox && (
              <button
                onClick={handleCommit}
                disabled={saveLoading}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 10px 15px -3px var(--accent-glow)' }}
              >
                {saveLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save to Vault
              </button>
            )}
            {viewMode === 'discovery' && (
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border" style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)' }}>
                <Database size={14} style={{ color: 'var(--accent)' }} />
                <select
                  value={selectedRunId}
                  onChange={(e) => { setSelectedRunId(e.target.value); setIsSandbox(false); }}
                  className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {isSandbox && <option value="sandbox">Sandbox: {stagedInfo?.name || 'New Result'}</option>}
                  {bundlerRuns.map(run => {
                    return (
                      <option key={run.id} value={run.id.toString()}>
                        {(run.name || 'Unnamed Run').toUpperCase()}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
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
        {!activeDatasetId && viewMode === 'discovery' ? (
          <div className="py-32 flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-6 rounded-full" style={{ background: 'var(--input-bg)', color: 'var(--text-faint)', opacity: 0.2 }}>
              <Database size={40} />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase italic" style={{ color: 'var(--text-heading)' }}>No Dataset Active</h3>
              <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>Please activate a dataset in the Management Hub to view its strategy vault.</p>
            </div>
          </div>
        ) : viewMode === 'discovery' ? (
          <>
            {!loading && bundles.length > 0 ? (
              <div className="rounded-[2.5rem] border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700" style={cardStyle}>
                <div className="p-8 flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--glass-bg-hover)' }}>
                  <div className="flex items-center gap-4">
                    <h3 className="text-xl font-black uppercase tracking-tight" style={{ color: 'var(--text-heading)' }}>Product Bundling Insights</h3>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-white/5 border-white/10">
                      <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Identified Product Bundles</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="px-5 py-3 rounded-2xl border flex flex-col items-center" style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)' }}>
                      <p className="text-[8px] font-black uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Pairs Identified</p>
                      <p className="text-xl font-black italic" style={{ color: 'var(--text-heading)' }}>{bundles.length}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8">
                  {bundles.map((bundle, idx) => bundle && (
                    <div key={idx} className="p-6 rounded-3xl border flex flex-col gap-6" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl" style={{ background: 'var(--card-accent-bg)', color: 'var(--accent)' }}>
                            <Package size={20} />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Bundle #{idx + 1}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest"
                            style={{
                              background: getBadgeStyle(bundle.badge).background,
                              color: getBadgeStyle(bundle.badge).color,
                              borderColor: getBadgeStyle(bundle.badge).borderColor
                            }}>
                            {bundle.badge}
                          </div>
                          <InfoTooltip term={bundle.badge} size={11} side="left" />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {(bundle.items || (bundle.pair ? bundle.pair.split(' + ') : [])).map(item => (
                            <span key={item} className="px-3 py-1 rounded-lg border text-[10px] font-bold"
                              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                              {item}
                            </span>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                            <p className="text-[9px] font-black uppercase tracking-widest mb-1 flex items-center" style={{ color: 'var(--text-faint)' }}>Confidence <InfoTooltip term="Confidence" size={10} side="bottom" /></p>
                            <p className="text-lg font-black" style={{ color: 'var(--text-heading)' }}>{((bundle.confidence || 0) * 100).toFixed(1)}%</p>
                          </div>
                          <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                            <p className="text-[9px] font-black uppercase tracking-widest mb-1 flex items-center" style={{ color: 'var(--text-faint)' }}>Support <InfoTooltip term="Support" size={10} side="bottom" /></p>
                            <p className="text-lg font-black" style={{ color: 'var(--text-heading)' }}>{((bundle.support || 0) * 100).toFixed(2)}%</p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => openBundleDetail(selectedRunId, idx)}
                        className="w-full py-4 rounded-2xl border font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:shadow-lg"
                        style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                      >
                        Deep Dive Result <ArrowRight size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : loading ? (
              <div className="col-span-full py-32 flex flex-col items-center justify-center space-y-6">
                <div className="p-6 rounded-full" style={{ background: 'var(--card-accent-bg)', color: 'var(--accent)' }}>
                  <Loader2 size={40} className="animate-spin" />
                </div>
                <p className="font-black uppercase tracking-[0.3em] text-xs" style={{ color: 'var(--text-faint)' }}>Assembling Affinity Matrix...</p>
              </div>
            ) : (
              <div className="col-span-full py-32 flex flex-col items-center justify-center text-center space-y-4">
                <div className="p-6 rounded-full" style={{ background: 'var(--input-bg)', color: 'var(--text-faint)', opacity: 0.2 }}>
                  <Search size={40} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase italic" style={{ color: 'var(--text-heading)' }}>No Saved Bundles</h3>
                  <p className="text-sm max-w-xs mx-auto mt-2" style={{ color: 'var(--text-muted)' }}>Bundle strategies are generated during model training. Head to the Management Hub, enable the <strong>Bundler</strong>, and run a training session first.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Link to="/" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:opacity-80" style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 8px 20px -4px var(--accent-glow)' }}>
                    Go to Management Hub <ArrowRight size={13} />
                  </Link>
                  <Link to="/help" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all hover:opacity-80" style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <BookOpen size={13} /> Learn More
                  </Link>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ITEM SELECTORS */}
            <div className="space-y-6">
              <div className="rounded-[2.5rem] p-8 space-y-6" style={cardStyle}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center border" style={{ background: 'var(--card-accent-bg)', borderColor: 'var(--glass-border)' }}>
                      <Database size={20} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-widest" style={{ color: 'var(--text-heading)' }}>Strategic Scoping</h4>
                      <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-faint)' }}>Select Year Ranges / Models</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 overflow-y-auto max-h-[200px] pr-2 custom-scrollbar">
                  {sidebarDatasets.map(ds => (
                    <label key={ds.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${selectedDatasetIds.includes(ds.id) ? 'bg-indigo-500/10 border-indigo-500/30 text-white shadow-lg shadow-indigo-500/10' : 'hover:border-white/10'}`}
                      style={{ background: selectedDatasetIds.includes(ds.id) ? '' : 'var(--input-bg)', borderColor: selectedDatasetIds.includes(ds.id) ? '' : 'var(--border-subtle)', color: selectedDatasetIds.includes(ds.id) ? '#fff' : 'var(--text-secondary)' }}>
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
                        <p className="text-[9px] font-bold tracking-wider uppercase" style={{ color: 'var(--text-faint)' }}>{(ds.row_count || 0).toLocaleString()} Transaction Records</p>
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
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center border" style={{ background: 'var(--card-accent-bg)', borderColor: 'var(--glass-border)' }}>
                      <Target size={20} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-widest" style={{ color: 'var(--text-heading)' }}>Choose Two Items <InfoTooltip term="Choose Two Items" size={11} /></h4>
                      <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-faint)' }}>Manual Pair Selection</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="relative" ref={dropdownRefA}>
                    <label className="text-[9px] font-black uppercase tracking-widest ml-1 mb-2 block" style={{ color: 'var(--text-muted)' }}>Primary Item</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={14} style={{ color: 'var(--text-faint)' }} />
                      <input
                        type="text"
                        placeholder="Search primary item..."
                        value={simItemA || searchA}
                        onChange={(e) => { setSearchA(e.target.value); setSimItemA(''); setShowDropdownA(true); }}
                        onFocus={() => setShowDropdownA(true)}
                        className="w-full rounded-2xl pl-11 pr-4 py-4 text-xs font-bold outline-none focus:border-indigo-500/50 transition-all shadow-xl"
                        style={{ background: 'var(--sim-input-bg)', border: '1px solid var(--sim-input-border)', color: 'var(--sim-text-primary)' }}
                      />
                      {(simItemA || searchA) && <button onClick={() => { setSimItemA(''); setSearchA(''); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"><X size={14} /></button>}
                    </div>
                    {showDropdownA && searchA.length >= 1 && (
                      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-60 overflow-y-auto rounded-2xl border p-2 shadow-2xl custom-scrollbar"
                        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-strong)' }}>
                        {filteredCatalogA.length > 0 ? (
                          filteredCatalogA.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setSimItemA(item);
                                setSearchA(item);
                                setShowDropdownA(false);
                              }}
                              className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:bg-indigo-500/10 hover:text-indigo-400"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {item}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-xs italic" style={{ color: 'var(--text-muted)' }}>
                            No items found
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-center">
                    <div className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)' }}>
                      <PlusCircle size={14} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  <div className="relative" ref={dropdownRefB}>
                    <label className="text-[9px] font-black uppercase tracking-widest ml-1 mb-2 block" style={{ color: 'var(--text-muted)' }}>Secondary Item</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={14} style={{ color: 'var(--text-faint)' }} />
                      <input
                        type="text"
                        placeholder="Search secondary item..."
                        value={simItemB || searchB}
                        onChange={(e) => { setSearchB(e.target.value); setSimItemB(''); setShowDropdownB(true); }}
                        onFocus={() => setShowDropdownB(true)}
                        className="w-full rounded-2xl pl-11 pr-4 py-4 text-xs font-bold outline-none focus:border-emerald-500/50 transition-all shadow-xl"
                        style={{ background: 'var(--sim-input-bg)', border: '1px solid var(--sim-input-border)', color: 'var(--sim-text-primary)' }}
                      />
                      {(simItemB || searchB) && <button onClick={() => { setSimItemB(''); setSearchB(''); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"><X size={14} /></button>}
                    </div>
                    {showDropdownB && searchB.length >= 1 && (
                      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-60 overflow-y-auto rounded-2xl border p-2 shadow-2xl custom-scrollbar"
                        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-strong)' }}>
                        {filteredCatalogB.length > 0 ? (
                          filteredCatalogB.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setSimItemB(item);
                                setSearchB(item);
                                setShowDropdownB(false);
                              }}
                              className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:bg-emerald-500/10 hover:text-emerald-500"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {item}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-xs italic" style={{ color: 'var(--text-muted)' }}>
                            No items found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* RESULTS VIEW */}
            <div className="flex flex-col">
              {simLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-10 rounded-[2.5rem] border border-dashed"
                  style={{ background: 'var(--sim-item-hover-bg)', borderColor: 'var(--sim-border)' }}>
                  <Loader2 size={48} className="text-emerald-500 animate-spin mb-4" />
                  <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--sim-text-muted)' }}>Simulating Strategy...</p>
                </div>
              ) : simResult ? (
                <div className="flex-1 rounded-[2.5rem] overflow-hidden flex flex-col border shadow-2xl animate-in zoom-in-95 duration-500" style={cardStyle}>
                  <div className="p-8 bg-gradient-to-br from-emerald-500/20 to-transparent border-b border-white/5 space-y-6">
                    <div className="flex justify-between items-start">
                      <span className="px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border"
                        style={{
                          background: getBadgeStyle(simResult.badge).background,
                          color: getBadgeStyle(simResult.badge).color,
                          borderColor: getBadgeStyle(simResult.badge).borderColor
                        }}>
                        {simResult.badge}
                      </span>
                      <div className="text-right">
                        <p className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>Model Score</p>
                        <p className="text-4xl font-black italic tracking-tighter" style={{ color: 'var(--text-heading)' }}>{simResult.probability}%</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 py-4">
                      <div className="flex-1 text-center px-4 py-3 rounded-2xl border" style={{ background: 'var(--sim-item-hover-bg)', border: '1px solid var(--sim-border)' }}>
                        <p className="text-[8px] font-bold uppercase mb-1" style={{ color: 'var(--sim-text-muted)' }}>Lift</p>
                        <p className="text-sm font-black italic" style={{ color: 'var(--sim-text-heading)' }}>{simResult.lift ? Number(simResult.lift).toFixed(2) + 'x' : 'N/A'}</p>
                      </div>
                      <div className="flex-1 text-center px-4 py-3 rounded-2xl border" style={{ background: 'var(--sim-item-hover-bg)', border: '1px solid var(--sim-border)' }}>
                        <p className="text-[8px] font-bold uppercase mb-1" style={{ color: 'var(--sim-text-muted)' }}>Confidence</p>
                        <p className="text-sm font-black italic" style={{ color: 'var(--sim-text-heading)' }}>{Math.round(simResult.confidence * 100)}%</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-6 flex-1 bg-white/[0.01]">
                    <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                        <Brain size={12} style={{ color: 'var(--accent)' }} /> Strategic Rationale
                      </label>
                      <div className="p-6 rounded-3xl border shadow-inner" style={{ background: 'var(--sim-input-bg)', border: '1px solid var(--sim-input-border)' }}>
                        <p className="text-sm font-bold leading-relaxed italic" style={{ color: 'var(--sim-text-primary)' }}>
                          "{simResult.why}"
                        </p>
                      </div>
                    </div>
                  </div>


                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-10 rounded-[2.5rem] border border-white/5 bg-white/[0.02] border-dashed text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 border" style={{ background: 'var(--card-accent-bg)', borderColor: 'var(--glass-border)' }}>
                    <Sliders size={24} style={{ color: 'var(--text-faint)' }} />
                  </div>
                  <h3 className="text-xl font-black uppercase italic" style={{ color: 'var(--text-faint)' }}>Hypothesis Required</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest mt-2 max-w-[240px]" style={{ color: 'var(--text-faint)' }}>
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
