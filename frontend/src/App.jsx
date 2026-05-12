import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Database, BarChart2, Brain, Sparkles, Zap, Shield, LogOut, ChevronDown, X, Loader2, CheckCircle, AlertCircle, User, Settings, Eye, ChevronUp, CheckCircle2, Sun, Moon } from 'lucide-react';

import DataManagement from './pages/DataManagement';
import Analytics from './pages/Analytics';
import Qualitative from './pages/Qualitative';
import BundlerDetail from './pages/BundlerDetail';
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
        ? 'text-white shadow-lg shadow-indigo-500/20 glow-pulse'
        : 'hover:bg-[var(--glass-bg-hover)]'
        }`}
      style={{ 
        background: isActive ? 'var(--accent)' : 'transparent',
        color: isActive ? '#fff' : 'var(--text-muted)'
      }}
    >
      <Icon size={17} className={isActive ? 'text-white' : ''} style={{ color: isActive ? '#fff' : 'var(--text-faint)' }} />
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
  const { token, role, actualRole, username, firstName, lastName, logout, isNonAdminView, setIsNonAdminView } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
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
  const [accountLogs, setAccountLogs] = useState({ sessions: [], audit_logs: [] });
  const [activeSettingsTab, setActiveSettingsTab] = useState('profile');
  const profileMenuRef = React.useRef(null);

  const validatePassword = (password) => {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password)) return 'Password must include one uppercase letter.';
    if (!/[a-z]/.test(password)) return 'Password must include one lowercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must include one number.';
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return 'Password must include one special character.';
    return '';
  };

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

  const fetchAccountLogs = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/auth/account-activity', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load account logs');
      const data = await res.json();
      setAccountLogs({
        sessions: data.sessions || [],
        audit_logs: data.audit_logs || []
      });
    } catch (err) {
      console.error(err);
    }
  };

  const openSettingsModal = () => {
    setShowProfileMenu(false);
    setActiveSettingsTab('profile');
    setShowSettingsModal(true);
  };

  const closeSettingsModal = () => {
    setShowSettingsModal(false);
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
      const passwordError = validatePassword(passwordForm.new_password);
      if (passwordError) {
        throw new Error(passwordError);
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
    if (showSettingsModal) {
      fetchAccountProfile();
      fetchAccountLogs();
    }
  }, [showSettingsModal]);

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
            <div className="p-2 rounded-xl text-white shadow-lg glow-pulse" style={{ background: 'var(--accent)', boxShadow: '0 10px 15px -3px var(--accent-glow)' }}>
              <Zap size={20} />
            </div>
            <h1 className="text-lg font-black tracking-tighter" style={{ color: 'var(--text-heading)' }}>OPTIMA</h1>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <p className="px-4 text-[9px] font-black uppercase tracking-[0.25em] mb-3 mt-1" style={{ color: 'var(--text-muted)' }}>Analytical Pipeline</p>
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
                <button onClick={openSettingsModal} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold rounded-xl transition-all text-left"
                  style={{ color: 'var(--text-secondary)', transition: 'all 0.2s' }}>
                  <Settings size={16} className="opacity-70" /> Account Settings
                </button>

                {/* Theme Toggle */}
                <button onClick={toggleTheme} className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-bold rounded-xl transition-all text-left"
                  style={{ color: 'var(--text-secondary)' }}>
                  <span className="flex items-center gap-3">
                    {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-400" />}
                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </span>
                </button>

                {actualRole === 'ADMIN' && (
                  <div className="my-1 border-t border-white/5" />
                )}
                {actualRole === 'ADMIN' && (
                  <button onClick={() => setIsNonAdminView(!isNonAdminView)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-bold rounded-xl transition-all text-left"
                    style={{ color: 'var(--text-secondary)' }}>
                    <span className="flex items-center gap-3"><Eye size={16} className={isNonAdminView ? "text-amber-400" : "opacity-70"} /> View as User</span>
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
              className="flex items-center justify-between w-full p-3 rounded-2xl transition-all"
              style={{ background: showProfileMenu ? 'var(--glass-bg)' : 'transparent' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center border" style={{ background: 'var(--card-accent-bg)', borderColor: 'var(--border-strong)' }}>
                  <User size={16} className="text-indigo-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black leading-none mb-1" style={{ color: 'var(--text-heading)' }}>{(firstName || lastName) ? `${firstName || ''}${firstName && lastName ? ' ' : ''}${lastName || ''} (${username})` : (username || 'Account')}</p>
                  <p className="text-[10px] font-bold leading-none uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{role}</p>
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
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        </Routes>
      </main>

      {/* COMBINE MODAL */}
      {showSettingsModal && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeSettingsModal();
          }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto"
          style={{ background: 'var(--overlay-bg)' }}
        >
          <div className="w-full max-w-4xl rounded-[2rem] border shadow-2xl overflow-y-auto" style={{ maxHeight: 'calc(100vh - 4rem)', background: 'var(--modal-bg)', borderColor: 'var(--border-strong)' }}>
            <div className="flex flex-col gap-6 p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.35em]" style={{ color: 'var(--accent)' }}>Account Settings</p>
                  <h2 className="text-3xl font-black mt-2" style={{ color: 'var(--text-heading)' }}>Manage your account</h2>
                  <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>Choose a tab to update your profile, change your password, or review recent activity.</p>
                </div>
                <button
                  onClick={closeSettingsModal}
                  className="rounded-2xl p-3 transition-all self-start"
                  style={{ background: 'var(--input-bg)', color: 'var(--text-secondary)' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
                <div className="rounded-[1.75rem] border p-4" style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)' }}>
                  <div className="space-y-4">
                    {['profile', 'password', 'activity'].map((tab) => {
                      const labels = {
                        profile: 'Profile',
                        password: 'Password',
                        activity: 'Activity'
                      };
                      const descriptions = {
                        profile: 'Update your basic account details.',
                        password: 'Change your password securely.',
                        activity: 'Review recent sign-ins and actions.'
                      };
                      const isActive = activeSettingsTab === tab;
                      return (
                        <button
                          key={tab}
                          onClick={() => setActiveSettingsTab(tab)}
                          className={`w-full rounded-3xl px-4 py-4 text-left transition-all ${isActive ? 'text-white shadow-lg' : 'hover:bg-[var(--glass-bg-hover)]'}`}
                          style={{ background: isActive ? 'var(--accent)' : 'transparent', color: isActive ? '#fff' : 'var(--text-muted)', boxShadow: isActive ? '0 10px 15px -3px var(--accent-glow)' : 'none' }}
                        >
                          <p className="text-sm font-bold uppercase tracking-[0.25em]">{labels[tab]}</p>
                          <p className="mt-2 text-xs leading-relaxed" style={{ color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>{descriptions[tab]}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border p-6" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                  {(settingsError || settingsSuccess) && (
                    <div className="mb-6 space-y-3">
                      {settingsError && (
                        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-200">
                          {settingsError}
                        </div>
                      )}
                      {settingsSuccess && (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-200">
                          {settingsSuccess}
                        </div>
                      )}
                    </div>
                  )}

                  {activeSettingsTab === 'profile' && (
                    <>
                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                          <label className="block text-[10px] uppercase tracking-[0.35em]" style={{ color: 'var(--text-muted)' }}>First Name</label>
                          <input
                            value={accountProfile.first_name}
                            onChange={(e) => setAccountProfile(prev => ({ ...prev, first_name: e.target.value }))}
                            className="w-full rounded-3xl border px-4 py-3 text-sm outline-none transition-all"
                            style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}
                          />
                        </div>
                        <div className="space-y-4">
                          <label className="block text-[10px] uppercase tracking-[0.35em]" style={{ color: 'var(--text-muted)' }}>Last Name</label>
                          <input
                            value={accountProfile.last_name}
                            onChange={(e) => setAccountProfile(prev => ({ ...prev, last_name: e.target.value }))}
                            className="w-full rounded-3xl border px-4 py-3 text-sm outline-none transition-all"
                            style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}
                          />
                        </div>
                        <div className="space-y-4">
                          <label className="block text-[10px] uppercase tracking-[0.35em]" style={{ color: 'var(--text-muted)' }}>Email</label>
                          <input
                            type="email"
                            value={accountProfile.email}
                            onChange={(e) => setAccountProfile(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full rounded-3xl border px-4 py-3 text-sm outline-none transition-all"
                            style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}
                          />
                        </div>
                        <div className="space-y-4">
                          <label className="block text-[10px] uppercase tracking-[0.35em]" style={{ color: 'var(--text-muted)' }}>Phone Number</label>
                          <input
                            value={accountProfile.phone_number}
                            onChange={(e) => setAccountProfile(prev => ({ ...prev, phone_number: e.target.value }))}
                            className="w-full rounded-3xl border px-4 py-3 text-sm outline-none transition-all"
                            style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}
                          />
                        </div>
                        <div className="space-y-4 md:col-span-2">
                          <label className="block text-[10px] uppercase tracking-[0.35em]" style={{ color: 'var(--text-muted)' }}>Middle Name</label>
                          <input
                            value={accountProfile.middle_name}
                            onChange={(e) => setAccountProfile(prev => ({ ...prev, middle_name: e.target.value }))}
                            className="w-full rounded-3xl border px-4 py-3 text-sm outline-none transition-all"
                            style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}
                          />
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col sm:flex-row gap-4">
                        <button
                          onClick={handleSaveAccountProfile}
                          disabled={settingsLoading}
                          className="w-full sm:w-auto px-8 py-4 rounded-3xl text-white font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50"
                          style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 10px 15px -3px var(--accent-glow)' }}
                        >
                          {settingsLoading ? 'Saving...' : 'Save Profile'}
                        </button>
                      </div>
                    </>
                  )}

                  {activeSettingsTab === 'password' && (
                    <>
                      <div className="space-y-4">
                        <label className="block text-[10px] uppercase tracking-[0.35em]" style={{ color: 'var(--text-muted)' }}>Current Password</label>
                        <input
                          type="password"
                          placeholder="Current password"
                          value={passwordForm.current_password}
                          onChange={(e) => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))}
                          className="w-full rounded-3xl border px-4 py-3 text-sm outline-none transition-all"
                          style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}
                        />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 mt-4">
                        <div className="space-y-4">
                          <label className="block text-[10px] uppercase tracking-[0.35em]" style={{ color: 'var(--text-muted)' }}>New Password</label>
                          <input
                            type="password"
                            placeholder="New password"
                            value={passwordForm.new_password}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
                            className="w-full rounded-3xl border px-4 py-3 text-sm outline-none transition-all"
                            style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}
                          />
                        </div>
                        <div className="space-y-4">
                          <label className="block text-[10px] uppercase tracking-[0.35em]" style={{ color: 'var(--text-muted)' }}>Confirm Password</label>
                          <input
                            type="password"
                            placeholder="Confirm new password"
                            value={passwordForm.confirm_password}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                            className="w-full rounded-3xl border px-4 py-3 text-sm outline-none transition-all"
                            style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleChangePassword}
                        disabled={settingsLoading}
                        className="mt-6 w-full sm:w-auto px-8 py-4 rounded-3xl text-white font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50"
                        style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 10px 15px -3px var(--accent-glow)' }}
                      >
                        {settingsLoading ? 'Updating...' : 'Change Password'}
                      </button>
                    </>
                  )}

                  {activeSettingsTab === 'activity' && (
                    <div className="space-y-8">
                      <div>
                        <div className="flex items-center justify-between gap-4 mb-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.35em]" style={{ color: 'var(--accent)' }}>Account Activity</p>
                            <h3 className="text-xl font-black" style={{ color: 'var(--text-heading)' }}>Recent activity</h3>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {accountLogs.audit_logs.length === 0 ? (
                            <p className="text-sm" style={{ color: 'var(--text-faint)' }}>No recent account activity found.</p>
                          ) : (
                            accountLogs.audit_logs.slice(0, 5).map((log, index) => (
                              <div key={index} className="rounded-3xl border p-4" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>{log.action}</span>
                                  <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{new Date(log.timestamp).toLocaleString()}</span>
                                </div>
                                <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>{log.details}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.35em] mb-4" style={{ color: '#10b981' }}>Recent sessions</p>
                        <div className="space-y-4">
                          {accountLogs.sessions.length === 0 ? (
                            <p className="text-sm" style={{ color: 'var(--text-faint)' }}>No session history found.</p>
                          ) : (
                            accountLogs.sessions.slice(0, 5).map((session) => (
                              <div key={session.id} className="rounded-3xl border p-4" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                                <div className="flex flex-col gap-1">
                                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{session.role} Session</span>
                                  <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>Login: {new Date(session.login_time).toLocaleString()}</span>
                                  <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{session.logout_time ? `Logout: ${new Date(session.logout_time).toLocaleString()}` : 'Active session'}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showCombineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in" style={{ background: 'var(--overlay-bg)' }}>
          <div className="w-full max-w-lg rounded-3xl p-8" style={{ background: 'var(--modal-bg)', border: `1px solid var(--border-strong)` }}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black" style={{ color: 'var(--text-heading)' }}>Assemble Master Dataset</h3>
              <button onClick={() => setShowCombineModal(false)} className="transition-colors hover:opacity-70" style={{ color: 'var(--text-faint)' }}><X size={20} /></button>
            </div>

            <p className="text-xs mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>Select the partial/yearly datasets you wish to combine. The system will merge them, remove duplicate entries, and output a fresh Master Dataset.</p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-faint)' }}>New Master Dataset Title</label>
                <input
                  type="text" value={combineTitle} onChange={(e) => setCombineTitle(e.target.value)}
                  placeholder="e.g., 2024-2026 Consolidated Sales"
                  className="w-full px-4 py-3 rounded-xl outline-none font-medium text-sm"
                  style={{ background: 'var(--input-bg)', border: `1px solid var(--border-subtle)`, color: 'var(--input-text)' }}
                />
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-faint)' }}>Select Chunks to Merge</label>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {sidebarDatasets.filter(ds => ds.dataset_type === 'YEARLY').map(ds => (
                    <label key={ds.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:opacity-70" 
                      style={{ background: 'var(--input-bg)', border: `1px solid var(--border-subtle)` }}>
                      <input
                        type="checkbox"
                        checked={selectedCombineIds.includes(ds.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedCombineIds([...selectedCombineIds, ds.id]);
                          else setSelectedCombineIds(selectedCombineIds.filter(id => id !== ds.id));
                        }}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{ds.title}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{ds.row_count.toLocaleString()} rows</p>
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
                style={{ background: 'var(--accent)', boxShadow: '0 10px 15px -3px var(--accent-glow)' }}
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
