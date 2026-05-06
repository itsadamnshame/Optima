import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Database, BarChart2, Brain, Sparkles, Zap, Shield, LogOut, ChevronDown, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

import DataIngestion from './pages/DataIngestion';
import Analytics from './pages/Analytics';
import Qualitative from './pages/Qualitative';
import Playbook from './pages/Playbook';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function NavLink({ to, icon: Icon, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold ${isActive
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 glow-pulse'
          : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
        }`}
    >
      <Icon size={17} className={isActive ? 'text-white' : 'text-zinc-600'} />
      {children}
    </Link>
  );
}

const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { token, role } = useAuth();
  if (!token || role !== 'ADMIN') return <Navigate to="/" />;
  return children;
};

function AppContent() {
  const { token, role, logout } = useAuth();

  const [recommendations, setRecommendations] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [persistedChart, setPersistedChart] = useState([]);
  const [persistedMetrics, setPersistedMetrics] = useState({});
  const [lastForecastTime, setLastForecastTime] = useState(null);
  const [sidebarDatasets, setSidebarDatasets] = useState([]);
  const [activeDatasetId, setActiveDatasetId] = useState(null);
  const [activatingDataset, setActivatingDataset] = useState(false);

  const [showCombineModal, setShowCombineModal] = useState(false);
  const [combineTitle, setCombineTitle] = useState('');
  const [selectedCombineIds, setSelectedCombineIds] = useState([]);
  const [combineStatus, setCombineStatus] = useState('idle');

  useEffect(() => {
    if (!token) return;
    const fetchSidebarData = async () => {
      try {
        const [dsRes, activeRes] = await Promise.all([
          fetch('/api/datasets', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/active-dataset', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        const dsData = await dsRes.json();
        const activeData = await activeRes.json();
        setSidebarDatasets(dsData.datasets || []);
        if (activeData.active) setActiveDatasetId(activeData.active.id);
      } catch (e) { console.error(e); }
    };
    fetchSidebarData();
  }, [token]);

  const handleActivateDataset = async (datasetId) => {
    setActivatingDataset(true);
    try {
      await fetch(`/api/datasets/${datasetId}/activate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setActiveDatasetId(datasetId);
      setPersistedChart([]);
      setPersistedMetrics({});
      setRecommendations({});
      setLastForecastTime(null);
    } catch (e) { console.error(e); }
    setActivatingDataset(false);
  };

  const refreshSidebarDatasets = async () => {
    try {
      const res = await fetch('/api/datasets', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setSidebarDatasets(data.datasets || []);
    } catch (e) { console.error(e); }
  };

  const handleCombineDatasets = async () => {
    if (!combineTitle || selectedCombineIds.length < 2) return;
    setCombineStatus('loading');
    try {
      const res = await fetch('/api/combine-datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: combineTitle, dataset_ids: selectedCombineIds })
      });
      if (!res.ok) throw new Error('Combine failed');
      const data = await res.json();

      const dsRes = await fetch('/api/datasets', { headers: { 'Authorization': `Bearer ${token}` } });
      const dsData = await dsRes.json();
      setSidebarDatasets(dsData.datasets || []);

      await handleActivateDataset(data.dataset_id);

      setCombineStatus('success');
      setTimeout(() => {
        setShowCombineModal(false);
        setCombineStatus('idle');
        setCombineTitle('');
        setSelectedCombineIds([]);
      }, 1500);
    } catch (e) {
      console.error(e);
      setCombineStatus('error');
    }
  };

  const getValidData = (data, fallback) => {
    if (!lastForecastTime) return fallback;
    if (new Date().getTime() - lastForecastTime > 10 * 60 * 1000) return fallback;
    return data;
  };

  return (
    <div className="flex h-screen" style={{ background: '#09090b' }}>
      {token && (
        <aside className="w-64 flex flex-col border-r" style={{ background: '#0f0f12', borderColor: 'rgba(255,255,255,0.06)' }}>
          {/* Logo */}
          <div className="p-6 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/30 glow-pulse">
              <Zap size={20} />
            </div>
            <h1 className="text-lg font-black text-white tracking-tighter">OPTIMA</h1>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <p className="px-4 text-[9px] font-black text-zinc-600 uppercase tracking-[0.25em] mb-3 mt-1">Analytical Pipeline</p>
            <NavLink to="/" icon={Database}>Data Ingestion</NavLink>
            <NavLink to="/analytics" icon={BarChart2}>Forecasting</NavLink>
            <NavLink to="/qualitative" icon={Brain}>Product Bundler</NavLink>

            <div className="pt-4 mt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="px-4 text-[9px] font-black text-indigo-500 uppercase tracking-[0.25em] mb-3">Executive Output</p>
              <NavLink to="/playbook" icon={Sparkles}>Strategic Playbook</NavLink>
            </div>

            {role === 'ADMIN' && (
              <div className="pt-4 mt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="px-4 text-[9px] font-black text-rose-500 uppercase tracking-[0.25em] mb-3">System</p>
                <NavLink to="/admin" icon={Shield}>Admin Panel</NavLink>
              </div>
            )}
          </nav>

          {/* Dataset selector */}
          <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="px-2 text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <Database size={11} /> Active Source
            </p>
            <div className="relative">
              {(() => {
                const masterDatasets = sidebarDatasets.filter(ds => ds.dataset_type === 'MASTER' || !ds.dataset_type);
                const yearlyDatasets = sidebarDatasets.filter(ds => ds.dataset_type === 'YEARLY');
                return (
                  <>
                    <select
                      value={activeDatasetId || ''}
                      onChange={(e) => handleActivateDataset(parseInt(e.target.value))}
                      disabled={activatingDataset || masterDatasets.length === 0}
                      className="w-full appearance-none rounded-xl px-4 py-3 pr-10 text-xs font-bold text-zinc-200 outline-none transition-all disabled:opacity-50 cursor-pointer"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      {masterDatasets.length === 0 ? <option value="">No datasets</option>
                        : !activeDatasetId ? <option value="">Select dataset...</option> : null}
                      {masterDatasets.map(ds => (
                        <option key={ds.id} value={ds.id} style={{ background: '#18181b' }}>
                          {ds.title} ({ds.row_count.toLocaleString()})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-9 -translate-y-1/2 text-zinc-600 pointer-events-none" />

                    {activeDatasetId && (
                      <p className="text-[9px] font-bold text-emerald-500 mt-2 px-2 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block" />
                        Connected
                      </p>
                    )}

                    <button
                      onClick={() => setShowCombineModal(true)}
                      disabled={yearlyDatasets.length === 0}
                      className="mt-4 w-full px-3 py-2.5 text-[10px] font-black text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all border border-indigo-500/20 uppercase tracking-wider"
                    >
                      + Assemble Yearly Datasets
                    </button>
                  </>
                );
              })()}
            </div>
          </div>


          {/* Logout */}
          <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-xs font-bold text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
            >
              <LogOut size={14} /> Logout
            </button>
            <div className="mt-3 text-[9px] font-bold text-zinc-700 text-center uppercase tracking-widest">
              Thesis Prototype v1.0
            </div>
          </div>
        </aside>
      )}

      <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><DataIngestion onDatasetChange={refreshSidebarDatasets} /></ProtectedRoute>} />
          <Route path="/analytics" element={
            <ProtectedRoute>
              <Analytics
                setGlobalRecommendations={setRecommendations}
                setGlobalLoading={setIsGenerating}
                setPersistedChart={setPersistedChart}
                setPersistedMetrics={setPersistedMetrics}
                setLastForecastTime={setLastForecastTime}
                existingChart={getValidData(persistedChart, [])}
                existingMetrics={getValidData(persistedMetrics, {})}
              />
            </ProtectedRoute>
          } />
          <Route path="/qualitative" element={
            <ProtectedRoute>
              <Qualitative recommendations={getValidData(recommendations, {})} isGenerating={isGenerating} />
            </ProtectedRoute>
          } />
          <Route path="/playbook" element={
            <ProtectedRoute>
              <Playbook
                recommendations={getValidData(recommendations, {})}
                forecastMetrics={getValidData(persistedMetrics, {})}
                isGenerating={isGenerating}
              />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        </Routes>
      </main>

      {/* COMBINE MODAL */}
      {showCombineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl p-8" style={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white">Assemble Master Dataset</h3>
              <button onClick={() => setShowCombineModal(false)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
            </div>

            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">Select the partial/yearly datasets you wish to combine. The system will merge them, remove duplicate entries, and output a fresh Master Dataset.</p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">New Master Dataset Title</label>
                <input
                  type="text" value={combineTitle} onChange={(e) => setCombineTitle(e.target.value)}
                  placeholder="e.g., 2024-2026 Consolidated Sales"
                  className="w-full px-4 py-3 rounded-xl outline-none font-medium text-sm text-white"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Select Chunks to Merge</label>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {sidebarDatasets.filter(ds => ds.dataset_type === 'YEARLY').map(ds => (
                    <label key={ds.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                      <input
                        type="checkbox"
                        checked={selectedCombineIds.includes(ds.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedCombineIds([...selectedCombineIds, ds.id]);
                          else setSelectedCombineIds(selectedCombineIds.filter(id => id !== ds.id));
                        }}
                        className="w-4 h-4 accent-indigo-500 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-200 truncate">{ds.title}</p>
                        <p className="text-[10px] text-zinc-500">{ds.row_count.toLocaleString()} rows</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleCombineDatasets}
                disabled={!combineTitle || selectedCombineIds.length < 2 || combineStatus === 'loading'}
                className="w-full py-3 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#4f46e5,#6366f1)' }}
              >
                {combineStatus === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                Combine {selectedCombineIds.length} Datasets
              </button>
            </div>

            {combineStatus === 'success' && (
              <p className="mt-4 text-xs font-bold text-emerald-400 flex items-center justify-center gap-2"><CheckCircle size={14} /> Successfully combined!</p>
            )}
            {combineStatus === 'error' && (
              <p className="mt-4 text-xs font-bold text-rose-400 flex items-center justify-center gap-2"><AlertCircle size={14} /> Error combining datasets</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
