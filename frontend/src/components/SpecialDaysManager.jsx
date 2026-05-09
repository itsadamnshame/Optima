import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Plus, Trash2, Loader2, Search, FilterX, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function SpecialDaysManager({ onUpdate, calendarCount }) {
  const { token, role } = useAuth();
  const [events, setEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const fetchEvents = async () => {
    try {
      const res = await axios.get('/api/get-events', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setEvents(res.data.events || []);
      if (onUpdate) onUpdate();
    } catch { console.error('Failed to fetch events'); }
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName || !newDate) return;
    setLoading(true);
    try {
      await axios.post('/api/add-event', { name: newName, date: newDate }, { headers: { Authorization: `Bearer ${token}` } });
      setMsg({ type: 'success', text: 'Day added!' });
      setNewName(''); setNewDate('');
      await fetchEvents();
    } catch { setMsg({ type: 'error', text: 'Date already exists.' }); }
    finally { setLoading(false); setTimeout(() => setMsg({ type: '', text: '' }), 3000); }
  };

  const handleDelete = async (date) => {
    try {
      await axios.delete(`/api/delete-event/${date}`, { headers: { Authorization: `Bearer ${token}` } });
      await fetchEvents();
    } catch { console.error('Delete failed'); }
  };

  const filteredEvents = events.filter(ev =>
    ev.name.toLowerCase().includes(searchTerm.toLowerCase()) || ev.date.includes(searchTerm)
  );

  const inputStyle = { background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' };

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--glass-bg)', border: `1px solid var(--glass-border)` }}>
      {/* Compact header */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid var(--border)`, background: 'var(--card-accent-bg)' }}>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-indigo-400" />
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Calendar Manager</h3>
        </div>
        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{events.length} Events</span>
      </div>

      <div className="p-4 space-y-3 flex flex-col" style={{ minHeight: 0 }}>
        {/* ADD FORM */}
        {role === 'ADMIN' ? (
          <form onSubmit={handleAdd} className="space-y-2">
            <input
              type="text"
              placeholder="Event name (e.g. Founder's Day)"
              className="w-full rounded-xl px-3 py-2 text-xs font-medium outline-none transition-all"
              style={inputStyle}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex gap-2">
              <input
                type="date"
                className="flex-1 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                style={inputStyle}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
              <button type="submit" disabled={loading}
                className="px-4 py-2 rounded-xl text-white transition-all disabled:opacity-40 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#4f46e5,#6366f1)' }}>
                {loading ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} className="stroke-[3px]" />}
              </button>
            </div>
            {msg.text && (
              <p className={`text-[9px] font-black uppercase text-center italic ${msg.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
                {msg.text}
              </p>
            )}
          </form>
        ) : (
          <div className="flex items-center gap-2 py-2 text-zinc-600 text-xs font-bold uppercase tracking-widest justify-center">
            <Lock size={12} /> Admin Only
          </div>
        )}

        {/* SEARCH */}
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            placeholder="Search calendar..."
            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs font-medium outline-none"
            style={inputStyle}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* LIST */}
        <div className="overflow-y-auto custom-scrollbar space-y-1.5" style={{ maxHeight: '200px' }}>
          {filteredEvents.length > 0 ? filteredEvents.map((ev, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl group transition-all hover:bg-white/5"
              style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.1)' }}>
                  <Calendar size={11} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-[9px] font-mono text-zinc-600">{ev.date}</p>
                  <p className="text-[10px] font-black text-zinc-300 uppercase italic">{ev.name}</p>
                </div>
              </div>
              {role === 'ADMIN' && (
                <button onClick={() => handleDelete(ev.date)}
                  className="p-1.5 text-zinc-700 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-700">
              <FilterX size={28} className="mb-2 opacity-30" />
              <p className="text-[9px] font-black uppercase tracking-widest">No results</p>
            </div>
          )}
        </div>
      </div>

      {/* Hybrid Status Footer — unified with calendar card */}
      <div className="px-4 py-3 flex items-center justify-between gap-4" style={{ borderTop: `1px solid var(--border)`, background: 'var(--card-accent-bg)' }}>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse inline-block shadow-[0_0_6px_rgba(129,140,248,0.8)]" />
          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.25em]">Hybrid Specialist · Listener Active</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Calendar Load</span>
            <span className="text-xs font-black text-white">{events.length} <span className="text-zinc-600 font-normal">days</span></span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Impact</span>
            <span className="text-xs font-black text-emerald-400">High</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <p className="text-[9px] text-indigo-300/50 font-medium italic hidden lg:block">These events are factored into demand predictions</p>
        </div>
      </div>
    </div>
  );
}
