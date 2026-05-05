import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Database, BarChart2, Brain, Sparkles, Zap, Shield, LogOut, ChevronDown } from 'lucide-react';

import DataIngestion from './pages/DataIngestion';
import Analytics from './pages/Analytics';
import Qualitative from './pages/Qualitative';
import Playbook from './pages/Playbook';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Helper component for navigation styling
function NavLink({ to, icon: Icon, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all font-medium ${isActive
        ? 'bg-indigo-600 text-white shadow-lg'
        : 'text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'
        }`}
    >
      <Icon size={20} />
      {children}
    </Link>
  );
}

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" />;
  }
  return children;
};

// Admin Route Component
const AdminRoute = ({ children }) => {
  const { token, role } = useAuth();
  if (!token || role !== 'ADMIN') {
    return <Navigate to="/" />;
  }
  return children;
};

function AppContent() {
  const { token, role, logout } = useAuth();
  
  // --- GLOBAL PERSISTENCE STATES ---
  const [recommendations, setRecommendations] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);

  // Forecast Persistence (Module 2)
  const [persistedChart, setPersistedChart] = useState([]);
  const [persistedMetrics, setPersistedMetrics] = useState({});
  const [lastForecastTime, setLastForecastTime] = useState(null);

  // Active Dataset State
  const [sidebarDatasets, setSidebarDatasets] = useState([]);
  const [activeDatasetId, setActiveDatasetId] = useState(null);
  const [activatingDataset, setActivatingDataset] = useState(false);

  // Fetch datasets and active dataset on login
  useEffect(() => {
    if (!token) return;
    const fetchSidebarData = async () => {
      try {
        const [dsRes, activeRes] = await Promise.all([
          fetch('http://localhost:8000/api/datasets', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('http://localhost:8000/api/active-dataset', { headers: { 'Authorization': `Bearer ${token}` } })
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
      await fetch(`http://localhost:8000/api/datasets/${datasetId}/activate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setActiveDatasetId(datasetId);
      // Reset persisted forecast data since dataset changed
      setPersistedChart([]);
      setPersistedMetrics({});
      setRecommendations({});
      setLastForecastTime(null);
    } catch (e) { console.error(e); }
    setActivatingDataset(false);
  };

  // Refresh sidebar datasets when navigating back to data ingestion
  const refreshSidebarDatasets = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/datasets', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setSidebarDatasets(data.datasets || []);
    } catch (e) { console.error(e); }
  };

  // Helper to check if data is still valid (10-minute rule)
  const getValidData = (data, fallback) => {
    if (!lastForecastTime) return fallback;
    const now = new Date().getTime();
    const tenMinutes = 10 * 60 * 1000;

    if (now - lastForecastTime > tenMinutes) {
      return fallback;
    }
    return data;
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-800">
      {/* SIDEBAR NAVIGATION (Only show if logged in) */}
      {token && (
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
          <div className="p-6 flex items-center gap-3 border-b border-gray-100">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-indigo-200 shadow-lg">
              <Zap size={24} />
            </div>
            <h1 className="text-xl font-black text-gray-900 tracking-tighter italic">OPTIMA</h1>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <p className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 mt-2">Analytical Pipeline</p>
            <NavLink to="/" icon={Database}>1. Data Ingestion</NavLink>
            <NavLink to="/analytics" icon={BarChart2}>2. Forecasting</NavLink>
            <NavLink to="/qualitative" icon={Brain}>3. Product Bundler</NavLink>

            <div className="pt-4 mt-4 border-t border-gray-50">
              <p className="px-4 text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Executive Output</p>
              <NavLink to="/playbook" icon={Sparkles}>4. Strategic Playbook</NavLink>
            </div>
            
            {role === 'ADMIN' && (
              <div className="pt-4 mt-4 border-t border-gray-50">
                <p className="px-4 text-[10px] font-black text-red-400 uppercase tracking-[0.2em] mb-4">System Settings</p>
                <NavLink to="/admin" icon={Shield}>Admin Panel</NavLink>
              </div>
            )}
          </nav>

          {/* ACTIVE DATASET SELECTOR */}
          <div className="px-4 py-4 border-t border-gray-100">
            <p className="px-2 text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <Database size={12} /> Active Source
            </p>
            <div className="relative">
              <select
                value={activeDatasetId || ''}
                onChange={(e) => handleActivateDataset(parseInt(e.target.value))}
                disabled={activatingDataset || sidebarDatasets.length === 0}
                className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all disabled:opacity-50 cursor-pointer"
              >
                {sidebarDatasets.length === 0 ? (
                  <option value="">No datasets</option>
                ) : !activeDatasetId ? (
                  <option value="">Select dataset...</option>
                ) : null}
                {sidebarDatasets.map(ds => (
                  <option key={ds.id} value={ds.id}>
                    {ds.title} ({ds.row_count.toLocaleString()})
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {activeDatasetId && (
              <p className="text-[10px] font-bold text-emerald-500 mt-2 px-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                Connected
              </p>
            )}
          </div>

          <div className="p-4 border-t border-gray-100">
            <button 
              onClick={logout}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={16} /> Logout
            </button>
            <div className="mt-4 text-[10px] font-bold text-gray-300 text-center uppercase tracking-widest">
              Thesis Prototype v1.0
            </div>
          </div>
        </aside>
      )}

      {/* MAIN PAGE CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-8">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/" element={<ProtectedRoute><DataIngestion onDatasetChange={refreshSidebarDatasets} /></ProtectedRoute>} />

          <Route
            path="/analytics"
            element={
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
            }
          />

          <Route
            path="/qualitative"
            element={
              <ProtectedRoute>
                <Qualitative
                  recommendations={getValidData(recommendations, {})}
                  isGenerating={isGenerating}
                />
              </ProtectedRoute>
            }
          />

          <Route
            path="/playbook"
            element={
              <ProtectedRoute>
                <Playbook
                  recommendations={getValidData(recommendations, {})}
                  forecastMetrics={getValidData(persistedMetrics, {})}
                  isGenerating={isGenerating}
                />
              </ProtectedRoute>
            }
          />
          
          <Route 
            path="/admin" 
            element={<AdminRoute><AdminDashboard /></AdminRoute>} 
          />
        </Routes>
      </main>
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