import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Check, X, Users, Activity, FileText, Clock, LogIn, LogOut, ShieldOff } from 'lucide-react';

const AdminDashboard = () => {
  const { token, username } = useAuth();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [sessionLogs, setSessionLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('queue');
  const [loading, setLoading] = useState(true);

  const fetchPendingUsers = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/admin/pending-users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setPendingUsers(data.users || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/admin/audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSessionLogs = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/admin/session-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setSessionLogs(data.sessions || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleForceEnd = async (session_id) => {
    if (!window.confirm('Force-end this session? The user will be immediately logged out and cannot log in again for 10 minutes.')) return;
    try {
      const res = await fetch('http://localhost:8000/api/admin/force-end-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ session_id })
      });
      if (res.ok) {
        await fetchSessionLogs(); // refresh the list
      } else {
        alert('Failed to force-end session.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
    fetchAuditLogs();
    fetchSessionLogs();
  }, [token]);

  const handleAction = async (actionUsername, action) => {
    try {
      const res = await fetch(`http://localhost:8000/api/admin/${action}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username: actionUsername })
      });
      if (res.ok) {
        setPendingUsers(pendingUsers.filter(u => u.username !== actionUsername));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-red-100 text-red-600 p-3 rounded-lg">
          <Shield size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Admin Control Panel</h1>
          <p className="text-gray-500 font-medium mt-1">Logged in as {username}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-orange-100 text-orange-600 p-4 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Pending Approvals</p>
            <p className="text-3xl font-black text-gray-900">{pendingUsers.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-indigo-100 text-indigo-600 p-4 rounded-xl">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Total Sessions</p>
            <p className="text-3xl font-black text-gray-900">{sessionLogs.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-green-100 text-green-600 p-4 rounded-xl">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">System Status</p>
            <p className="text-3xl font-black text-gray-900">Online</p>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[['queue', Users, 'Registration Queue'], ['sessions', Clock, 'Session Log'], ['audit', FileText, 'Audit Trail']].map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${
                activeTab === id
                  ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon size={16} />{label}
            </button>
          ))}
        </div>

        {/* REGISTRATION QUEUE */}
        {activeTab === 'queue' && (
          loading ? (
            <div className="p-8 text-center text-gray-500 font-medium">Loading queue...</div>
          ) : pendingUsers.length === 0 ? (
            <div className="p-12 text-center">
              <Shield size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">No pending registrations to review.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {pendingUsers.map(user => (
                <li key={user.username} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{user.username}</p>
                    <p className="text-sm font-medium text-orange-500 mt-1 uppercase tracking-widest text-[10px]">Status: {user.status}</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleAction(user.username, 'approve')}
                      className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-bold transition-colors"
                    >
                      <Check size={18} /> Approve
                    </button>
                    <button 
                      onClick={() => handleAction(user.username, 'deny')}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-bold transition-colors"
                    >
                      <X size={18} /> Deny
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {/* SESSION LOG */}
        {activeTab === 'sessions' && (
          <div className="max-h-[520px] overflow-y-auto">
            {sessionLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 font-medium">No sessions recorded yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">User</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Role</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Login</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Logout</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Duration</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sessionLogs.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900">{s.username}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                          s.role === 'ADMIN' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'
                        }`}>{s.role}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-mono text-xs">{new Date(s.login_time).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        {s.logout_time ? (
                          <span className="text-gray-600 font-mono text-xs flex items-center gap-1">
                            <LogOut size={12} className="text-gray-400" />
                            {new Date(s.logout_time).toLocaleString()}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-mono text-xs">{s.duration || '—'}</td>
                      <td className="px-6 py-4">
                        {!s.logout_time && (
                          <button
                            onClick={() => handleForceEnd(s.session_id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
                          >
                            <ShieldOff size={12} /> Force End
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

        {/* AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="max-h-[520px] overflow-y-auto">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 font-medium">No logs recorded yet.</div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {auditLogs.map((log, index) => (
                  <li key={index} className="p-4 hover:bg-gray-50 flex flex-col gap-1 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-indigo-600 tracking-widest">{log.action}</span>
                      <span className="text-[10px] font-bold text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800">
                      <span className="font-bold">{log.username}</span>: {log.details}
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

export default AdminDashboard;
