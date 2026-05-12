import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Check, X, Users, Activity, FileText, Clock, LogOut, ShieldOff } from 'lucide-react';

export default function AdminDashboard() {
  const { token, username } = useAuth();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountActivity, setAccountActivity] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [sessionLogs, setSessionLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('accounts');
  const [loading, setLoading] = useState(true);

  const fetchPendingUsers = async () => {
    try {
      const res = await fetch('/api/admin/pending-users', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setPendingUsers(data.users || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit-logs', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setAuditLogs(data.logs || []);
    } catch (err) { console.error(err); }
  };

  const fetchSessionLogs = async () => {
    try {
      const res = await fetch('/api/admin/session-logs', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setSessionLogs(data.sessions || []);
    } catch (err) { console.error(err); }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/admin/accounts', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setAccounts(data.accounts || []);
    } catch (err) { console.error(err); }
  };

  const fetchAccountActivity = async (accountUsername) => {
    setSelectedAccount(accountUsername);
    setAccountActivity(null);
    try {
      const res = await fetch(`/api/admin/accounts/${encodeURIComponent(accountUsername)}/activity`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setAccountActivity(data);
    } catch (err) { console.error(err); }
  };

  const handleForceEnd = async (session_id) => {
    if (!window.confirm('Force-end this session? The user will be immediately logged out.')) return;
    try {
      const res = await fetch('/api/admin/force-end-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id })
      });
      if (res.ok) { await fetchSessionLogs(); await fetchAccounts(); }
      else alert('Failed to force-end session.');
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchPendingUsers(); fetchAuditLogs(); fetchSessionLogs(); fetchAccounts(); }, [token]);

  const handleAction = async (actionUsername, action) => {
    try {
      const res = await fetch(`/api/admin/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: actionUsername })
      });
      if (res.ok) {
        setPendingUsers(pendingUsers.filter(u => u.username !== actionUsername));
        fetchAccounts();
        fetchAuditLogs();
      }
    } catch (err) { console.error(err); }
  };

  const updateAccount = async (accountUsername, patch) => {
    try {
      const res = await fetch(`/api/admin/accounts/${encodeURIComponent(accountUsername)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.detail || 'Account update failed.');
        return;
      }
      await fetchAccounts();
      await fetchPendingUsers();
      await fetchAuditLogs();
      if (selectedAccount === accountUsername) await fetchAccountActivity(accountUsername);
    } catch (err) { console.error(err); }
  };

  const glass = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(12px)' };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <Shield size={24} className="text-rose-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Admin Control Panel</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Logged in as <span className="text-indigo-400 font-bold">{username}</span></p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-5">
        {[
          { label: 'Total Sessions', value: sessionLogs.length, icon: <Clock size={20} />, color: 'var(--card-accent-bg)', textColor: 'var(--accent)' },
          { label: 'Pending Approvals', value: pendingUsers.length, icon: <Users size={20} />, color: 'rgba(249,115,22,0.1)', textColor: '#fb923c' },
          { label: 'Managed Accounts', value: accounts.length, icon: <Activity size={20} />, color: 'rgba(52,211,153,0.1)', textColor: '#34d399' },
        ].map(({ label, value, icon, color, textColor }) => (
          <div key={label} className="p-5 rounded-2xl flex items-center gap-4" style={glass}>
            <div className="p-3 rounded-xl flex-shrink-0" style={{ background: color }}>
              <span style={{ color: textColor }}>{icon}</span>
            </div>
            <div>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{label}</p>
              <p className="text-2xl font-black text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Panel */}
      <div className="rounded-2xl overflow-hidden" style={glass}>
        {/* Tab Bar */}
        <div className="flex" style={{ borderBottom: `1px solid var(--border)` }}>
          {[['accounts', Shield, 'Accounts'], ['sessions', Clock, 'Session Log'], ['audit', FileText, 'Audit Trail'], ['queue', Users, 'Registration Queue']].map(([id, Icon, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-black uppercase tracking-widest transition-all ${activeTab === id ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-zinc-600 hover:text-zinc-300'}`}
              style={activeTab === id ? { background: 'var(--card-accent-bg)' } : {}}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {/* Account Management */}
        {activeTab === 'accounts' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] min-h-[480px] gap-4">
            <div className="max-h-[560px] overflow-y-auto custom-scrollbar" style={{ borderRight: `1px solid var(--border)` }}>
              {accounts.length === 0 ? (
                <div className="p-8 text-center text-zinc-600 text-sm">No accounts found.</div>
              ) : (
                <>
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="min-w-[700px] w-full text-sm">
                      <thead className="sticky top-0 z-10" style={{ background: 'var(--table-header-bg)', borderBottom: `1px solid var(--border)` }}>
                        <tr>
                          {['Account', 'Role', 'Status', 'Activity', 'Controls'].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-[9px] font-black text-zinc-600 uppercase tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map((account) => (
                          <tr key={account.username} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: `1px solid var(--table-border)` }}>
                            <td className="px-5 py-3">
                              <button onClick={() => fetchAccountActivity(account.username)} className="text-left">
                                <p className="font-bold text-xs" style={{ color: 'var(--text-heading)' }}>{account.username}</p>
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{[account.first_name, account.last_name].filter(Boolean).join(' ') || account.email || 'No profile details'}</p>
                              </button>
                            </td>
                            <td className="px-5 py-3">
                              <select value={account.role} onChange={(e) => updateAccount(account.username, { role: e.target.value })}
                                className="bg-transparent border border-white/10 rounded-lg px-2 py-1 text-[10px] font-black uppercase text-zinc-300"
                                style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}>
                                <option value="USER">USER</option>
                                <option value="ADMIN">ADMIN</option>
                              </select>
                            </td>
                            <td className="px-5 py-3">
                              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em]" 
                                style={{ 
                                  background: account.status === 'approved' ? 'rgba(52,211,153,0.15)' : account.status === 'banned' ? 'rgba(239,68,68,0.12)' : account.status === 'denied' ? 'rgba(248,113,113,0.12)' : 'rgba(147,197,253,0.12)',
                                  color: account.status === 'approved' ? '#10b981' : account.status === 'banned' ? '#f43f5e' : account.status === 'denied' ? '#f43f5e' : '#3b82f6'
                                }}>
                                {account.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-[10px] text-zinc-500">
                              <p>{account.active_sessions} active</p>
                              <p>{account.last_login ? new Date(account.last_login).toLocaleString() : 'Never logged in'}</p>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex flex-col gap-1.5">
                                {account.status === 'banned' ? (
                                  <button onClick={() => updateAccount(account.username, { status: 'approved' })}
                                    className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-400/10"
                                    style={{ border: '1px solid rgba(52,211,153,0.2)' }}>
                                    Reactivate
                                  </button>
                                ) : (
                                  <button onClick={() => updateAccount(account.username, { status: 'banned' })}
                                    className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-400/10"
                                    style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                                    Ban
                                  </button>
                                )}
                                <button onClick={() => fetchAccountActivity(account.username)}
                                  className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-400/10"
                                  style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
                                  View Log
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="sm:hidden space-y-4 px-4 py-3">
                    {accounts.map((account) => (
                      <div key={account.username} className="rounded-3xl border p-4 space-y-3" style={glass}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-sm" style={{ color: 'var(--text-heading)' }}>{account.username}</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{[account.first_name, account.last_name].filter(Boolean).join(' ') || account.email || 'No profile details'}</p>
                          </div>
                          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white" style={{ background: account.status === 'approved' ? 'rgba(52,211,153,0.15)' : account.status === 'banned' ? 'rgba(239,68,68,0.12)' : account.status === 'denied' ? 'rgba(248,113,113,0.12)' : 'rgba(147,197,253,0.12)' }}>
                            {account.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-[10px] text-zinc-500">
                          <div>
                            <p className="font-black uppercase tracking-[0.2em]">Role</p>
                            <select value={account.role} onChange={(e) => updateAccount(account.username, { role: e.target.value })}
                              className="mt-2 w-full bg-transparent border rounded-lg px-2 py-2 text-xs"
                              style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}>
                              <option value="USER">USER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          </div>
                          <div>
                            <p className="font-black uppercase tracking-[0.2em]">Activity</p>
                            <p className="mt-2">{account.active_sessions} active</p>
                            <p>{account.last_login ? new Date(account.last_login).toLocaleString() : 'Never logged in'}</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {account.status === 'banned' ? (
                            <button onClick={() => updateAccount(account.username, { status: 'approved' })}
                              className="w-full rounded-xl border border-emerald-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-400/10">
                              Reactivate
                            </button>
                          ) : (
                            <button onClick={() => updateAccount(account.username, { status: 'banned' })}
                              className="w-full rounded-xl border border-rose-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-400/10">
                              Ban
                            </button>
                          )}
                          <button onClick={() => fetchAccountActivity(account.username)}
                            className="w-full rounded-xl border border-indigo-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-400/10">
                            View Log
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="max-h-[560px] overflow-y-auto custom-scrollbar">
              {!selectedAccount ? (
                <div className="p-8 text-center text-zinc-600 text-sm">Select an account to view its activity log.</div>
              ) : !accountActivity ? (
                <div className="p-8 text-center text-zinc-600 text-sm">Loading {selectedAccount}...</div>
              ) : (
                <div className="p-5 space-y-6">
                  <div>
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Account Log</p>
                    <h2 className="text-lg font-black text-white">{selectedAccount}</h2>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Recent Account Changes</p>
                    {(accountActivity.audit_logs || []).length === 0 ? (
                      <p className="text-xs text-zinc-600">No account changes recorded.</p>
                    ) : accountActivity.audit_logs.map((log, i) => (
                      <div key={i} className="py-3" style={{ borderBottom: `1px solid var(--table-border)` }}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">{log.action}</span>
                          <span className="text-[9px] text-zinc-600">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1"><span className="text-zinc-200 font-bold">{log.username}</span>: {log.details}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2">Login Sessions</p>
                    {(accountActivity.sessions || []).length === 0 ? (
                      <p className="text-xs text-zinc-600">No sessions recorded.</p>
                    ) : accountActivity.sessions.map((session) => (
                      <div key={session.id} className="py-3" style={{ borderBottom: `1px solid var(--table-border)` }}>
                        <p className="text-xs font-bold text-zinc-300">{new Date(session.login_time).toLocaleString()}</p>
                        <p className="text-[10px] text-zinc-600">
                          {session.logout_time ? `Logged out ${new Date(session.logout_time).toLocaleString()}` : 'Active session'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Registration Queue */}
        {activeTab === 'queue' && (
          loading ? (
            <div className="p-8 text-center text-zinc-600 text-sm">Loading queue...</div>
          ) : pendingUsers.length === 0 ? (
            <div className="p-12 text-center">
              <Shield size={40} className="mx-auto text-zinc-700 mb-3" />
              <p className="text-zinc-600 font-medium text-sm">No pending registrations.</p>
            </div>
          ) : (
            <ul>
              {pendingUsers.map(user => (
                <li key={user.username} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                  style={{ borderBottom: `1px solid var(--table-border)` }}>
                  <div>
                    <p className="font-bold text-white text-sm">{user.username}</p>
                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-0.5">Status: {user.status}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAction(user.username, 'approve')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-emerald-400 text-xs font-black uppercase tracking-widest transition-all hover:bg-emerald-400/10"
                      style={{ border: '1px solid rgba(52,211,153,0.2)' }}>
                      <Check size={14} /> Approve
                    </button>
                    <button onClick={() => handleAction(user.username, 'deny')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-rose-400 text-xs font-black uppercase tracking-widest transition-all hover:bg-rose-400/10"
                      style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                      <X size={14} /> Deny
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {/* Session Log */}
        {activeTab === 'sessions' && (
          <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
            {sessionLogs.length === 0 ? (
              <div className="p-8 text-center text-zinc-600 text-sm">No sessions recorded yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10" style={{ background: 'var(--table-header-bg)', borderBottom: `1px solid var(--border)` }}>
                  <tr>
                    {['User', 'Role', 'Login', 'Logout', 'Duration', 'Action'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[9px] font-black text-zinc-600 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessionLogs.map((s) => (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: `1px solid var(--table-border)` }}>
                      <td className="px-5 py-3 font-bold text-zinc-200 text-xs">{s.username}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${s.role === 'ADMIN' ? 'text-rose-400' : 'text-indigo-400'}`}
                          style={{ background: s.role === 'ADMIN' ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)' }}>
                          {s.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-zinc-600 font-mono text-[10px]">{new Date(s.login_time).toLocaleString()}</td>
                      <td className="px-5 py-3">
                        {s.logout_time ? (
                          <span className="text-zinc-600 font-mono text-[10px] flex items-center gap-1">
                            <LogOut size={10} />{new Date(s.logout_time).toLocaleString()}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[9px] font-black text-emerald-400 uppercase">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block" />Active
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-zinc-600 font-mono text-[10px]">{s.duration || '—'}</td>
                      <td className="px-5 py-3">
                        {!s.logout_time && (
                          <button onClick={() => handleForceEnd(s.session_id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all text-amber-400 hover:bg-amber-400/10"
                            style={{ border: '1px solid rgba(251,191,36,0.2)' }}>
                            <ShieldOff size={11} /> Force End
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Audit Trail */}
        {activeTab === 'audit' && (
          <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-zinc-600 text-sm">No logs recorded yet.</div>
            ) : (
              <ul>
                {auditLogs.map((log, i) => (
                  <li key={i} className="px-5 py-3.5 flex flex-col gap-1 hover:bg-white/[0.02] transition-colors"
                    style={{ borderBottom: `1px solid var(--table-border)` }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">{log.action}</span>
                      <span className="text-[9px] font-bold text-zinc-600">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-xs font-medium text-zinc-400">
                      <span className="font-bold text-zinc-200">{log.username}</span>: {log.details}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
