import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Database, BarChart2, Brain, Sparkles, Zap, Shield, LogOut, ChevronDown, X, Loader2, CheckCircle, AlertCircle, User, Settings, Eye, ChevronUp, CheckCircle2, Sun, Moon } from 'lucide-react';

import DataManagement from './pages/DataManagement';
import Analytics from './pages/Analytics';
import Qualitative from './pages/Qualitative';
import BundlerDetail from './pages/BundlerDetail';
import Playbook from './pages/Playbook';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

// Dynamic page titles
const PAGE_TITLES = {
  '/': 'Data & Models — Optima',
  '/analytics': 'Analytics — Optima',
  '/qualitative': 'Product Bundler — Optima',
  '/executive-output': 'Executive Output — Optima',
  '/account-settings': 'Account Settings — Optima',
  '/admin': 'Admin Panel — Optima',
  '/login': 'Sign In — Optima',
  '/register': 'Register — Optima',
};

function usePageTitle() {
  const location = useLocation();
  useEffect(() => {
    document.title = PAGE_TITLES[location.pathname] || 'Optima';
  }, [location.pathname]);
}

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
  const location = useLocation();
  const navigate = useNavigate();
  const previousPathRef = React.useRef('/');
  const { token, role, actualRole, username, logout, isNonAdminView, setIsNonAdminView } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(location.pathname === '/account-settings');
  const [accountProfile, setAccountProfile] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    email: '',
    phone_number: ''
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState(null);
  const [settingsSuccess, setSettingsSuccess] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const profileMenuRef = React.useRef(null);

  const fetchAccountProfile = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/auth/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load account data');
      const data = await res.json();
      setAccountProfile({
        first_name: data.profile.first_name || '',
        last_name: data.profile.last_name || '',
        middle_name: data.profile.middle_name || '',
        email: data.profile.email || '',
        phone_number: data.profile.phone_number || ''
      });
      setSettingsError(null);
    } catch (err) {
      console.error(err);
      setSettingsError('Unable to load account settings.');
    }
  };

  const openSettingsModal = () => {
    setShowProfileMenu(false);
    if (location.pathname !== '/account-settings') {
      previousPathRef.current = location.pathname;
      navigate('/account-settings');
    } else {
      setShowSettingsModal(true);
    }
  };

  const closeSettingsModal = () => {
    setShowSettingsModal(false);
    if (location.pathname === '/account-settings') {
      navigate(previousPathRef.current || '/');
    }
  };

  const handleSaveAccountProfile = async () => {
    setSettingsError(null);
    setSettingsSuccess(null);
    setSettingsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(accountProfile)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to update account');
      }
      setSettingsSuccess('Account details updated successfully.');
    } catch (err) {
      console.error(err);
      setSettingsError(err.message || 'Unable to update account.');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setSettingsError(null);
    setSettingsSuccess(null);
    setSettingsLoading(true);
    try {
      if (passwordForm.new_password !== passwordForm.confirm_password) {
        throw new Error('New password and confirmation do not match.');
      }
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/profile/password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(passwordForm)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Password change failed');
      }
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setSettingsSuccess('Password changed successfully.');
    } catch (err) {
      console.error(err);
      setSettingsError(err.message || 'Unable to change password.');
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    const isAccountSettings = location.pathname === '/account-settings';
    setShowSettingsModal(isAccountSettings);
    if (isAccountSettings) fetchAccountProfile();
  }, [location.pathname]);

  // Click-away listener for profile menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileMenuRef]);

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

  // Forecast persistence states
  const [forecastEndDate, setForecastEndDate] = useState('');
  const [forecastSelectionMode, setForecastSelectionMode] = useState('top');
  const [forecastTopN, setForecastTopN] = useState(5);
  const [forecastSelectedItems, setForecastSelectedItems] = useState([]);
  const [auditProgress, setAuditProgress] = useState(0);

  // Dynamic page title
  usePageTitle();

  useEffect(() => {
    let interval;
    if (isGenerating) {
      setAuditProgress(0);
      interval = setInterval(() => {
        setAuditProgress(prev => {
          if (prev >= 99.9) return 99.9;
          if (prev >= 90) return prev + 0.05;
          if (prev >= 75) return prev + 0.1;
          if (prev >= 50) return prev + 0.3;
          return prev + 1;
        });
      }, 800);
    } else {
      setAuditProgress(0);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

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
        const datasets = dsData.datasets || [];
        setSidebarDatasets(datasets);
        
        if (activeData.active) {
          setActiveDatasetId(activeData.active.id);
        } else if (datasets.length > 0) {
          // Auto-activate the first dataset if none is active
          handleActivateDataset(datasets[0].id);
        }
      } catch (e) { console.error(e); }
    };
    fetchSidebarData();
  }, [token]);

  const handleActivateDataset = async (datasetId) => {
    setActivatingDataset(true);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/activate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to activate dataset.");
      }
      setActiveDatasetId(datasetId);
      setPersistedChart([]);
      setPersistedMetrics({});
      setRecommendations({});
      setLastForecastTime(null);
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to activate dataset. Please try again.");
    }
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
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Combine failed');
      }
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
    <div className="flex h-screen" style={{ background: 'var(--bg-base)' }}>
      {token && (
        <aside className="w-64 flex flex-col border-r" style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}>
          {/* Logo */}
          <div className="p-6 flex items-center gap-3" style={{ borderBottom: `1px solid var(--border)` }}>
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/30 glow-pulse">
              <Zap size={20} />
            </div>
            <h1 className="text-lg font-black text-white tracking-tighter">OPTIMA</h1>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <p className="px-4 text-[9px] font-black text-zinc-600 uppercase tracking-[0.25em] mb-3 mt-1">Analytical Pipeline</p>
            <NavLink to="/" icon={Database}>Management Hub</NavLink>
            <NavLink to="/analytics" icon={BarChart2}>Forecasting</NavLink>
            <NavLink to="/qualitative" icon={Brain}>Product Bundler</NavLink>

            {role === 'ADMIN' && (
              <div className="pt-4 mt-4" style={{ borderTop: `1px solid var(--border-subtle)` }}>
                <p className="px-4 text-[9px] font-black text-rose-500 uppercase tracking-[0.25em] mb-3">System</p>
                <NavLink to="/admin" icon={Shield}>Admin Panel</NavLink>
              </div>
            )}
          </nav>

          {/* Account Profile Card */}
          <div ref={profileMenuRef} className="p-4 relative" style={{ borderTop: `1px solid var(--border)` }}>
            {showProfileMenu && (
              <div className="absolute bottom-full mb-2 left-4 right-4 rounded-2xl p-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2 z-50"
                style={{ background: 'var(--profile-menu-bg)', border: `1px solid var(--border-strong)` }}>
<button onClick={openSettingsModal} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl transition-all text-left">
                  <Settings size={16} className="text-zinc-500" /> Account Settings
                </button>

                {/* Theme Toggle */}
                <button onClick={toggleTheme} className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-bold text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl transition-all text-left">
                  <span className="flex items-center gap-3">
                    {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-400" />}
                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </span>
                </button>

                {actualRole === 'ADMIN' && (
                  <div className="my-1 border-t border-white/5" />
                )}
                {actualRole === 'ADMIN' && (
                  <button onClick={() => setIsNonAdminView(!isNonAdminView)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-bold text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl transition-all text-left">
                    <span className="flex items-center gap-3"><Eye size={16} className={isNonAdminView ? "text-amber-400" : "text-zinc-500"} /> View as User</span>
                    {isNonAdminView && <CheckCircle2 size={14} className="text-amber-400" />}
                  </button>
                )}

                <div className="my-1 border-t border-white/5" />
                <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all text-left">
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}

            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center justify-between w-full p-3 rounded-2xl hover:bg-white/5 transition-all"
              style={{ background: showProfileMenu ? 'var(--glass-bg)' : 'transparent' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                  <User size={16} className="text-indigo-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-white leading-none mb-1">{username || 'Account'}</p>
                  <p className="text-[10px] font-bold text-zinc-500 leading-none uppercase tracking-widest">{role}</p>
                </div>
              </div>
              {showProfileMenu ? <ChevronDown size={16} className="text-zinc-500" /> : <ChevronUp size={16} className="text-zinc-500" />}
            </button>
          </div>
        </aside>
      )}

      <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <DataManagement 
                      onDatasetChange={refreshSidebarDatasets} 
                      onActivate={handleActivateDataset}
                    />
                  </ProtectedRoute>
                } 
              />
          <Route path="/analytics" element={
            <ProtectedRoute>
              <Analytics
                activeDatasetId={activeDatasetId}
                isGenerating={isGenerating}
                setGlobalRecommendations={setRecommendations}
                setGlobalLoading={setIsGenerating}
                setPersistedChart={setPersistedChart}
                setPersistedMetrics={setPersistedMetrics}
                setLastForecastTime={setLastForecastTime}
                existingChart={getValidData(persistedChart, [])}
                existingMetrics={getValidData(persistedMetrics, {})}
                // Persisted Config
                endDate={forecastEndDate}
                setEndDate={setForecastEndDate}
                selectionMode={forecastSelectionMode}
                setSelectionMode={setForecastSelectionMode}
                topN={forecastTopN}
                setTopN={setForecastTopN}
                selectedManualItems={forecastSelectedItems}
                setSelectedManualItems={setForecastSelectedItems}
                progress={auditProgress}
              />
            </ProtectedRoute>
          } />
          <Route path="/qualitative" element={
            <ProtectedRoute>
              <Qualitative 
                activeDatasetId={activeDatasetId} 
                sidebarDatasets={sidebarDatasets}
              />
            </ProtectedRoute>
          } />
          <Route path="/bundler/runs/:runId" element={
            <ProtectedRoute>
              <BundlerDetail />
            </ProtectedRoute>
          } />
          <Route path="/playbook" element={<Navigate to="/executive-output" replace />} />
          <Route path="/account-settings" element={
            <ProtectedRoute>
              <div className="min-h-full" />
            </ProtectedRoute>
          } />
          <Route path="/executive-output" element={
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
      {showSettingsModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-3xl rounded-[2.5rem] p-8 bg-[#0f172a] border border-white/10 shadow-2xl overflow-y-auto" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-400">Account Settings</p>
                <h2 className="text-3xl font-black text-white mt-2">Manage your account</h2>
                <p className="text-sm text-zinc-500 mt-2 max-w-2xl">Update your profile details and change your password securely.</p>
              </div>
              <button
                onClick={closeSettingsModal}
                className="rounded-2xl bg-white/5 p-3 text-zinc-300 hover:bg-white/10 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {settingsError && (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-200 mb-4">
                {settingsError}
              </div>
            )}
            {settingsSuccess && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-200 mb-4">
                {settingsSuccess}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <label className="block text-[10px] uppercase tracking-[0.35em] text-zinc-500">First Name</label>
                <input
                  value={accountProfile.first_name}
                  onChange={(e) => setAccountProfile(prev => ({ ...prev, first_name: e.target.value }))}
                  className="w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-4">
                <label className="block text-[10px] uppercase tracking-[0.35em] text-zinc-500">Last Name</label>
                <input
                  value={accountProfile.last_name}
                  onChange={(e) => setAccountProfile(prev => ({ ...prev, last_name: e.target.value }))}
                  className="w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-4">
                <label className="block text-[10px] uppercase tracking-[0.35em] text-zinc-500">Email</label>
                <input
                  type="email"
                  value={accountProfile.email}
                  onChange={(e) => setAccountProfile(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-4">
                <label className="block text-[10px] uppercase tracking-[0.35em] text-zinc-500">Phone Number</label>
                <input
                  value={accountProfile.phone_number}
                  onChange={(e) => setAccountProfile(prev => ({ ...prev, phone_number: e.target.value }))}
                  className="w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-4 md:col-span-2">
                <label className="block text-[10px] uppercase tracking-[0.35em] text-zinc-500">Middle Name</label>
                <input
                  value={accountProfile.middle_name}
                  onChange={(e) => setAccountProfile(prev => ({ ...prev, middle_name: e.target.value }))}
                  className="w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleSaveAccountProfile}
                disabled={settingsLoading}
                className="w-full sm:w-auto px-8 py-4 rounded-3xl bg-emerald-500 text-white font-black uppercase tracking-[0.2em] hover:bg-emerald-400 transition-all disabled:opacity-50"
              >
                {settingsLoading ? 'Saving...' : 'Save Profile'}
              </button>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-full sm:w-auto px-8 py-4 rounded-3xl border border-white/10 text-white uppercase tracking-[0.2em] hover:bg-white/5 transition-all"
              >
                Close
              </button>
            </div>

            <div className="mt-12 rounded-[2rem] border border-white/10 bg-black/20 p-6">
              <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500 mb-3">Change Password</p>
              <div className="grid gap-4 md:grid-cols-3">
                <input
                  type="password"
                  placeholder="Current password"
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))}
                  className="w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                />
                <input
                  type="password"
                  placeholder="New password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
                  className="w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                  className="w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={handleChangePassword}
                disabled={settingsLoading}
                className="mt-6 w-full sm:w-auto px-8 py-4 rounded-3xl bg-indigo-500 text-white font-black uppercase tracking-[0.2em] hover:bg-indigo-400 transition-all disabled:opacity-50"
              >
                {settingsLoading ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showCombineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in" style={{ background: 'var(--overlay-bg)' }}>
          <div className="w-full max-w-lg rounded-3xl p-8" style={{ background: 'var(--modal-bg)', border: `1px solid var(--border-strong)` }}>
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
                  className="w-full px-4 py-3 rounded-xl outline-none font-medium text-sm"
                  style={{ background: 'var(--input-bg)', border: `1px solid var(--input-border)`, color: 'var(--input-text)' }}
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Select Chunks to Merge</label>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {sidebarDatasets.filter(ds => ds.dataset_type === 'YEARLY').map(ds => (
                    <label key={ds.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors" style={{ border: `1px solid var(--border-subtle)` }}>
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
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
