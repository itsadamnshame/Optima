import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  UploadCloud, CheckCircle, AlertCircle, Loader2, Database, Lock, 
  Trash2, Globe, EyeOff, Edit3, Save, X, FileSpreadsheet, Calendar, Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function DataIngestion({ onDatasetChange }) {
  const { token, role } = useAuth();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [datasets, setDatasets] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('idle'); 
  const [uploadMessage, setUploadMessage] = useState('');
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    setLoadingDatasets(true);
    try {
      const response = await axios.get('http://localhost:8000/api/datasets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setDatasets(response.data.datasets);
    } catch (error) {
      console.error("Failed to fetch datasets", error);
    } finally {
      setLoadingDatasets(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      // Auto-set title from filename if empty
      if (!title) {
        setTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
      }
      setUploadStatus('idle');
    }
  };

  const handleUpload = async () => {
    if (!file || !title) return;
    setUploadStatus('loading');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);

    try {
      const response = await axios.post('http://localhost:8000/api/upload-data', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      setUploadStatus('success');
      setUploadMessage(`Success! Uploaded "${title}" with ${response.data.total_rows} rows.`);
      setFile(null);
      setTitle('');
      fetchDatasets();
      if (onDatasetChange) onDatasetChange();
    } catch (error) {
      console.error(error);
      setUploadStatus('error');
      setUploadMessage('Failed to upload data. Is the FastAPI server running?');
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:8000/api/datasets/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchDatasets();
      if (onDatasetChange) onDatasetChange();
      setDeleteConfirmId(null);
    } catch (error) {
      alert("Failed to delete dataset");
    }
  };

  const handleTogglePrivacy = async (id, currentPrivate) => {
    try {
      await axios.patch(`http://localhost:8000/api/datasets/${id}`, {
        is_private: !currentPrivate
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchDatasets();
    } catch (error) {
      alert("Failed to update privacy");
    }
  };

  const startEditing = (dataset) => {
    setEditingId(dataset.id);
    setEditTitle(dataset.title);
  };

  const saveTitle = async (id) => {
    try {
      await axios.patch(`http://localhost:8000/api/datasets/${id}`, {
        title: editTitle
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setEditingId(null);
      fetchDatasets();
    } catch (error) {
      alert("Failed to rename dataset");
    }
  };

  return (
    <div className="animate-fade-in-up max-w-6xl mx-auto space-y-12 pb-20">
      
      {/* PAGE HEADER */}
      <div className="text-center md:text-left">
        <h2 className="text-4xl font-black text-gray-900 flex items-center justify-center md:justify-start gap-3">
          <Database className="text-indigo-600" size={40} />
          Data Ingestion & Management
        </h2>
        <p className="text-gray-500 mt-3 text-lg max-w-2xl">
          Upload and organize your sales datasets. Standardized data powers the Optima analytics engine.
        </p>
      </div>

      {/* UPLOAD SECTION (ADMIN ONLY) */}
      {role === 'ADMIN' ? (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 ring-1 ring-gray-200/50">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Left: Instructions */}
            <div className="md:w-1/3">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <UploadCloud className="text-indigo-500" /> 
                New Dataset
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-6">
                Upload raw client sales data in Excel or CSV format. Our pipeline will clean, standardize, and integrate it into the global database.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Dataset Title</label>
                  <input 
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Q1 2026 Sales Data"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Right: Dropzone/File Select */}
            <div className="md:w-2/3">
              <div className="h-full border-2 border-dashed border-gray-200 rounded-3xl p-8 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 transition-colors group">
                <input 
                  type="file" 
                  id="file-upload"
                  accept=".csv, .xlsx" 
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label 
                  htmlFor="file-upload"
                  className="flex flex-col items-center cursor-pointer"
                >
                  <div className="p-4 bg-indigo-50 rounded-full text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                    <FileSpreadsheet size={40} />
                  </div>
                  <span className="text-gray-900 font-bold text-lg">{file ? file.name : "Select a File"}</span>
                  <span className="text-gray-500 text-sm mt-1">Excel (.xlsx) or CSV format</span>
                </label>

                <button 
                  onClick={handleUpload}
                  disabled={!file || !title || uploadStatus === 'loading'}
                  className="mt-8 bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-3 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                >
                  {uploadStatus === 'loading' ? <Loader2 className="animate-spin" /> : <Database size={20} />}
                  Execute Pipeline
                </button>

                {uploadStatus === 'success' && (
                  <div className="mt-6 flex items-center gap-2 text-green-700 font-bold animate-bounce">
                    <CheckCircle size={20} />
                    <span>{uploadMessage}</span>
                  </div>
                )}
                
                {uploadStatus === 'error' && (
                  <div className="mt-6 flex items-center gap-2 text-red-600 font-bold">
                    <AlertCircle size={20} />
                    <span>{uploadMessage}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 p-10 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
          <div className="bg-slate-200 p-4 rounded-full text-slate-500 mb-6">
            <Lock size={32} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2">Dataset Browser</h3>
          <p className="text-slate-500 font-medium max-w-md">
            You are viewing the shared dataset inventory. Administrators manage the ingestion of new data.
          </p>
        </div>
      )}

      {/* DATASET INVENTORY LIST */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Dataset Inventory
            {loadingDatasets && <Loader2 className="animate-spin text-gray-400" size={20} />}
          </h3>
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">{datasets.length} Datasets Total</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {datasets.map((ds) => (
            <div key={ds.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row items-center gap-6">
              
              <div className="p-4 bg-gray-50 rounded-xl text-gray-400">
                <FileSpreadsheet size={32} />
              </div>

              <div className="flex-1 w-full text-center md:text-left">
                {editingId === ds.id ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-xl font-bold text-gray-900 border-b-2 border-indigo-500 outline-none w-full"
                      autoFocus
                    />
                    <button onClick={() => saveTitle(ds.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><Save size={20}/></button>
                    <button onClick={() => setEditingId(null)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><X size={20}/></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-center md:justify-start gap-3">
                      <h4 className="text-xl font-bold text-gray-900">{ds.title}</h4>
                      {ds.is_active && (
                        <span className="flex items-center gap-1 text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> Active
                        </span>
                      )}
                      {ds.is_private ? (
                        <span className="flex items-center gap-1 text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                          <EyeOff size={10} /> Private
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                          <Globe size={10} /> Public
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-1 text-sm text-gray-500 font-medium">
                      <span className="flex items-center gap-1"><Database size={14} /> {ds.row_count.toLocaleString()} rows</span>
                      <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(ds.upload_date).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1 text-gray-400 text-xs italic">({ds.filename})</span>
                    </div>
                  </>
                )}
              </div>

              {role === 'ADMIN' && (
                <div className="flex items-center gap-2 border-l border-gray-100 pl-6 h-full">
                  <button 
                    onClick={() => startEditing(ds)}
                    className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    title="Rename"
                  >
                    <Edit3 size={20} />
                  </button>
                  <button 
                    onClick={() => handleTogglePrivacy(ds.id, ds.is_private)}
                    className={`p-3 rounded-xl transition-all ${ds.is_private ? 'text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                    title={ds.is_private ? "Make Public" : "Make Private"}
                  >
                    {ds.is_private ? <EyeOff size={20} /> : <Globe size={20} />}
                  </button>
                  {deleteConfirmId === ds.id ? (
                    <div className="flex items-center gap-2 animate-pulse">
                      <span className="text-[10px] font-black text-red-600 uppercase">Confirm?</span>
                      <button 
                        onClick={() => { handleDelete(ds.id); if (onDatasetChange) onDatasetChange(); }}
                        className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-md"
                        title="Yes, Delete"
                      >
                        <Check size={16} />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirmId(null)}
                        className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                        title="Cancel"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setDeleteConfirmId(ds.id)}
                      className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      title="Delete Dataset"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {datasets.length === 0 && !loadingDatasets && (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <Database className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500 font-bold">No datasets uploaded yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}