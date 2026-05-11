import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  UploadCloud, Loader2, Database, Lock,
  Trash2, Globe, EyeOff, Edit3, Save, X, FileSpreadsheet, Calendar, Check,
  User, ShieldOff, Eye, ChevronLeft, ChevronRight, AlertTriangle, Sparkles, CheckCircle, Info, AlertCircle, Brain, Zap, TrendingUp, Package
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const glass = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' };
const glassHover = 'hover:bg-white/[0.04] transition-all';

export default function DataManagement({ onDatasetChange, onActivate }) {
  const { token, role } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [datasetTitle, setDatasetTitle] = useState('');
  const [datasets, setDatasets] = useState([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [step, setStep] = useState(1); // 1: Scan, 2: Config, 3: Success, 4: Forecast
  const [scannedItems, setScannedItems] = useState([]);
  const [itemConfigs, setItemConfigs] = useState({});
  const [isScanning, setIsScanning] = useState(false);

  // Step 4 State
  const [selectedDatasetIds, setSelectedDatasetIds] = useState([]);
  const [runName, setRunName] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainForecast, setTrainForecast] = useState(false);
  const [trainBundler, setTrainBundler] = useState(false);
  const [forecastRuns, setForecastRuns] = useState([]);
  const [bundlerRuns, setBundlerRuns] = useState([]);
  const [refForecastId, setRefForecastId] = useState('none');
  const [minSupport, setMinSupport] = useState(1.0); // UI uses 1.0 (percent), backend uses 0.01
  const [persistBundler, setPersistBundler] = useState(false);
  const [error, setError] = useState(null);
  const [abortController, setAbortController] = useState(null);

  const [viewerData, setViewerData] = useState([]);
  const [viewerDatasetId, setViewerDatasetId] = useState(null);
  const [viewerPage, setViewerPage] = useState(1);
  const [viewerTotalRows, setViewerTotalRows] = useState(0);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  const [viewerYearFilter, setViewerYearFilter] = useState('');
  const [viewerAvailableYears, setViewerAvailableYears] = useState([]);
  const [viewerPageInput, setViewerPageInput] = useState('');
  const [viewerType, setViewerType] = useState('raw'); // 'raw' | 'aggregated' | 'global_aggregated'
  const [viewerSort, setViewerSort] = useState({ key: '', dir: 'DESC' });

  useEffect(() => {
    if (selectedDatasetIds.length > 0) {
      fetchForecastRuns(selectedDatasetIds[0]);
    }
  }, [selectedDatasetIds]);

  const fetchForecastRuns = async (datasetId) => {
    try {
      const res = await axios.get(`/api/forecast/runs?dataset_id=${datasetId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setForecastRuns(res.data.runs || []);
    } catch (err) {
      console.error("Failed to fetch forecast runs", err);
    }
  };

  const openViewer = async (datasetId, page = 1, year = '', type = viewerType, sort = null) => {
    setViewerDatasetId(datasetId);
    setViewerPage(page);
    setViewerYearFilter(year);
    setViewerType(type);

    const newSort = sort || viewerSort;
    setViewerSort(newSort);

    setShowViewer(true);
    setViewerLoading(true);
    try {
      if (datasetId !== viewerDatasetId && type === 'raw') {
        const yearsRes = await axios.get(`/api/datasets/${datasetId}/years`, { headers: { Authorization: `Bearer ${token}` } });
        setViewerAvailableYears(yearsRes.data.years || []);
      }

      let endpoint = 'data';
      if (type === 'aggregated') endpoint = 'aggregated';
      if (type === 'global_aggregated') endpoint = 'aggregated/global';

      const yearQuery = (year && type === 'raw') ? `&year=${year}` : '';
      const sortQuery = (type !== 'global_aggregated' && newSort.key) ? `&sort_by=${newSort.key}&sort_dir=${newSort.dir}` : '';
      const pagination = type === 'global_aggregated' ? '' : `?page=${page}&limit=50`;

      const res = await axios.get(`/api/datasets/${datasetId}/${endpoint}${pagination}${yearQuery}${sortQuery}`, { headers: { Authorization: `Bearer ${token}` } });
      setViewerData(res.data.data);
      setViewerTotalRows(res.data.total_rows);
    } catch (e) {
      console.error(e);
    } finally {
      setViewerLoading(false);
    }
  };

  const handleSort = (key) => {
    const dir = (viewerSort.key === key && viewerSort.dir === 'ASC') ? 'DESC' : 'ASC';
    openViewer(viewerDatasetId, 1, viewerYearFilter, viewerType, { key, dir });
  };

  const handlePageJump = (e) => {
    e.preventDefault();
    const p = parseInt(viewerPageInput);
    const maxPage = Math.ceil(viewerTotalRows / 50) || 1;
    if (p >= 1 && p <= maxPage) {
      openViewer(viewerDatasetId, p, viewerYearFilter);
      setViewerPageInput('');
    }
  };

  useEffect(() => { fetchDatasets(); }, []);

  const fetchDatasets = async () => {
    setLoadingDatasets(true);
    try {
      const r = await axios.get('/api/datasets', { headers: { Authorization: `Bearer ${token}` } });
      setDatasets(r.data.datasets);
    } catch (e) { console.error(e); } finally { setLoadingDatasets(false); }
  };

  const updateItemConfig = (item, field, value) => {
    setItemConfigs(prev => {
      const current = prev[item] || { availability: 'available', special: false, bundle: false, always: false };
      let next = { ...current };
      if (field === 'available') {
        next.availability = value ? 'available' : 'discontinued';
      } else if (field === 'status') {
        next.availability = value;
      } else {
        next[field] = value;
      }
      return { ...prev, [item]: next };
    });
  };

  const handleScan = async (e) => {
    if (!e.target.files?.length) return;
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setIsScanning(true);
    const formData = new FormData();
    selectedFiles.forEach(f => formData.append('files', f));
    try {
      const r = await axios.post('/api/ingest/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` }
      });
      const items = r.data.items;
      setScannedItems(items);
      const initialConfigs = {};
      items.forEach(item => { initialConfigs[item] = { availability: 'available', availability_type: 'always', bundle: false }; });
      setItemConfigs(initialConfigs);
      setStep(2);
    } catch (err) {
      alert(err.response?.data?.detail || 'Scan failed.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleUpload = async () => {
    if (!datasetTitle || files.length === 0) {
      setError("Please provide a title and at least one file.");
      return;
    }
    setError(null);
    setUploading(true);

    const controller = new AbortController();
    setAbortController(controller);

    const formData = new FormData();
    formData.append('title', datasetTitle);
    files.forEach(f => formData.append('files', f));
    formData.append('item_configs', JSON.stringify(itemConfigs));

    try {
      const res = await axios.post('/api/upload-data', formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
        signal: controller.signal
      });
      const newId = res.data.dataset_id;
      setSelectedDatasetIds([newId]);
      setFiles([]);
      setStep(3);
      fetchDatasets();
      if (onDatasetChange) onDatasetChange();
      // Automatically activate the newly uploaded dataset
      if (onActivate) onActivate(newId);
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log("Upload cancelled");
      } else {
        setError(err.response?.data?.detail || 'Upload failed.');
      }
    } finally {
      setUploading(false);
      setAbortController(null);
    }
  };

  const handleCancelOperation = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setUploading(false);
      setIsTraining(false);
      setTrainingProgress(0);
    }
  };

  const toggleForecaster = () => {
    const newState = !trainForecast;
    setTrainForecast(newState);
    if (!newState) {
      // If we turned off forecaster, we can't use "auto"
      setRefForecastId('none');
    } else {
      setRefForecastId('auto');
    }
  };

  const resetIngestion = () => {
    setFiles([]);
    setDatasetTitle('');
    setScannedItems([]);
    setItemConfigs({});
    setStep(1);
  };

  const handleTrain = async () => {
    setError(null);
    if (!runName) {
      setError("Please provide a name for the forecast run.");
      return;
    }
    if (selectedDatasetIds.length === 0) {
      setError("Please select at least one dataset to train on.");
      return;
    }

    setIsTraining(true);
    setTrainingProgress(10);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const interval = setInterval(() => {
        setTrainingProgress(prev => (prev < 90 ? prev + 1 : prev));
      }, 1500);

      const payload = {
        run_name: runName,
        dataset_ids: selectedDatasetIds.map(id => parseInt(id)),
        train_forecast: trainForecast,
        train_bundler: trainBundler,
        ref_forecast_id: refForecastId === 'auto' ? 'auto' : (refForecastId === 'none' ? 'none' : parseInt(refForecastId)),
        min_support: minSupport / 100
      };
      const res = await axios.post('/api/forecast/train', payload, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });

      clearInterval(interval);
      setTrainingProgress(100);
      setTimeout(() => {
        setIsTraining(false);
        if (trainBundler) {
          // Navigate to Qualitative with live results for tuning
          navigate('/qualitative', { 
            state: { 
              stagedBundles: res.data.bundles, 
              stagedName: runName, 
              stagedDatasetId: selectedDatasetIds[0],
              stagedRefId: refForecastId,
              autoSaved: res.data.auto_saved
            } 
          });
        } else if (trainForecast) {
          navigate('/analytics');
        } else {
          window.location.href = '/';
        }
      }, 1000);
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log("Training cancelled");
      } else {
        setError(err.response?.data?.detail || 'Training failed.');
      }
      setIsTraining(false);
      setTrainingProgress(0);
    } finally {
      setAbortController(null);
    }
  };


  const handleRenameRun = async (type, id, newName) => {
    try {
      const endpoint = type === 'forecast' ? `/api/forecast/runs/${id}/rename` : `/api/bundler/runs/${id}/rename`;
      await axios.put(endpoint, { name: newName }, { headers: { Authorization: `Bearer ${token}` } });
      if (type === 'forecast') {
        fetchForecastRuns(selectedDatasetIds[0]);
      } else {
        fetchBundlerRuns(selectedDatasetIds[0]);
      }
    } catch (err) {
      setError(`Failed to rename ${type} run.`);
    }
  };

  const handleDeleteRun = async (type, id) => {
    if (!window.confirm(`Are you sure you want to delete this ${type} record?`)) return;
    try {
      const endpoint = type === 'forecast' ? `/api/forecast/runs/${id}` : `/api/bundler/runs/${id}`;
      await axios.delete(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      if (type === 'forecast') {
        fetchForecastRuns(selectedDatasetIds[0]);
      } else {
        fetchBundlerRuns(selectedDatasetIds[0]);
      }
    } catch (err) {
      setError(`Failed to delete ${type} run.`);
    }
  };

  const handleDeleteDataset = async (datasetId) => {
    if (!window.confirm("ARE YOU SURE? This will permanently purge this dataset and all associated strategic records.")) return;
    try {
      await axios.delete(`/api/datasets/${datasetId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDatasets();
      // Clear selection if deleted
      setSelectedDatasetIds(prev => prev.filter(id => id !== datasetId));
    } catch (err) {
      setError("Failed to delete dataset.");
    }
  };

  const fetchBundlerRuns = async (datasetId) => {
    try {
      const res = await axios.get(`/api/bundler/runs?dataset_id=${datasetId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBundlerRuns(res.data.runs || []);
    } catch (err) {
      console.error("Failed to fetch bundler runs", err);
    }
  };

  useEffect(() => {
    if (selectedDatasetIds.length > 0) {
      fetchBundlerRuns(selectedDatasetIds[0]);
    }
  }, [selectedDatasetIds]);

  const handleTogglePrivacy = async (id, currentPrivate) => {
    try {
      await axios.patch(`/api/datasets/${id}`, { is_private: !currentPrivate }, { headers: { Authorization: `Bearer ${token}` } });
      fetchDatasets();
    } catch (err) { alert(err.response?.data?.detail || 'Failed to update privacy'); }
  };

  const startEditing = (ds) => { setEditingId(ds.id); setEditTitle(ds.title); };

  const saveTitle = async (id) => {
    try {
      await axios.patch(`/api/datasets/${id}`, { title: editTitle }, { headers: { Authorization: `Bearer ${token}` } });
      setEditingId(null); fetchDatasets();
    } catch (err) { alert(err.response?.data?.detail || 'Failed to rename'); }
  };

  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f4f5' };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <div className="relative rounded-[2rem] p-8 overflow-hidden" style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.12) 0%,rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
          <Database className="text-indigo-400" size={28} /> Strategic Management Hub
        </h2>
        <p className="text-zinc-500 text-sm mt-1 ml-10">Consolidate historical logs, launch predictive models, and manage product bundling rules.</p>

        {/* TAB TOGGLE */}
        <div className="flex gap-1 bg-black/20 p-1 rounded-2xl border border-white/5 mt-6 w-fit">
          <button
            onClick={() => setStep(1)}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${step < 4 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <UploadCloud size={14} className="inline mr-2" /> Data Ingestion
          </button>
          <button
            onClick={() => setStep(4)}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${step === 4 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Sparkles size={14} className="inline mr-2" /> Model Training
          </button>
        </div>
      </div>

      {role === 'ADMIN' ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4 mb-8 px-2">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all ${step >= s ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-zinc-800 text-zinc-600'}`}>
                  {s}
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest ${step >= s ? 'text-indigo-400' : 'text-zinc-600'}`}>
                  {s === 1 ? 'Scan File' : 'Configure Items'}
                </span>
                {s === 1 && <div className={`w-8 h-px ${step > 1 ? 'bg-indigo-500' : 'bg-zinc-800'}`} />}
              </div>
            ))}
          </div>

          {step === 1 ? (
            <div className="p-10 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center text-center transition-all hover:border-indigo-500/50 group" style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                <UploadCloud size={32} />
              </div>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Source Selection</h3>
              <p className="text-zinc-500 text-sm mt-2 mb-8 max-w-xs">Upload your transaction logs to begin the Optima ingestion pipeline.</p>
              <input type="file" multiple id="file-upload" className="hidden" onChange={handleScan} accept=".csv,.xlsx,.xls" disabled={isScanning} />
              <label htmlFor="file-upload" className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer transition-all shadow-xl flex items-center gap-3 ${isScanning ? 'bg-zinc-800 text-zinc-500 cursor-wait' : 'bg-white text-black hover:bg-indigo-50 shadow-white/5'}`}>
                {isScanning ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Analyzing Files...
                  </>
                ) : (
                  'Select Local Files'
                )}
              </label>
            </div>
          ) : step === 2 ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white uppercase italic">Item Configuration</h3>
                  <p className="text-xs text-zinc-500">Define properties for {scannedItems.length} detected products</p>
                </div>
                <button onClick={() => setStep(1)} className="text-xs font-bold text-zinc-500 hover:text-white transition-colors">Back</button>
              </div>

              <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                {scannedItems.map(item => {
                  const config = itemConfigs[item] || { availability: 'available', special: false, bundle: false, always: false };
                  const isAvailable = config.availability !== 'discontinued' && config.availability !== 'stockout';
                  return (
                    <div key={item} className="p-5 rounded-3xl space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-zinc-200 text-sm truncate pr-4">{item}</h4>
                        <div className="flex items-center gap-3 bg-black/40 p-1.5 rounded-2xl border border-white/5">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 ${isAvailable ? 'text-zinc-600' : 'text-rose-400'}`}>Unavailable</span>
                          <button
                            onClick={() => updateItemConfig(item, 'available', !isAvailable)}
                            className={`relative w-12 h-6 rounded-full transition-all duration-300 ${isAvailable ? 'bg-indigo-600 shadow-lg shadow-indigo-600/40' : 'bg-zinc-800'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm ${isAvailable ? 'left-7' : 'left-1'}`} />
                          </button>
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 ${isAvailable ? 'text-indigo-400' : 'text-zinc-600'}`}>Available</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {isAvailable ? (
                          <div className="col-span-2 space-y-3">
                            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Availability Strategy</label>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { id: 'always', label: 'Always Available', color: 'emerald' },
                                { id: 'seasonal', label: 'Seasonal Item', color: 'amber' },
                                { id: 'high_velocity', label: 'High Velocity', color: 'indigo' }
                              ].map(strat => (
                                <button
                                  key={strat.id}
                                  onClick={() => updateItemConfig(item, 'availability_type', strat.id)}
                                  className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${config.availability_type === strat.id ? `bg-${strat.color}-500/10 border-${strat.color}-500/50 text-${strat.color}-400` : 'border-white/5 text-zinc-600'}`}
                                >
                                  {strat.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="col-span-2 space-y-2">
                            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Status</label>
                            <button
                              className="w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest bg-rose-500/10 border border-rose-500/50 text-rose-400"
                            >
                              Discontinued / No longer sold
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="pt-2 border-t border-white/5">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input type="checkbox" checked={config.bundle} onChange={(e) => updateItemConfig(item, 'bundle', e.target.checked)} className="hidden" />
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${config.bundle ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-700'}`}>
                            {config.bundle && <Check size={10} className="text-white" />}
                          </div>
                          <span className="text-[10px] font-bold text-zinc-500 uppercase">Mark as Bundle / Set</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pt-6 border-t border-white/5 space-y-4">
                <input type="text" value={datasetTitle} onChange={(e) => setDatasetTitle(e.target.value)}
                  placeholder="Dataset Display Title (e.g. Sales Q1 2026)"
                  className="w-full px-5 py-4 rounded-2xl outline-none text-sm font-bold"
                  style={inputStyle} />

                {uploading ? (
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-3 text-indigo-400 font-black text-[10px] uppercase tracking-widest">
                      <Loader2 size={16} className="animate-spin" /> Ingesting & Aggregating...
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 animate-pulse" style={{ width: '60%' }} />
                    </div>
                    <button
                      onClick={handleCancelOperation}
                      className="text-[9px] font-black text-zinc-500 hover:text-rose-400 uppercase tracking-widest mt-2"
                    >
                      Cancel Upload
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleUpload}
                    className="w-full py-5 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-50 transition-all active:scale-95"
                  >
                    Commit Dataset
                  </button>
                )}
              </div>
            </div>
          ) : step === 4 ? (
            <div className="animate-in zoom-in-95 duration-500 w-full mx-auto space-y-8 px-4">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mx-auto mb-4 border border-indigo-500/20 shadow-2xl">
                  <Brain size={32} />
                </div>
                <h3 className="text-4xl font-black text-white uppercase italic tracking-tight">Intelligence Hub</h3>
                <p className="text-zinc-500 text-sm font-medium">Architecting persistent strategic models across your data landscape.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                {/* COLUMN 1: DATA MASTERY */}
                <div className="p-8 rounded-[2.5rem] space-y-6 flex flex-col h-full" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block">1. Data Mastery</label>
                    <Database size={14} className="text-zinc-600" />
                  </div>
                  
                  <div className="space-y-4 flex-1 flex flex-col min-h-0">
                    <div className="space-y-2">
                      <p className="text-[9px] font-bold text-zinc-600 uppercase ml-1">Active Sources</p>
                      <div className="space-y-2 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                        {datasets.filter(ds => ds.dataset_type === 'MASTER' || !ds.dataset_type).map(ds => (
                          <label key={ds.id} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${selectedDatasetIds.includes(ds.id) ? 'bg-indigo-500/10 border-indigo-500/30 text-white' : 'bg-black/20 border-white/5 text-zinc-500 hover:border-white/10'}`}>
                            <input
                              type="checkbox"
                              checked={selectedDatasetIds.includes(ds.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedDatasetIds([...selectedDatasetIds, ds.id]);
                                else setSelectedDatasetIds(selectedDatasetIds.filter(id => id !== ds.id));
                              }}
                              className="rounded accent-indigo-500"
                            />
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold truncate uppercase">{ds.title}</p>
                              <p className="text-[9px] text-zinc-600 tracking-wider">{ds.row_count.toLocaleString()} ROWS</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 space-y-2">
                      <p className="text-[9px] font-bold text-zinc-600 uppercase ml-1">Data Inventory</p>
                      <div className="grid grid-cols-1 gap-2">
                        {datasets.map(ds => (
                          <div key={ds.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between group">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase truncate max-w-[120px]">{ds.title}</span>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleDeleteDataset(ds.id)} className="text-rose-500/50 hover:text-rose-500 transition-colors">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: PREDICTIVE INTELLIGENCE */}
                <div className="p-8 rounded-[2.5rem] space-y-6 flex flex-col h-full" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block">2. Predictive Intelligence</label>
                    <TrendingUp size={14} className="text-zinc-600" />
                  </div>

                  <div className="space-y-4 flex-1 flex flex-col min-h-0">
                    <button 
                      onClick={toggleForecaster}
                      className={`w-full flex items-center justify-between p-6 rounded-[2rem] border transition-all duration-300 group hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                        trainForecast 
                          ? 'bg-indigo-600/10 border-indigo-500/40 shadow-[0_0_25px_rgba(99,102,241,0.15)]' 
                          : 'bg-black/20 border-white/15 hover:border-white/30 hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                          trainForecast ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40' : 'bg-zinc-800 text-zinc-600'
                        }`}>
                          <Brain size={20} />
                        </div>
                        <div className="flex flex-col text-left">
                          <span className={`text-xs font-black uppercase tracking-widest ${trainForecast ? 'text-white' : 'text-zinc-500'}`}>Forecaster</span>
                          <span className="text-[9px] font-bold opacity-40 uppercase">Demand Predictions</span>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        trainForecast ? 'border-indigo-500 bg-indigo-500' : 'border-white/20 bg-transparent'
                      }`}>
                        {trainForecast && <Check size={14} className="text-white" />}
                      </div>
                    </button>

                    <div className="pt-4 flex-1 flex flex-col min-h-0">
                      <p className="text-[9px] font-bold text-zinc-600 uppercase ml-1 mb-2">Forecasting Records</p>
                      <div className="space-y-2 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                        {forecastRuns.map(run => (
                          <div key={run.id} className="p-4 rounded-2xl bg-black/20 border border-white/5 group hover:border-indigo-500/30 transition-all">
                            <div className="flex items-center justify-between mb-2">
                              <input 
                                className="bg-transparent border-none outline-none text-[10px] font-black text-white uppercase tracking-tight w-full"
                                value={run.name}
                                onChange={(e) => handleRenameRun('forecast', run.id, e.target.value)}
                              />
                              <button onClick={() => handleDeleteRun('forecast', run.id)} className="text-rose-500/40 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 size={12} />
                              </button>
                            </div>
                            <div className="flex justify-between items-center text-[8px] font-bold text-zinc-600 uppercase tracking-widest">
                              <span>{new Date(run.created_at).toLocaleDateString()}</span>
                              <span className="text-emerald-500/60">{run.status}</span>
                            </div>
                          </div>
                        ))}
                        {forecastRuns.length === 0 && (
                          <div className="py-12 text-center space-y-2">
                            <EyeOff size={24} className="text-zinc-800 mx-auto" />
                            <p className="text-[9px] font-bold text-zinc-700 uppercase">No records found</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* COLUMN 3: STRATEGIC LOGIC */}
                <div className="p-8 rounded-[2.5rem] space-y-6 flex flex-col h-full" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block">3. Strategic Logic</label>
                    <Zap size={14} className="text-zinc-600" />
                  </div>

                  <div className="space-y-4 flex-1 flex flex-col min-h-0">
                    <button 
                      onClick={() => setTrainBundler(!trainBundler)}
                      className={`w-full flex items-center justify-between p-6 rounded-[2rem] border transition-all duration-300 group hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                        trainBundler 
                          ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.15)]' 
                          : 'bg-black/20 border-white/15 hover:border-white/30 hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                          trainBundler ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40' : 'bg-zinc-800 text-zinc-600'
                        }`}>
                          <Zap size={20} />
                        </div>
                        <div className="flex flex-col text-left">
                          <span className={`text-xs font-black uppercase tracking-widest ${trainBundler ? 'text-white' : 'text-zinc-500'}`}>Bundler</span>
                          <span className="text-[9px] font-bold opacity-40 uppercase">Affinity Logic</span>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        trainBundler ? 'border-emerald-500 bg-emerald-500' : 'border-white/20 bg-transparent'
                      }`}>
                        {trainBundler && <Check size={14} className="text-white" />}
                      </div>
                    </button>

                    {trainBundler && (
                      <div className="space-y-4 pt-4 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center px-1">
                            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Discovery Sensitivity</label>
                            <div className="flex items-center gap-2 bg-emerald-500 rounded-full px-3 py-1 shadow-lg shadow-emerald-500/20">
                              <input 
                                type="number" 
                                step="0.1"
                                min="0.001"
                                value={minSupport}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setMinSupport(isNaN(val) ? 0.001 : Math.max(0.001, val));
                                }}
                                className="bg-transparent border-none outline-none text-[10px] font-black text-white w-10 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span className="text-[10px] font-black text-white/60">%</span>
                            </div>
                          </div>
                          <input 
                            type="range" min="0.1" max="10" step="0.1" 
                            value={minSupport > 10 ? 10 : minSupport} 
                            onChange={(e) => setMinSupport(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-emerald-500" 
                          />
                          <div className="flex justify-between text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">
                            <span>Broad Discovery</span>
                            <span>Conservative</span>
                          </div>
                        </div>

                        <div className="space-y-2 py-2">
                          <label className="text-[9px] font-bold text-zinc-600 uppercase ml-1 flex items-center gap-2">
                            Ranking Reference
                            <Info size={10} className="text-zinc-500" />
                          </label>
                          <select 
                            value={refForecastId}
                            onChange={(e) => setRefForecastId(e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-3 text-[10px] font-black text-white outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
                          >
                            {trainForecast && <option value="auto">AUTO: CURRENT TRAINING</option>}
                            <option value="none">NONE (HISTORICAL DISCOVERY)</option>
                            {forecastRuns.map(run => (
                              <option key={run.id} value={run.id}>{run.name.toUpperCase()}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 flex-1 flex flex-col min-h-0">
                      <p className="text-[9px] font-bold text-zinc-600 uppercase ml-1 mb-2">Bundling Records</p>
                      <div className="space-y-2 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                        {bundlerRuns.map(run => (
                          <div key={run.id} className="p-4 rounded-2xl bg-black/20 border border-white/5 group hover:border-emerald-500/30 transition-all">
                            <div className="flex items-center justify-between mb-2">
                              <input 
                                className="bg-transparent border-none outline-none text-[10px] font-black text-white uppercase tracking-tight w-full"
                                value={run.name}
                                onChange={(e) => handleRenameRun('bundler', run.id, e.target.value)}
                              />
                              <button onClick={() => handleDeleteRun('bundler', run.id)} className="text-rose-500/40 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 size={12} />
                              </button>
                            </div>
                            <div className="flex justify-between items-center text-[8px] font-bold text-zinc-600 uppercase tracking-widest">
                              <span>{new Date(run.created_at).toLocaleDateString()}</span>
                              <span className="text-indigo-400/60">SESSION</span>
                            </div>
                          </div>
                        ))}
                        {bundlerRuns.length === 0 && (
                          <div className="py-12 text-center space-y-2">
                            <EyeOff size={24} className="text-zinc-800 mx-auto" />
                            <p className="text-[9px] font-bold text-zinc-700 uppercase">No records found</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTION BAR */}
              <div className="p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-bottom-4 duration-700" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                <div className="flex-1 space-y-2 w-full md:w-auto">
                  <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1 block">Active Run Title</label>
                  <input
                    type="text"
                    placeholder="E.G. 2026 STRATEGIC SWEEP"
                    value={runName}
                    onChange={(e) => setRunName(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-sm font-black text-white outline-none focus:border-indigo-500/50 transition-all uppercase tracking-tight"
                  />
                </div>

                <div className="flex flex-col items-center gap-4 w-full md:w-auto">
                  {error && (
                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-3">
                      <AlertCircle size={14} className="shrink-0" />
                      <p className="text-[10px] font-black uppercase tracking-tight">{error}</p>
                    </div>
                  )}

                  {isTraining ? (
                    <div className="w-full md:w-80 space-y-4">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em]">
                        <span className="text-indigo-400 animate-pulse">EXECUTING PIPELINE...</span>
                        <span className="text-zinc-500">{Math.round(trainingProgress)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${trainingProgress}%` }} />
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleTrain}
                      disabled={selectedDatasetIds.length === 0 || !runName || (!trainForecast && !trainBundler)}
                      className="w-full md:w-80 py-5 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(255,255,255,0.1)] hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-20 disabled:grayscale"
                    >
                      Initialize Strategic Run
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in zoom-in duration-700 flex flex-col items-center justify-center p-20 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <CheckCircle size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">Dataset Ingested</h3>
                <p className="text-zinc-500 text-sm max-w-xs mx-auto">Your records are now locked in the Optima vault. Proceed to build your forecast.</p>
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <button
                  onClick={() => setStep(4)}
                  className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
                >
                  Start Training
                </button>
                <button
                  onClick={resetIngestion}
                  className="px-10 py-4 bg-white/5 text-zinc-400 border border-white/5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Upload More Data
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-3xl p-10 flex flex-col items-center justify-center text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="p-4 rounded-full mb-5" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <Lock size={28} className="text-zinc-500" />
          </div>
          <h3 className="text-xl font-black text-zinc-200 mb-2">Dataset Browser</h3>
          <p className="text-zinc-500 text-sm max-w-md">You are viewing the shared dataset inventory. Administrators manage data ingestion.</p>
        </div>
      )}

      {/* DATASET INVENTORY */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Database size={16} className="text-indigo-400" /> Dataset Inventory
            {loadingDatasets && <Loader2 className="animate-spin text-zinc-600" size={16} />}
          </h3>
          <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{datasets.length} datasets</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.isArray(datasets) && datasets.map((ds) => (
            <div key={ds.id} className="rounded-2xl p-5 flex items-center gap-4 hover:bg-white/5 transition-all" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="p-3 rounded-xl flex-shrink-0" style={{ background: 'rgba(99,102,241,0.1)' }}>
                <FileSpreadsheet size={22} className="text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                {editingId === ds.id ? (
                  <div className="flex items-center gap-2">
                    <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                      className="font-bold text-white rounded-lg px-2 py-1 outline-none w-full text-sm"
                      style={inputStyle} autoFocus />
                    <button onClick={() => saveTitle(ds.id)} className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-400/10"><Save size={16} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-400/10"><X size={16} /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-white text-sm truncate">{ds.title}</h4>
                      {ds.is_active && <span className="text-[9px] font-black text-emerald-400 px-2 py-0.5 rounded-full uppercase" style={{ background: 'rgba(52,211,153,0.1)' }}>● Active</span>}
                      {ds.is_private
                        ? <span className="text-[9px] font-black text-amber-400 px-2 py-0.5 rounded-full uppercase" style={{ background: 'rgba(251,191,36,0.1)' }}><EyeOff size={8} className="inline mr-0.5" />Private</span>
                        : <span className="text-[9px] font-black text-emerald-400 px-2 py-0.5 rounded-full uppercase" style={{ background: 'rgba(52,211,153,0.08)' }}><Globe size={8} className="inline mr-0.5" />Public</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-[10px] text-zinc-600 font-medium items-center">
                      <span className="flex items-center gap-1"><Database size={10} />{(ds.row_count || 0).toLocaleString()} rows</span>
                      <span className="flex items-center gap-1"><Calendar size={10} />{ds.upload_date ? new Date(ds.upload_date).toLocaleDateString() : 'N/A'}</span>
                      <span className="flex items-center gap-1"><User size={10} />{ds.uploader || 'System'}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openViewer(ds.id, 1)} className="p-2 rounded-lg text-zinc-600 hover:text-indigo-400 hover:bg-indigo-400/10 transition-all" title="View Data"><Eye size={15} /></button>
                {role === 'ADMIN' && (
                  <>
                    <button onClick={() => startEditing(ds)} className="p-2 rounded-lg text-zinc-600 hover:text-indigo-400 hover:bg-indigo-400/10 transition-all" title="Rename"><Edit3 size={15} /></button>
                    <button onClick={() => handleTogglePrivacy(ds.id, ds.is_private)} className={`p-2 rounded-lg transition-all ${ds.is_private ? 'text-amber-400 hover:bg-amber-400/10' : 'text-zinc-600 hover:text-emerald-400 hover:bg-emerald-400/10'}`}>{ds.is_private ? <EyeOff size={15} /> : <Globe size={15} />}</button>
                    {deleteConfirmId === ds.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { handleDeleteDataset(ds.id); setDeleteConfirmId(null); }} className="p-2 rounded-lg text-rose-400 bg-rose-400/10 hover:bg-rose-400/20 transition-all"><Check size={14} /></button>
                        <button onClick={() => setDeleteConfirmId(null)} className="p-2 rounded-lg text-zinc-600 hover:bg-white/5 transition-all"><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirmId(ds.id)} className="p-2 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-400/10 transition-all"><Trash2 size={15} /></button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {datasets.length === 0 && !loadingDatasets && (
            <div className="col-span-full py-16 rounded-2xl border-2 border-dashed text-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <Database className="mx-auto text-zinc-700 mb-3" size={40} />
              <p className="text-zinc-600 font-bold text-sm">No datasets uploaded yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* VIEWER MODAL */}
      {showViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-6xl max-h-[90vh] flex flex-col rounded-3xl p-6" style={{ background: 'var(--modal-bg)', border: `1px solid var(--border-strong)` }}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-6">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2"><Database size={20} className="text-indigo-400" /> Data Explorer</h3>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase font-black tracking-widest">
                    {viewerType === 'raw' ? 'Transaction Audit' : 'Monthly Performance Aggregates'} • {viewerTotalRows.toLocaleString()} Rows
                  </p>
                </div>

                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => openViewer(viewerDatasetId, 1, '', 'raw')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewerType === 'raw' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Raw
                  </button>
                  <button
                    onClick={() => openViewer(viewerDatasetId, 1, '', 'aggregated')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewerType === 'aggregated' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Monthly (Items)
                  </button>
                  <button
                    onClick={() => openViewer(viewerDatasetId, 1, '', 'global_aggregated')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewerType === 'global_aggregated' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Monthly (Global)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {viewerType === 'raw' && viewerAvailableYears.length > 0 && (
                  <select
                    value={viewerYearFilter}
                    onChange={(e) => openViewer(viewerDatasetId, 1, e.target.value)}
                    className="border text-xs font-bold rounded-xl px-3 py-2 outline-none"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}
                  >
                    <option value="">All Years</option>
                    {viewerAvailableYears.map(yr => <option key={yr} value={yr}>{yr}</option>)}
                  </select>
                )}
                <button onClick={() => setShowViewer(false)} className="text-zinc-500 hover:text-white p-2 rounded-xl hover:bg-white/5 border border-white/5"><X size={20} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border" style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
              {viewerLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                  <Loader2 size={30} className="animate-spin mb-4" />
                  <p className="text-sm font-bold">Loading Data...</p>
                </div>
              ) : viewerData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                  <p className="text-sm font-bold">No data found.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="text-xs font-black uppercase text-zinc-500 sticky top-0" style={{ background: 'var(--table-header-bg)' }}>
                    <tr>
                      {Object.keys(viewerData[0]).map(k => (
                        <th key={k}
                          onClick={() => handleSort(k)}
                          className="px-4 py-3 border-b border-white/5 cursor-pointer hover:text-white transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            {k.replace('_', ' ')}
                            <span className={`text-[8px] transition-opacity ${viewerSort.key === k ? 'opacity-100 text-indigo-400' : 'opacity-0 group-hover:opacity-50'}`}>
                              {viewerSort.dir === 'ASC' ? '▲' : '▼'}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    {viewerData.map((row, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-4 py-3">{val !== null && val !== undefined ? String(val) : '-'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {viewerType !== 'global_aggregated' && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500">Page {viewerPage} of {Math.ceil(viewerTotalRows / 50) || 1}</span>
                <div className="flex items-center gap-4">
                  <form onSubmit={handlePageJump} className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max={Math.ceil(viewerTotalRows / 50) || 1}
                      value={viewerPageInput}
                      onChange={(e) => setViewerPageInput(e.target.value)}
                      placeholder="Go to page..."
                      className="border text-xs font-bold rounded-xl px-3 py-2 outline-none w-28"
                      style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}
                    />
                    <button type="submit" className="text-xs font-bold bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-xl transition-all">Go</button>
                  </form>
                  <div className="flex gap-2">
                    <button
                      disabled={viewerPage === 1 || viewerLoading}
                      onClick={() => openViewer(viewerDatasetId, viewerPage - 1, viewerYearFilter)}
                      className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-white/5 hover:bg-white/10 disabled:opacity-50 flex items-center gap-1 transition-all"
                    >
                      <ChevronLeft size={16} /> Prev
                    </button>
                    <button
                      disabled={viewerPage >= (Math.ceil(viewerTotalRows / 50) || 1) || viewerLoading}
                      onClick={() => openViewer(viewerDatasetId, viewerPage + 1, viewerYearFilter)}
                      className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-white/5 hover:bg-white/10 disabled:opacity-50 flex items-center gap-1 transition-all"
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
