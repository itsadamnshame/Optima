import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  UploadCloud, Loader2, Database, Lock,
  Trash2, Globe, EyeOff, Edit3, Save, X, FileSpreadsheet, Calendar, Check, Package,
  User, ShieldOff, Eye, ChevronLeft, ChevronRight, AlertTriangle, Sparkles, CheckCircle, Info, AlertCircle, Brain, Zap, TrendingUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const glass = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(12px)' };
const glassHover = 'hover:bg-[var(--glass-bg-hover)] transition-all';

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

  const [step, setStep] = useState(1); // 1: Upload, 2: Commit, 3: Training
  const [scannedItems, setScannedItems] = useState([]);
  const [isScanning, setIsScanning] = useState(false);

  // Training State
  const [selectedDatasetIds, setSelectedDatasetIds] = useState([]);
  const [runName, setRunName] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainForecast, setTrainForecast] = useState(false);
  const [trainBundler, setTrainBundler] = useState(false);
  const [forecastRuns, setForecastRuns] = useState([]);
  const [bundlerRuns, setBundlerRuns] = useState([]);
  const [refForecastId, setRefForecastId] = useState('none');
  const [minSupport, setMinSupport] = useState(1.0);
  const [persistBundler, setPersistBundler] = useState(false);
  const [error, setError] = useState(null);
  const [abortController, setAbortController] = useState(null);
  const [showNavigationModal, setShowNavigationModal] = useState(false);
  const [navigationData, setNavigationData] = useState(null);

  // Viewer State
  const [viewerData, setViewerData] = useState([]);
  const [viewerDatasetId, setViewerDatasetId] = useState(null);
  const [viewerPage, setViewerPage] = useState(1);
  const [viewerTotalRows, setViewerTotalRows] = useState(0);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [viewerYearFilter, setViewerYearFilter] = useState('');
  const [viewerAvailableYears, setViewerAvailableYears] = useState([]);
  const [viewerPageInput, setViewerPageInput] = useState('');
  const [viewerType, setViewerType] = useState('raw');
  const [viewerSort, setViewerSort] = useState({ key: '', dir: 'DESC' });
  const [showInventory, setShowInventory] = useState(false);

  // Metadata State
  const [itemConfigs, setItemConfigs] = useState({});
  const [localItemConfigs, setLocalItemConfigs] = useState({});
  const [defaultItemConfigs, setDefaultItemConfigs] = useState({});
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);

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

  const updateItemConfig = (item, key, value) => {
    setItemConfigs(prev => {
      const current = prev[item] || { bundle: false, is_not_product: false };
      const next = { ...current, [key]: value };
      if (key === 'bundle' && value === true) next.is_not_product = false;
      if (key === 'is_not_product' && value === true) next.bundle = false;
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
      const r = await axios.post('/api/scan-items', formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` }
      });
      const items = r.data.items;
      setScannedItems(items);

      const initialConfigs = {};
      items.forEach(item => {
        initialConfigs[item] = { bundle: false, is_not_product: false };
      });
      setItemConfigs(initialConfigs);
      setStep(2);
    } catch (err) {
      console.error(err);
      setError("Failed to scan items. Please check your files.");
    } finally {
      setIsScanning(false);
    }
  };

  const openConfigModal = async (datasetIds) => {
    if (datasetIds.length === 0) return;
    const datasetId = datasetIds[0];
    setShowConfigModal(true);
    setConfigLoading(true);
    try {
      const res = await axios.get(`/api/datasets/${datasetId}/metadata`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLocalItemConfigs(res.data);
      setDefaultItemConfigs(res.data);
      setViewerDatasetId(datasetId);
    } catch (err) {
      console.error("Failed to load metadata", err);
    } finally {
      setConfigLoading(false);
    }
  };

  const updateLocalConfig = (item, key, value) => {
    setLocalItemConfigs(prev => {
      const current = prev[item] || { bundle: false, is_not_product: false };
      const next = { ...current, [key]: value };
      if (key === 'bundle' && value === true) next.is_not_product = false;
      if (key === 'is_not_product' && value === true) next.bundle = false;
      return { ...prev, [item]: next };
    });
  };

  const saveConfigOverride = async () => {
    if (!viewerDatasetId) return;
    try {
      await axios.post(`/api/datasets/${viewerDatasetId}/metadata`, localItemConfigs, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowConfigModal(false);
    } catch (err) {
      alert("Failed to save configuration changes.");
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
  };

  const resetIngestion = () => {
    setFiles([]);
    setDatasetTitle('');
    setScannedItems([]);
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

    let progressInterval = null;
    try {
      progressInterval = setInterval(() => {
        setTrainingProgress(prev => (prev < 90 ? prev + 1 : prev));
      }, 1500);

      const payload = {
        run_name: runName,
        dataset_ids: selectedDatasetIds.map(id => parseInt(id)),
        item_configs: itemConfigs,
        train_forecast: trainForecast,
        train_bundler: trainBundler,
        save_bundler: persistBundler,
        ref_forecast_id: refForecastId === 'auto' ? 'auto' : (refForecastId === 'none' ? 'none' : parseInt(refForecastId)),
        min_support: minSupport / 100
      };
      const res = await axios.post('/api/forecast/train', payload, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
        // 30 minutes — training can take a long time; we don't want the browser
        // to drop the connection and falsely report a failure while the backend
        // is still crunching.
        timeout: 30 * 60 * 1000,
      });

      clearInterval(progressInterval);
      setTrainingProgress(100);
      setTimeout(() => {
        setIsTraining(false);
        if (trainForecast && trainBundler) {
          setNavigationData({
            bundles: res.data.bundles,
            name: runName,
            datasetId: selectedDatasetIds[0],
            refId: refForecastId,
            autoSaved: res.data.auto_saved
          });
          setShowNavigationModal(true);
        } else if (trainBundler) {
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
      if (progressInterval) clearInterval(progressInterval);
      if (axios.isCancel(err)) {
        // User explicitly cancelled — just reset
        console.log("Training cancelled");
        setIsTraining(false);
        setTrainingProgress(0);
      } else if (!err.response || (err.response.status >= 500 && err.response.status <= 504)) {
        // No response = network drop / connection reset while the backend was still running.
        // Or 500/502/504 gateway timeout / internal error.
        // The backend is almost certainly still processing. Check the runs endpoint periodically.
        // Keep isTraining active and do not set an error message; just poll in the background.
        setTrainingProgress(95);
        setError(null);
        
        let attempts = 0;
        const maxAttempts = 120; // Poll for up to 600 seconds (120 * 5s)
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const isBundlerRun = trainBundler;
            const endpoint = isBundlerRun
              ? `/api/bundler/runs?dataset_id=${selectedDatasetIds[0]}`
              : `/api/forecast/runs?dataset_id=${selectedDatasetIds[0]}`;
            
            const checkRes = await axios.get(endpoint, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const runs = checkRes.data.runs || [];
            const matchingRun = runs.find(r => r.name === runName);
            if (matchingRun) {
              clearInterval(pollInterval);
              setTrainingProgress(100);
              setError(null);
              setIsTraining(false);
              
              if (trainForecast && trainBundler) {
                // Fetch bundler results for this run to stage them
                const resDetails = await axios.get(`/api/bundler/runs/${matchingRun.id}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                setNavigationData({
                  bundles: resDetails.data.bundles,
                  name: runName,
                  datasetId: selectedDatasetIds[0],
                  refId: refForecastId,
                  autoSaved: true
                });
                setShowNavigationModal(true);
              } else if (trainBundler) {
                // Fetch bundler results for this run to stage them
                const resDetails = await axios.get(`/api/bundler/runs/${matchingRun.id}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                navigate('/qualitative', {
                  state: {
                    stagedBundles: resDetails.data.bundles,
                    stagedName: runName,
                    stagedDatasetId: selectedDatasetIds[0],
                    stagedRefId: refForecastId,
                    autoSaved: true
                  }
                });
              } else if (trainForecast) {
                navigate('/analytics');
              } else {
                window.location.href = '/';
              }
              return;
            }
          } catch (pollErr) {
            console.error("Polling error", pollErr);
          }
          
          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setIsTraining(false);
            setTrainingProgress(0);
            setError(
              "Connection to the server was lost mid-run and we could not verify completion. " +
              "Please check the Forecasting or Product Bundler pages to see if the run eventually appears."
            );
          }
        }, 5000);
      } else {
        // A real HTTP error (4xx) — the backend explicitly rejected or crashed.
        setError(err.response?.data?.detail || 'Training failed.');
        setIsTraining(false);
        setTrainingProgress(0);
      }
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

  const inputStyle = { background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <div className="relative rounded-[2rem] p-8 overflow-hidden" style={{ background: 'var(--gradient-hero)', border: '1px solid var(--border)' }}>
        <h2 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ color: 'var(--text-heading)' }}>
          <Database className="text-indigo-400" size={28} /> Strategic Management Hub
        </h2>
        <p className="text-sm mt-1 ml-10" style={{ color: 'var(--text-secondary)' }}>Consolidate historical logs, launch predictive models, and manage product bundling rules.</p>

        {/* TAB TOGGLE */}
        <div className="flex gap-1 p-1 rounded-2xl border mt-6 w-fit" style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)' }}>
          <button
            onClick={() => setStep(1)}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${step < 3 ? 'text-white shadow-lg' : 'hover:bg-[var(--glass-bg-hover)]'}`}
            style={{ background: step < 3 ? 'var(--accent)' : 'transparent', color: step < 3 ? '#fff' : 'var(--text-muted)', boxShadow: step < 3 ? '0 10px 15px -3px var(--accent-glow)' : 'none' }}
          >
            <UploadCloud size={14} className="inline mr-2" /> Data Ingestion
          </button>
          <button
            onClick={() => setStep(3)}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${step === 3 ? 'text-white shadow-lg' : 'hover:bg-[var(--glass-bg-hover)]'}`}
            style={{ background: step === 3 ? 'var(--accent)' : 'transparent', color: step === 3 ? '#fff' : 'var(--text-muted)', boxShadow: step === 3 ? '0 10px 15px -3px var(--accent-glow)' : 'none' }}
          >
            <Sparkles size={14} className="inline mr-2" /> Model Training
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-4">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all ${step >= s ? 'text-white shadow-lg' : ''}`}
                  style={{ background: step >= s ? 'var(--accent)' : 'var(--input-bg)', color: step >= s ? '#fff' : 'var(--text-muted)', boxShadow: step >= s ? '0 10px 15px -3px var(--accent-glow)' : 'none' }}>
                  {s}
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest`} style={{ color: step >= s ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {s === 1 ? 'Scan File' : 'Configure Rules'}
                </span>
                {s === 1 && <div className="w-8 h-px" style={{ background: step > 1 ? 'var(--accent)' : 'var(--border-subtle)' }} />}
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowInventory(!showInventory)}
            className={`px-4 py-2 rounded-xl border transition-all group/inv flex items-center gap-2 ${showInventory ? 'text-white shadow-lg' : 'hover:bg-[var(--glass-bg-hover)]'}`}
            style={{ background: showInventory ? 'var(--accent)' : 'var(--bg-surface)', borderColor: showInventory ? 'transparent' : 'var(--border)', color: showInventory ? '#fff' : 'var(--text-secondary)' }}
            title="Toggle Dataset Inventory"
          >
            <Database size={14} className={showInventory ? 'text-white' : 'text-indigo-400'} />
            <span className="text-[10px] font-black uppercase tracking-widest">Inventory</span>
          </button>
        </div>

        {step === 1 ? (
          <div className="relative p-20 min-h-[500px] rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center text-center transition-all group" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)' }}>

            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform" style={{ background: 'var(--card-accent-bg)', color: 'var(--accent)' }}>
              <UploadCloud size={32} />
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tight" style={{ color: 'var(--text-heading)' }}>Source Selection</h3>
            <p className="text-sm mt-2 mb-8 max-w-xs" style={{ color: 'var(--text-muted)' }}>Upload your transaction logs to begin the Optima ingestion pipeline.</p>
            <input type="file" multiple id="file-upload" className="hidden" onChange={handleScan} accept=".csv,.xlsx,.xls" disabled={isScanning} />
            <label htmlFor="file-upload" className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer transition-all shadow-xl flex items-center gap-3 ${isScanning ? 'opacity-50 cursor-wait' : 'hover:scale-[1.02] active:scale-95'}`}
              style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 10px 15px -3px var(--accent-glow)' }}>
              {isScanning ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Analyzing Files...
                </>
              ) : (
                'Select Local Files'
              )}
            </label>

            {/* INVENTORY PANEL (SLIDE-OVER) */}
            {showInventory && (
              <div className="absolute inset-0 z-50 rounded-[2.5rem] p-8 animate-in fade-in duration-300 flex flex-col border shadow-2xl"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <Database style={{ color: 'var(--accent)' }} size={24} />
                    <h3 className="text-lg font-black uppercase italic" style={{ color: 'var(--text-heading)' }}>Dataset Inventory</h3>
                  </div>
                  <button
                    onClick={() => setShowInventory(false)}
                    className="p-2 rounded-xl transition-colors hover:opacity-70"
                    style={{ background: 'var(--card-accent-bg)', color: 'var(--text-muted)' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                  {datasets.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                      <EyeOff size={48} />
                      <p className="text-[10px] font-black uppercase tracking-widest">No Datasets Available</p>
                    </div>
                  ) : (
                    datasets.map(ds => (
                      <div key={ds.id} className="p-4 rounded-2xl border flex flex-col group transition-colors text-left"
                        style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="min-w-0 flex-1">
                            {editingId === ds.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  className="rounded px-2 py-1 text-xs font-black uppercase outline-none w-full"
                                  style={{ background: 'var(--input-bg)', border: '1px solid var(--accent)', color: 'var(--input-text)' }}
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  autoFocus
                                />
                                <button onClick={() => saveTitle(ds.id)} className="text-emerald-400 hover:text-emerald-300 p-1 transition-colors"><Save size={14} /></button>
                                <button onClick={() => setEditingId(null)} className="text-rose-400 hover:text-rose-300 p-1 transition-colors"><X size={14} /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-black uppercase truncate" style={{ color: 'var(--text-heading)' }}>{ds.title}</p>
                                <button onClick={() => startEditing(ds)} className="opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-70" style={{ color: 'var(--accent)' }}><Edit3 size={10} /></button>
                              </div>
                            )}

                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[8px] font-bold uppercase tracking-widest flex items-center gap-1" style={{ color: 'var(--text-faint)' }}>
                                <Database size={8} /> {(ds.row_count || 0).toLocaleString()} ROWS
                              </span>
                              <span className="w-1 h-1 rounded-full" style={{ background: 'var(--border)' }} />
                              <span className="text-[8px] font-bold uppercase tracking-widest flex items-center gap-1" style={{ color: 'var(--text-faint)' }} title="Uploaded At">
                                <Calendar size={8} /> {new Date(ds.created_at).toLocaleString()}
                              </span>
                              {ds.last_edited_at && (
                                <>
                                  <span className="w-1 h-1 rounded-full" style={{ background: 'var(--border)' }} />
                                  <span className="text-[8px] font-bold uppercase tracking-widest flex items-center gap-1" style={{ color: 'var(--accent)' }} title="Last Modified">
                                    <Edit3 size={8} /> {new Date(ds.last_edited_at).toLocaleString()}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleTogglePrivacy(ds.id, ds.is_private)}
                              className={`p-2 rounded-lg transition-all ${ds.is_private ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'} hover:scale-110`}
                              title={ds.is_private ? "Private Dataset" : "Public Dataset"}
                            >
                              {ds.is_private ? <Lock size={14} /> : <Globe size={14} />}
                            </button>
                            <button
                              onClick={() => handleDeleteDataset(ds.id)}
                              className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                              title="Purge Dataset"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-white/5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openViewer(ds.id, 1)}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all hover:opacity-80"
                            style={{ background: 'var(--accent)', color: '#fff' }}
                          >
                            <Eye size={12} /> Explorer
                          </button>
                          <button
                            onClick={() => openConfigModal([ds.id])}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition-all hover:opacity-70"
                            style={{ background: 'var(--card-accent-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}
                          >
                            <Package size={12} /> Configure
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-8 pt-8 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                    Strategic Hub Active • {datasets.length} total repositories
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : step === 2 ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black uppercase italic" style={{ color: 'var(--text-heading)' }}>Ingestion Rules</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Configure marks for {scannedItems.length} detected products. Normal products should be left unmarked.</p>
              </div>
              <button onClick={() => setStep(1)} className="text-xs font-bold transition-colors hover:opacity-70" style={{ color: 'var(--accent)' }}>Back</button>
            </div>

            <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
              {scannedItems.map(item => {
                const config = itemConfigs[item] || { bundle: false, is_not_product: false };
                return (
                  <div key={item} className="p-4 rounded-2xl border flex flex-col gap-3" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs truncate pr-4" style={{ color: 'var(--text-primary)' }}>{item}</h4>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input type="checkbox" checked={config.bundle} onChange={(e) => updateItemConfig(item, 'bundle', e.target.checked)} className="hidden" />
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${config.bundle ? 'bg-indigo-500 border-indigo-500' : ''}`} style={{ borderColor: config.bundle ? 'var(--accent)' : 'var(--text-muted)', background: config.bundle ? 'var(--accent)' : 'transparent' }}>
                            {config.bundle && <Check size={12} className="text-white" />}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Bundle</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input type="checkbox" checked={config.is_not_product} onChange={(e) => updateItemConfig(item, 'is_not_product', e.target.checked)} className="hidden" />
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${config.is_not_product ? 'bg-rose-500 border-rose-500' : ''}`} style={{ borderColor: config.is_not_product ? 'var(--error-border)' : 'var(--text-muted)', background: config.is_not_product ? 'var(--error-bg)' : 'transparent' }}>
                            {config.is_not_product && <Check size={12} className="text-white" />}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Exclude</span>
                        </label>
                      </div>
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

              {error && (
                <div className="px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-200 text-sm font-bold mt-4">
                  {error}
                </div>
              )}

              {uploading ? (
                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-3 font-black text-[10px] uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
                    <Loader2 size={16} className="animate-spin" /> Ingesting & Aggregating...
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 animate-pulse" style={{ width: '60%' }} />
                  </div>
                  <button
                    onClick={handleCancelOperation}
                    className="text-[9px] font-black uppercase tracking-widest mt-2 hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Cancel Upload
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleUpload}
                  className="w-full py-5 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95"
                  style={{ background: 'var(--accent)', boxShadow: '0 10px 15px -3px var(--accent-glow)' }}
                >
                  Commit Dataset
                </button>
              )}
            </div>
          </div>
        ) : step === 3 ? (
          <div className="animate-in zoom-in-95 duration-500 w-full mx-auto space-y-8 px-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 border shadow-2xl" style={{ background: 'var(--card-accent-bg)', borderColor: 'var(--glass-border)', color: 'var(--accent)' }}>
                <Brain size={32} />
              </div>
              <h3 className="text-4xl font-black uppercase italic tracking-tight" style={{ color: 'var(--text-heading)' }}>Intelligence Hub</h3>
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Architecting persistent strategic models across your data landscape.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {/* COLUMN 1: DATA MASTERY */}
              <div className="p-8 rounded-[2.5rem] space-y-6 flex flex-col h-full" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] block" style={{ color: 'var(--text-faint)' }}>1. Data Mastery</label>
                  <Database size={14} style={{ color: 'var(--text-faint)' }} />
                </div>

                <div className="space-y-4 flex-1 flex flex-col min-h-0">
                  <div className="space-y-2">
                    <p className="text-[9px] font-bold uppercase ml-1" style={{ color: 'var(--text-faint)' }}>Active Sources</p>
                    <div className="space-y-2 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                      {datasets.filter(ds => ds.dataset_type === 'MASTER' || !ds.dataset_type).map(ds => (
                        <label key={ds.id} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${selectedDatasetIds.includes(ds.id) ? 'shadow-lg' : 'hover:opacity-80'}`}
                          style={{
                            background: selectedDatasetIds.includes(ds.id) ? 'var(--card-accent-bg)' : 'var(--input-bg)',
                            borderColor: selectedDatasetIds.includes(ds.id) ? 'var(--accent)' : 'var(--border-subtle)',
                            color: selectedDatasetIds.includes(ds.id) ? 'var(--text-primary)' : 'var(--text-muted)'
                          }}>
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
                            <p className="text-[9px] tracking-wider uppercase" style={{ color: 'var(--text-faint)' }}>{ds.row_count.toLocaleString()} ROWS</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => openConfigModal(selectedDatasetIds)}
                    disabled={selectedDatasetIds.length === 0}
                    className="w-full py-4 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-20 hover:opacity-80"
                    style={{ background: 'var(--card-accent-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                  >
                    <Package size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Configure Selections</span>
                  </button>
                </div>
              </div>

              {/* COLUMN 2: PREDICTIVE INTELLIGENCE */}
              <div className="p-8 rounded-[2.5rem] space-y-6 flex flex-col h-full" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] block" style={{ color: 'var(--text-faint)' }}>2. Predictive Intelligence</label>
                  <TrendingUp size={14} style={{ color: 'var(--text-faint)' }} />
                </div>

                <div className="space-y-4 flex-1 flex flex-col min-h-0">
                  <button
                    onClick={toggleForecaster}
                    className={`w-full flex items-center justify-between p-6 rounded-[2rem] border transition-all duration-300 group hover:scale-[1.02] active:scale-[0.98] cursor-pointer`}
                    style={{
                      background: trainForecast ? 'var(--card-accent-bg)' : 'var(--input-bg)',
                      borderColor: trainForecast ? 'var(--accent)' : 'var(--border-subtle)',
                      boxShadow: trainForecast ? '0 0 25px var(--accent-glow)' : 'none'
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300`}
                        style={{
                          background: trainForecast ? 'var(--accent)' : 'var(--card-accent-bg)',
                          color: trainForecast ? '#fff' : 'var(--text-muted)',
                          boxShadow: trainForecast ? '0 4px 10px -2px var(--accent-glow)' : 'none'
                        }}>
                        <Brain size={20} />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className={`text-xs font-black uppercase tracking-widest`} style={{ color: trainForecast ? 'var(--accent)' : 'var(--text-muted)' }}>Forecaster</span>
                        <span className="text-[9px] font-bold opacity-40 uppercase" style={{ color: 'var(--text-muted)' }}>Demand Predictions</span>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all`}
                      style={{ borderColor: trainForecast ? 'var(--accent)' : 'var(--border)', background: trainForecast ? 'var(--accent)' : 'transparent' }}>
                      {trainForecast && <Check size={14} className="text-white" />}
                    </div>
                  </button>

                  <div className="pt-4 flex-1 flex flex-col min-h-0">
                    <p className="text-[9px] font-bold uppercase ml-1 mb-2" style={{ color: 'var(--text-faint)' }}>Forecasting Records</p>
                    <div className="space-y-2 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                      {forecastRuns.map(run => (
                        <div key={run.id} className="p-4 rounded-2xl border group hover:border-indigo-500/30 transition-all"
                          style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <input
                              className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-tight w-full"
                              style={{ color: 'var(--text-heading)' }}
                              value={run.name}
                              onChange={(e) => handleRenameRun('forecast', run.id, e.target.value)}
                            />
                            <button onClick={() => handleDeleteRun('forecast', run.id)} className="text-rose-500/40 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <div className="flex justify-between items-center text-[8px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                            <span>{new Date(run.created_at).toLocaleString()}</span>
                            <span className="text-emerald-500/60">{run.status}</span>
                          </div>
                        </div>
                      ))}
                      {forecastRuns.length === 0 && (
                        <div className="py-12 text-center space-y-2">
                          <EyeOff size={24} className="mx-auto" style={{ color: 'var(--text-faint)', opacity: 0.2 }} />
                          <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-faint)' }}>No records found</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMN 3: STRATEGIC LOGIC */}
              <div className="p-8 rounded-[2.5rem] space-y-6 flex flex-col h-full" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] block" style={{ color: 'var(--text-faint)' }}>3. Strategic Logic</label>
                  <Zap size={14} style={{ color: 'var(--text-faint)' }} />
                </div>

                <div className="space-y-4 flex-1 flex flex-col min-h-0">
                  <button
                    onClick={() => setTrainBundler(!trainBundler)}
                    className={`w-full flex items-center justify-between p-6 rounded-[2rem] border transition-all duration-300 group hover:scale-[1.02] active:scale-[0.98] cursor-pointer`}
                    style={{
                      background: trainBundler ? 'var(--success-bg)' : 'var(--input-bg)',
                      borderColor: trainBundler ? '#10b981' : 'var(--border-subtle)',
                      borderColor: trainBundler ? 'var(--success-border)' : 'var(--border-subtle)',
                      boxShadow: trainBundler ? '0 0 25px var(--success-glow)' : 'none'
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                        style={{
                          background: trainBundler ? 'var(--success-border)' : 'var(--card-accent-bg)',
                          color: trainBundler ? '#fff' : 'var(--text-muted)',
                          boxShadow: trainBundler ? '0 4px 10px -2px var(--success-glow)' : 'none'
                        }}
                      >
                        <Zap size={20} />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className={`text-xs font-black uppercase tracking-widest`} style={{ color: trainBundler ? 'var(--success-border)' : 'var(--text-muted)' }}>Bundler</span>
                        <span className="text-[9px] font-bold opacity-40 uppercase" style={{ color: 'var(--text-muted)' }}>Affinity Logic</span>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all`}
                      style={{ borderColor: trainBundler ? 'var(--success-border)' : 'var(--border)', background: trainBundler ? 'var(--success-border)' : 'transparent' }}>
                      {trainBundler && <Check size={14} className="text-white" />}
                    </div>
                  </button>

                  {trainBundler && (
                    <div className="space-y-4 pt-4 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Discovery Sensitivity</label>
                          <div className="flex items-center gap-2 rounded-full px-3 py-1 shadow-lg" style={{ background: 'var(--success-border)', boxShadow: '0 4px 10px -2px var(--success-glow)' }}>
                            <CheckCircle size={10} className="text-white" />
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
                          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          style={{ background: 'var(--input-bg)' }}
                        />
                        <div className="flex justify-between text-[8px] font-bold uppercase tracking-tighter" style={{ color: 'var(--text-faint)' }}>
                          <span>Broad Discovery</span>
                          <span>Conservative</span>
                        </div>
                      </div>



                      <div className="space-y-2 py-2">
                        <label className="text-[9px] font-bold uppercase ml-1 flex items-center gap-2" style={{ color: 'var(--text-faint)' }}>
                          Bundler Persistence
                          <Info size={10} style={{ color: 'var(--text-faint)' }} />
                        </label>
                        {trainForecast ? (
                          <div className="px-4 py-3 rounded-2xl border text-[10px] font-black" style={{ background: 'var(--success-bg)', borderColor: 'var(--success-border)', color: 'var(--success-border)' }}>
                            Bundler results are automatically saved when Forecast training is enabled.
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPersistBundler(!persistBundler)}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300`}
                            style={{
                              background: persistBundler ? 'var(--success-bg)' : 'var(--input-bg)',
                              borderColor: persistBundler ? 'var(--success-border)' : 'var(--border-subtle)',
                              color: persistBundler ? 'var(--success-border)' : 'var(--text-muted)'
                            }}
                          >
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Save Bundler Run</span>
                            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center`}
                              style={{ borderColor: persistBundler ? 'var(--success-border)' : 'var(--border)', background: persistBundler ? 'var(--success-border)' : 'transparent', color: persistBundler ? '#fff' : 'transparent' }}>
                              <Check size={12} />
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex-1 flex flex-col min-h-0">
                    <p className="text-[9px] font-bold uppercase ml-1 mb-2" style={{ color: 'var(--text-faint)' }}>Bundling Records</p>
                    <div className="space-y-2 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                      {bundlerRuns.map(run => (
                        <div key={run.id} className="p-4 rounded-2xl border group hover:border-emerald-500/30 transition-all"
                          style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <input
                              className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-tight w-full"
                              style={{ color: 'var(--text-heading)' }}
                              value={run.name}
                              onChange={(e) => handleRenameRun('bundler', run.id, e.target.value)}
                            />
                            <button onClick={() => handleDeleteRun('bundler', run.id)} className="text-rose-500/40 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <div className="flex justify-between items-center text-[8px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                            <span>{new Date(run.created_at).toLocaleString()}</span>
                            <span className="text-indigo-400/60">SESSION</span>
                          </div>
                        </div>
                      ))}
                      {bundlerRuns.length === 0 && (
                        <div className="py-12 text-center space-y-2">
                          <EyeOff size={24} className="mx-auto" style={{ color: 'var(--text-faint)', opacity: 0.2 }} />
                          <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-faint)' }}>No records found</p>
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
                  placeholder="E.g. Yearly Baseline Simulation..."
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                  className="w-full border rounded-2xl px-6 py-4 text-xs font-black outline-none focus:border-indigo-500/50 transition-all shadow-xl"
                  style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}
                />
              </div>

              <div className="flex flex-col items-center gap-4 w-full md:w-auto">
                {error && (() => {
                  const isConnectionWarn = error.includes('Connection to the server was lost');
                  return (
                    <div className={`p-4 rounded-2xl border flex items-start gap-3 max-w-sm`}
                      style={{
                        background: isConnectionWarn ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                        borderColor: isConnectionWarn ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)',
                        color: isConnectionWarn ? '#f59e0b' : '#f87171'
                      }}>
                      {isConnectionWarn
                        ? <Info size={14} className="shrink-0 mt-0.5" />
                        : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
                      <p className="text-[10px] font-bold leading-relaxed">{error}</p>
                    </div>
                  );
                })()}

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
                    className="w-full md:w-80 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 disabled:opacity-20 disabled:grayscale"
                    style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 20px 50px -10px var(--accent-glow)' }}
                  >
                    Initialize Strategic Run
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in zoom-in duration-700 flex flex-col items-center justify-center p-20 text-center space-y-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'var(--card-accent-bg)', color: '#10b981' }}>
              <CheckCircle size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase italic tracking-tight" style={{ color: 'var(--text-heading)' }}>Dataset Ingested</h3>
              <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>Your records are now locked in the Optima vault. Proceed to build your forecast.</p>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <button
                onClick={() => setStep(3)}
                className="px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all"
                style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 10px 15px -3px var(--accent-glow)' }}
              >
                Start Training
              </button>
              <button
                onClick={resetIngestion}
                className="px-10 py-4 border rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                style={{ background: 'var(--input-bg)', color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
              >
                Upload More Data
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ITEM CONFIGURATION MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-[2.5rem] p-8 border border-white/10 shadow-2xl" style={{ background: 'var(--modal-bg)' }}>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-black flex items-center gap-2 uppercase italic tracking-tight" style={{ color: 'var(--text-heading)' }}>
                  <Package className="text-indigo-400" /> Ingestion Rule Override
                </h3>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>
                  Adjust bundle status and exclusion flags for this dataset
                </p>
              </div>
              <button onClick={() => setShowConfigModal(false)} className="p-3 rounded-2xl transition-all"
                style={{ background: 'var(--input-bg)', color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>

            {configLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-50">
                <Loader2 size={40} className="animate-spin text-indigo-500" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Accessing Metadata Vault...</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-3">
                  {Object.entries(localItemConfigs).map(([item, config]) => (
                    <div key={item} className="p-4 rounded-2xl border flex items-center justify-between" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border-subtle)' }}>
                      <h4 className="font-bold text-[11px] truncate pr-4" style={{ color: 'var(--text-primary)' }}>{item}</h4>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input type="checkbox" checked={config.bundle} onChange={(e) => updateLocalConfig(item, 'bundle', e.target.checked)} className="hidden" />
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${config.bundle ? 'bg-indigo-500 border-indigo-500' : ''}`} style={{ borderColor: config.bundle ? 'var(--accent)' : 'var(--text-muted)', background: config.bundle ? 'var(--accent)' : 'transparent' }}>
                            {config.bundle && <Check size={12} className="text-white" />}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Bundle</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input type="checkbox" checked={config.is_not_product} onChange={(e) => updateLocalConfig(item, 'is_not_product', e.target.checked)} className="hidden" />
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${config.is_not_product ? 'bg-rose-500 border-rose-500' : ''}`} style={{ borderColor: config.is_not_product ? 'var(--error-border)' : 'var(--text-muted)', background: config.is_not_product ? 'var(--error-bg)' : 'transparent' }}>
                            {config.is_not_product && <Check size={12} className="text-white" />}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Exclude</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex justify-end">
                  <button
                    onClick={saveConfigOverride}
                    className="px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95"
                    style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 10px 15px -3px var(--accent-glow)' }}
                  >
                    Commit Changes
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* VIEWER MODAL */}
      {showViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-6xl max-h-[90vh] flex flex-col rounded-3xl p-6" style={{ background: 'var(--modal-bg)', border: `1px solid var(--border-strong)` }}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-6">
                <div>
                  <h3 className="text-xl font-black flex items-center gap-2" style={{ color: 'var(--text-heading)' }}><Database size={20} style={{ color: 'var(--accent)' }} /> Data Explorer</h3>
                  <p className="text-[10px] mt-1 uppercase font-black tracking-widest" style={{ color: 'var(--text-faint)' }}>
                    {viewerType === 'raw' ? 'Transaction Audit' : 'Monthly Performance Aggregates'} • {viewerTotalRows.toLocaleString()} Rows
                  </p>
                </div>

                <div className="flex p-1 rounded-xl border" style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)' }}>
                  <button
                    onClick={() => openViewer(viewerDatasetId, 1, '', 'raw')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewerType === 'raw' ? 'text-white shadow-lg' : ''}`}
                    style={{ background: viewerType === 'raw' ? 'var(--accent)' : 'transparent', color: viewerType === 'raw' ? '#fff' : 'var(--text-faint)' }}
                  >
                    Raw
                  </button>
                  <button
                    onClick={() => openViewer(viewerDatasetId, 1, '', 'aggregated')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewerType === 'aggregated' ? 'text-white shadow-lg' : ''}`}
                    style={{ background: viewerType === 'aggregated' ? 'var(--accent)' : 'transparent', color: viewerType === 'aggregated' ? '#fff' : 'var(--text-faint)' }}
                  >
                    Monthly (Items)
                  </button>
                  <button
                    onClick={() => openViewer(viewerDatasetId, 1, '', 'global_aggregated')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewerType === 'global_aggregated' ? 'text-white shadow-lg' : ''}`}
                    style={{ background: viewerType === 'global_aggregated' ? 'var(--accent)' : 'transparent', color: viewerType === 'global_aggregated' ? '#fff' : 'var(--text-faint)' }}
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
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  >
                    <option value="">All Years</option>
                    {viewerAvailableYears.map(yr => <option key={yr} value={yr}>{yr}</option>)}
                  </select>
                )}
                <button onClick={() => setShowViewer(false)} className="p-2 rounded-xl transition-all border"
                  style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              {viewerLoading ? (
                <div className="flex flex-col items-center justify-center h-64" style={{ color: 'var(--text-faint)' }}>
                  <Loader2 size={30} className="animate-spin mb-4" />
                  <p className="text-sm font-bold">Loading Data...</p>
                </div>
              ) : viewerData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64" style={{ color: 'var(--text-faint)' }}>
                  <p className="text-sm font-bold">No data found.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="text-xs font-black uppercase sticky top-0" style={{ background: 'var(--table-header-bg)', color: 'var(--text-faint)' }}>
                    <tr>
                      {Object.keys(viewerData[0]).map(k => (
                        <th key={k}
                          onClick={() => handleSort(k)}
                          className="px-4 py-3 border-b cursor-pointer transition-colors group"
                          style={{ borderColor: 'var(--border-subtle)' }}
                        >
                          <div className="flex items-center gap-2">
                            {k.replace('_', ' ')}
                            <span className={`text-[8px] transition-opacity ${viewerSort.key === k ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} style={{ color: 'var(--accent)' }}>
                              {viewerSort.dir === 'ASC' ? '▲' : '▼'}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewerData.map((row, i) => (
                      <tr key={i} className="border-b transition-colors" style={{ borderColor: 'var(--border-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--table-row-hover)' }}>
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{val !== null && val !== undefined ? String(val) : '-'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {viewerType !== 'global_aggregated' && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: 'var(--text-faint)' }}>Page {viewerPage} of {Math.ceil(viewerTotalRows / 50) || 1}</span>
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
                    <button type="submit" className="text-xs font-bold px-3 py-2 rounded-xl transition-all"
                      style={{ background: 'var(--accent)', color: '#fff' }}>Go</button>
                  </form>
                  <div className="flex gap-2">
                    <button
                      disabled={viewerPage === 1 || viewerLoading}
                      onClick={() => openViewer(viewerDatasetId, viewerPage - 1, viewerYearFilter)}
                      className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1 transition-all"
                      style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                    >
                      <ChevronLeft size={16} /> Prev
                    </button>
                    <button
                      disabled={viewerPage >= (Math.ceil(viewerTotalRows / 50) || 1) || viewerLoading}
                      onClick={() => openViewer(viewerDatasetId, viewerPage + 1, viewerYearFilter)}
                      className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1 transition-all"
                      style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
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

      {/* STRATEGIC RUN COMPLETE NAVIGATION MODAL */}
      {showNavigationModal && navigationData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md flex flex-col rounded-[2.5rem] p-8 border border-white/10 shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-300" style={{ background: 'var(--modal-bg)' }}>
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto border shadow-2xl" style={{ background: 'var(--card-accent-bg)', borderColor: 'var(--glass-border)', color: 'var(--accent)' }}>
              <CheckCircle size={32} />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black uppercase italic tracking-tight" style={{ color: 'var(--text-heading)' }}>
                Strategic Run Complete
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Both models have trained successfully. Where would you like to view the results first?
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => {
                  setShowNavigationModal(false);
                  navigate('/qualitative', {
                    state: {
                      stagedBundles: navigationData.bundles,
                      stagedName: navigationData.name,
                      stagedDatasetId: navigationData.datasetId,
                      stagedRefId: navigationData.refId,
                      autoSaved: navigationData.autoSaved
                    }
                  });
                }}
                className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 10px 15px -3px var(--accent-glow)' }}
              >
                <Zap size={14} /> Product Bundler
              </button>
              
              <button
                onClick={() => {
                  setShowNavigationModal(false);
                  navigate('/analytics');
                }}
                className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 border flex items-center justify-center gap-2 cursor-pointer"
                style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
              >
                <TrendingUp size={14} /> Forecasting Analytics
              </button>
            </div>

            <button
              onClick={() => setShowNavigationModal(false)}
              className="text-[9px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              Stay on Management Hub
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
