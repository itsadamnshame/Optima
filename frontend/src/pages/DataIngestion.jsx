import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  UploadCloud, CheckCircle, AlertCircle, Loader2, Database, Lock,
  Trash2, Globe, EyeOff, Edit3, Save, X, FileSpreadsheet, Calendar, Check,
  Ban, Search, User, ShieldOff, BarChart2, Brain,
  Eye, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const glass = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' };
const glassHover = 'hover:bg-white/[0.04] transition-all';

export default function DataIngestion({ onDatasetChange }) {
  const { token, role } = useAuth();
  const [files, setFiles] = useState([]);
  const [title, setTitle] = useState('');
  const [datasetType, setDatasetType] = useState('MASTER');
  const [datasets, setDatasets] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [blockedItems, setBlockedItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [blockSearch, setBlockSearch] = useState('');
  const [loadingBlocked, setLoadingBlocked] = useState(false);

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

  const openViewer = async (datasetId, page = 1, year = '') => {
    setViewerDatasetId(datasetId);
    setViewerPage(page);
    setViewerYearFilter(year);
    setShowViewer(true);
    setViewerLoading(true);
    try {
      if (datasetId !== viewerDatasetId) {
        const yearsRes = await axios.get(`/api/datasets/${datasetId}/years`, { headers: { Authorization: `Bearer ${token}` } });
        setViewerAvailableYears(yearsRes.data.years || []);
      }
      
      const yearQuery = year ? `&year=${year}` : '';
      const res = await axios.get(`/api/datasets/${datasetId}/data?page=${page}&limit=50${yearQuery}`, { headers: { Authorization: `Bearer ${token}` } });
      setViewerData(res.data.data);
      setViewerTotalRows(res.data.total_rows);
    } catch(e) {
      console.error(e);
    } finally {
      setViewerLoading(false);
    }
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

  useEffect(() => { fetchDatasets(); fetchBlockedItems(); fetchAllItems(); }, []);

  const fetchDatasets = async () => {
    setLoadingDatasets(true);
    try {
      const r = await axios.get('/api/datasets', { headers: { Authorization: `Bearer ${token}` } });
      setDatasets(r.data.datasets);
    } catch (e) { console.error(e); } finally { setLoadingDatasets(false); }
  };

  const fetchBlockedItems = async () => {
    setLoadingBlocked(true);
    try {
      const r = await axios.get('/api/blocked-items', { headers: { Authorization: `Bearer ${token}` } });
      setBlockedItems(r.data.blocked_items);
    } catch (e) { console.error(e); } finally { setLoadingBlocked(false); }
  };

  const fetchAllItems = async () => {
    try {
      const r = await axios.get('/api/get-items', { headers: { Authorization: `Bearer ${token}` } });
      setAllItems(r.data.items || []);
    } catch (e) { console.error(e); }
  };

  const handleBlockItem = async (itemDesc, blockBundling = true, blockForecasting = false) => {
    try {
      await axios.post('/api/blocked-items', { item_description: itemDesc, block_bundling: blockBundling, block_forecasting: blockForecasting }, { headers: { Authorization: `Bearer ${token}` } });
      fetchBlockedItems();
    } catch (err) { 
      const msg = err.response?.data?.detail || 'Failed to block item';
      alert(msg); 
    }
  };

  const handleUnblockItem = async (itemDesc) => {
    try {
      await axios.delete(`/api/blocked-items/${encodeURIComponent(itemDesc)}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchBlockedItems();
    } catch (err) { 
      const msg = err.response?.data?.detail || 'Failed to unblock item';
      alert(msg); 
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(selectedFiles);
      if (!title) setTitle(selectedFiles[0].name.replace(/\.[^/.]+$/, ''));
      setUploadStatus('idle');
    }
  };

  const handleUpload = async () => {
    if (files.length === 0 || !title) return;
    setUploadStatus('loading');
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    formData.append('title', title);
    formData.append('dataset_type', datasetType);
    try {
      const r = await axios.post('/api/upload-data', formData, { headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` } });
      setUploadStatus('success');
      setUploadMessage(`Uploaded "${title}" — ${r.data.total_rows} rows ingested from ${r.data.files_processed} file(s).`);
      setFiles([]); setTitle('');
      fetchDatasets();
      if (onDatasetChange) onDatasetChange();
    } catch (err) {
      setUploadStatus('error');
      const msg = err.response?.data?.detail || 'Upload failed. Please check your file format and connection.';
      setUploadMessage(msg);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/datasets/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchDatasets(); if (onDatasetChange) onDatasetChange(); setDeleteConfirmId(null);
    } catch (err) { 
      const msg = err.response?.data?.detail || 'Failed to delete dataset';
      alert(msg); 
    }
  };

  const handleTogglePrivacy = async (id, currentPrivate) => {
    try {
      await axios.patch(`/api/datasets/${id}`, { is_private: !currentPrivate }, { headers: { Authorization: `Bearer ${token}` } });
      fetchDatasets();
    } catch (err) { 
      const msg = err.response?.data?.detail || 'Failed to update privacy';
      alert(msg); 
    }
  };

  const startEditing = (ds) => { setEditingId(ds.id); setEditTitle(ds.title); };

  const saveTitle = async (id) => {
    try {
      await axios.patch(`/api/datasets/${id}`, { title: editTitle }, { headers: { Authorization: `Bearer ${token}` } });
      setEditingId(null); fetchDatasets();
    } catch (err) { 
      const msg = err.response?.data?.detail || 'Failed to rename dataset';
      alert(msg); 
    }
  };

  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#f4f4f5' };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="relative rounded-[2rem] p-8 overflow-hidden" style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.12) 0%,rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/20 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
            Data Pipeline
          </p>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <Database className="text-indigo-400" size={28} /> Data Ingestion &amp; Management
          </h2>
          <p className="text-zinc-500 text-sm mt-1 ml-10">Upload and organize sales datasets. Standardized data powers the Optima analytics engine.</p>
        </div>
      </div>

      {/* UPLOAD */}
      {role === 'ADMIN' ? (
        <div className="rounded-3xl p-8" style={glass}>
          <div className="flex flex-col md:flex-row gap-8">
            {/* Left */}
            <div className="md:w-1/3 space-y-5">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <UploadCloud className="text-indigo-400" size={18} /> New Dataset
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">Upload raw client sales data in Excel or CSV format. Our pipeline will clean, standardize, and integrate it.</p>
              <div>
                <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Dataset Title</label>
                <input
                  type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Q1 2026 Sales Data"
                  className="w-full px-4 py-3 rounded-xl outline-none font-medium text-sm transition-all"
                  style={inputStyle}
                />
              </div>
              <div className="pt-2">
                <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Dataset Type</label>
                <div className="flex flex-col gap-3">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input type="radio" name="datasetType" value="MASTER" checked={datasetType === 'MASTER'} onChange={() => setDatasetType('MASTER')} className="mt-1 w-4 h-4 accent-indigo-500" />
                    <div>
                      <span className="block text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">Master Dataset</span>
                      <span className="text-[10px] text-zinc-500">Ready for analysis / pre-combined</span>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input type="radio" name="datasetType" value="YEARLY" checked={datasetType === 'YEARLY'} onChange={() => setDatasetType('YEARLY')} className="mt-1 w-4 h-4 accent-indigo-500" />
                    <div>
                      <span className="block text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">Yearly Chunk</span>
                      <span className="text-[10px] text-zinc-500">Partial data requiring assembly later</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            {/* Right — dropzone */}
            <div className="md:w-2/3">
              <div className="h-full rounded-2xl p-8 flex flex-col items-center justify-center border-2 border-dashed transition-colors group cursor-pointer"
                style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                <input type="file" id="file-upload" accept=".csv,.xlsx" multiple onChange={handleFileChange} className="hidden" />
                <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer">
                  <div className="p-4 rounded-full mb-4 group-hover:scale-110 transition-transform"
                    style={{ background: 'rgba(99,102,241,0.12)' }}>
                    <FileSpreadsheet size={36} className="text-indigo-400" />
                  </div>
                  <span className="text-white font-bold text-base">{files.length > 0 ? `${files.length} file(s) selected` : 'Select Files'}</span>
                  <span className="text-zinc-500 text-xs mt-1">Excel (.xlsx) or CSV format</span>
                </label>
                <button
                  onClick={handleUpload}
                  disabled={files.length === 0 || !title || uploadStatus === 'loading'}
                  className="mt-8 px-10 py-3 rounded-2xl font-black text-sm flex items-center gap-3 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg,#4f46e5,#6366f1)', color: '#fff', boxShadow: '0 0 24px rgba(99,102,241,0.3)' }}>
                  {uploadStatus === 'loading' ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} />}
                  Execute Pipeline
                </button>
                {uploadStatus === 'success' && (
                  <div className="mt-5 flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle size={18} />{uploadMessage}
                  </div>
                )}
                {uploadStatus === 'error' && (
                  <div className="mt-5 flex items-center gap-2 text-rose-400 font-bold text-sm">
                    <AlertCircle size={18} />{uploadMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl p-10 flex flex-col items-center justify-center text-center" style={glass}>
          <div className="p-4 rounded-full mb-5" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <Lock size={28} className="text-zinc-500" />
          </div>
          <h3 className="text-xl font-black text-zinc-200 mb-2">Dataset Browser</h3>
          <p className="text-zinc-500 text-sm max-w-md">You are viewing the shared dataset inventory. Administrators manage data ingestion.</p>
        </div>
      )}

      {/* INVENTORY + BLOCKLIST side-by-side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">

        {/* DATASET INVENTORY */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Database size={16} className="text-indigo-400" /> Dataset Inventory
              {loadingDatasets && <Loader2 className="animate-spin text-zinc-600" size={16} />}
            </h3>
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{datasets.length} datasets</span>
          </div>

          <div className="space-y-3">
            {datasets.map((ds) => (
              <div key={ds.id} className={`rounded-2xl p-5 flex items-center gap-4 ${glassHover}`} style={glass}>
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
                        {ds.dataset_type === 'MASTER' ? (
                          <span className="text-[9px] font-black text-indigo-400 px-2 py-0.5 rounded-full uppercase" style={{ background: 'rgba(99,102,241,0.1)' }}>MASTER</span>
                        ) : (
                          <span className="text-[9px] font-black text-amber-400 px-2 py-0.5 rounded-full uppercase" style={{ background: 'rgba(251,191,36,0.1)' }}>YEARLY</span>
                        )}
                        {ds.is_active && <span className="text-[9px] font-black text-emerald-400 px-2 py-0.5 rounded-full uppercase" style={{ background: 'rgba(52,211,153,0.1)' }}>● Active</span>}
                        {ds.is_private
                          ? <span className="text-[9px] font-black text-amber-400 px-2 py-0.5 rounded-full uppercase" style={{ background: 'rgba(251,191,36,0.1)' }}><EyeOff size={8} className="inline mr-0.5" />Private</span>
                          : <span className="text-[9px] font-black text-emerald-400 px-2 py-0.5 rounded-full uppercase" style={{ background: 'rgba(52,211,153,0.08)' }}><Globe size={8} className="inline mr-0.5" />Public</span>}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-[10px] text-zinc-600 font-medium items-center">
                        <span className="flex items-center gap-1"><Database size={10} />{ds.row_count.toLocaleString()} rows</span>
                        <span className="flex items-center gap-1"><Calendar size={10} />Up: {new Date(ds.upload_date).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><User size={10} />{ds.uploader}</span>
                        {ds.date_range_start && ds.date_range_end && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-zinc-400">
                            {ds.date_range_start} to {ds.date_range_end}
                          </span>
                        )}
                        {ds.gap_info && ds.gap_info !== 'Continuous' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20" title={ds.gap_info}>
                            <AlertTriangle size={10} /> {ds.gap_info.substring(0, 50)}{ds.gap_info.length > 50 ? '...' : ''}
                          </span>
                        )}
                        {ds.gap_info === 'Continuous' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={10} /> Continuous
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                {role === 'ADMIN' && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openViewer(ds.id, 1)} className="p-2 rounded-lg text-zinc-600 hover:text-indigo-400 hover:bg-indigo-400/10 transition-all" title="View Data"><Eye size={15} /></button>
                    <button onClick={() => startEditing(ds)} className="p-2 rounded-lg text-zinc-600 hover:text-indigo-400 hover:bg-indigo-400/10 transition-all" title="Rename"><Edit3 size={15} /></button>
                    <button onClick={() => handleTogglePrivacy(ds.id, ds.is_private)} className={`p-2 rounded-lg transition-all ${ds.is_private ? 'text-amber-400 hover:bg-amber-400/10' : 'text-zinc-600 hover:text-emerald-400 hover:bg-emerald-400/10'}`}>{ds.is_private ? <EyeOff size={15} /> : <Globe size={15} />}</button>
                    {deleteConfirmId === ds.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-black text-rose-400 uppercase">Sure?</span>
                        <button onClick={() => { handleDelete(ds.id); if (onDatasetChange) onDatasetChange(); }} className="p-2 rounded-lg text-rose-400 bg-rose-400/10 hover:bg-rose-400/20 transition-all"><Check size={14} /></button>
                        <button onClick={() => setDeleteConfirmId(null)} className="p-2 rounded-lg text-zinc-600 hover:bg-white/5 transition-all"><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirmId(ds.id)} className="p-2 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-400/10 transition-all"><Trash2 size={15} /></button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {datasets.length === 0 && !loadingDatasets && (
              <div className="py-16 rounded-2xl border-2 border-dashed text-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <Database className="mx-auto text-zinc-700 mb-3" size={40} />
                <p className="text-zinc-600 font-bold text-sm">No datasets uploaded yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* ITEM BLOCKLIST */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Ban size={16} className="text-rose-400" /> Item Blocklist
              {loadingBlocked && <Loader2 className="animate-spin text-zinc-600" size={16} />}
            </h3>
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{blockedItems.length} blocked</span>
          </div>
          <p className="text-xs text-zinc-600">Block items from bundling analysis or forecasting. Blocked items are excluded from the Optima pipeline.</p>

          {role === 'ADMIN' && (
            <div className="rounded-2xl p-5" style={glass}>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">Add to Blocklist</p>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input type="text" value={blockSearch} onChange={(e) => setBlockSearch(e.target.value)}
                  placeholder="Search items to block..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none text-sm font-medium transition-all"
                  style={inputStyle} />
              </div>
              {blockSearch.length > 1 && (
                <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl p-2 custom-scrollbar" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {allItems.filter(i => i.toLowerCase().includes(blockSearch.toLowerCase())).filter(i => !blockedItems.find(b => b.item_description === i)).slice(0, 20).map(item => (
                    <button key={item} onClick={() => { handleBlockItem(item, true, false); setBlockSearch(''); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all flex items-center justify-between">
                      {item}<span className="text-[9px] font-black text-rose-500 uppercase">Block</span>
                    </button>
                  ))}
                  {allItems.filter(i => i.toLowerCase().includes(blockSearch.toLowerCase())).filter(i => !blockedItems.find(b => b.item_description === i)).length === 0 && (
                    <p className="text-center text-xs text-zinc-600 py-3">No matching items found</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {blockedItems.map((item) => (
              <div key={item.id} className={`rounded-2xl p-4 flex items-center gap-4 ${glassHover}`} style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)' }}>
                <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <ShieldOff size={16} className="text-rose-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-zinc-200 text-sm">{item.item_description}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    {item.block_bundling && <span className="text-[9px] font-black text-rose-400 px-2 py-0.5 rounded-full uppercase" style={{ background: 'rgba(239,68,68,0.1)' }}><Brain size={8} className="inline mr-0.5" />Bundling</span>}
                    {item.block_forecasting && <span className="text-[9px] font-black text-orange-400 px-2 py-0.5 rounded-full uppercase" style={{ background: 'rgba(249,115,22,0.1)' }}><BarChart2 size={8} className="inline mr-0.5" />Forecasting</span>}
                  </div>
                </div>
                {role === 'ADMIN' && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleBlockItem(item.item_description, item.block_bundling, !item.block_forecasting)}
                      className={`p-2 rounded-lg transition-all ${item.block_forecasting ? 'text-orange-400 bg-orange-400/10' : 'text-zinc-600 hover:text-orange-400 hover:bg-orange-400/10'}`}
                      title={item.block_forecasting ? 'Unblock Forecasting' : 'Block Forecasting'}><BarChart2 size={15} /></button>
                    <button onClick={() => handleUnblockItem(item.item_description)} className="p-2 rounded-lg text-zinc-600 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all" title="Unblock"><X size={15} /></button>
                  </div>
                )}
              </div>
            ))}
            {blockedItems.length === 0 && !loadingBlocked && (
              <div className="py-12 rounded-2xl border-2 border-dashed text-center" style={{ borderColor: 'rgba(239,68,68,0.1)' }}>
                <Ban className="mx-auto text-zinc-700 mb-3" size={36} />
                <p className="text-zinc-600 font-bold text-sm">No items blocked.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* VIEWER MODAL */}
      {showViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-6xl max-h-[90vh] flex flex-col rounded-3xl p-6" style={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2"><Database size={20} className="text-indigo-400" /> Dataset Viewer</h3>
                <p className="text-xs text-zinc-500 mt-1">Viewing raw transaction data ({viewerTotalRows.toLocaleString()} rows total)</p>
              </div>
              <div className="flex items-center gap-4">
                {viewerAvailableYears.length > 0 && (
                  <select 
                    value={viewerYearFilter} 
                    onChange={(e) => openViewer(viewerDatasetId, 1, e.target.value)}
                    className="bg-[#18181b] border border-white/10 text-white text-sm font-bold rounded-xl px-3 py-2 outline-none"
                  >
                    <option value="">All Years</option>
                    {viewerAvailableYears.map(yr => <option key={yr} value={yr}>{yr}</option>)}
                  </select>
                )}
                <button onClick={() => setShowViewer(false)} className="text-zinc-500 hover:text-white p-2 rounded-xl hover:bg-white/5"><X size={20}/></button>
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
                  <thead className="bg-[#0f0f12] text-xs font-black uppercase text-zinc-500 sticky top-0">
                    <tr>
                      {Object.keys(viewerData[0]).map(k => (
                        <th key={k} className="px-4 py-3 border-b border-white/5">{k.replace('_', ' ')}</th>
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
                    className="bg-[#18181b] border border-white/10 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none w-28"
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
          </div>
        </div>
      )}

    </div>
  );
}
