import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Calendar, Plus, Trash2, Info, Loader2, 
  Search, FilterX, CalendarDays, Lock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function SpecialDaysManager({ onUpdate }) {
  const { token, role } = useAuth();
  const [events, setEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const fetchEvents = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/get-events');
      setEvents(res.data.events || []);
      // Trigger the parent sync (for the Live Status Monitor)
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Failed to fetch events");
    }
  };

  useEffect(() => { 
    fetchEvents(); 
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName || !newDate) return;
    setLoading(true);
    try {
      await axios.post('http://localhost:8000/api/add-event', 
        { name: newName, date: newDate },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setMsg({ type: 'success', text: 'Day added to Specialist Engine!' });
      setNewName('');
      setNewDate('');
      await fetchEvents();
    } catch (err) {
      setMsg({ type: 'error', text: 'Date already occupies an entry.' });
    } finally {
      setLoading(false);
      setTimeout(() => setMsg({ type: '', text: '' }), 3000);
    }
  };

  const handleDelete = async (date) => {
    try {
      await axios.delete(`http://localhost:8000/api/delete-event/${date}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchEvents();
    } catch (err) {
      console.error("Delete failed");
    }
  };

  const filteredEvents = events.filter(ev => 
    ev.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    ev.date.includes(searchTerm)
  );

  return (
    <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden flex flex-col h-full min-h-[550px]">
      {/* HEADER */}
      <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
            <CalendarDays size={120} />
        </div>
        <div className="relative z-10">
          <h3 className="text-2xl font-black flex items-center gap-3 uppercase tracking-tighter italic">
            Calendar Manager
          </h3>
          <p className="text-indigo-100 text-[10px] mt-1 font-black uppercase tracking-[0.2em] opacity-80">
            Database-Driven Specialist Audit
          </p>
        </div>
      </div>

      <div className="p-8 space-y-6 flex-1 flex flex-col bg-white">
        {/* INPUT FORM OR LOCK BANNER */}
        {role === 'ADMIN' ? (
          <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 p-5 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
            <input 
              type="text" 
              placeholder="Event Name (e.g. Founder's Day)" 
              className="w-full border-transparent bg-white rounded-xl py-3 px-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex gap-2">
              <input 
                type="date" 
                className="flex-1 border-transparent bg-white rounded-xl py-3 px-4 text-sm font-bold shadow-sm"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
              <button 
                type="submit"
                disabled={loading}
                className="bg-indigo-600 text-white px-6 rounded-xl hover:bg-indigo-700 disabled:bg-slate-200 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} className="stroke-[3px]" />}
              </button>
            </div>
            {msg.text && (
              <p className={`text-[10px] font-black uppercase text-center mt-1 italic ${msg.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}>
                {msg.text}
              </p>
            )}
          </form>
        ) : (
          <div className="flex items-center justify-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-widest text-center">
            <Lock size={16} /> Edit Access Restricted to Admins
          </div>
        )}

        {/* SEARCH BAR */}
        <div className="relative group">
          <Search className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Search active calendar..."
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* SCROLLABLE LIST */}
        <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar space-y-2">
          {filteredEvents.length > 0 ? filteredEvents.map((ev, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-50 hover:border-indigo-100 hover:shadow-md transition-all group">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                  <Calendar size={18}/>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 font-mono uppercase tracking-tighter">{ev.date}</p>
                  <p className="text-xs font-black text-slate-700 group-hover:text-indigo-700 transition-colors uppercase italic">{ev.name}</p>
                </div>
              </div>
              {role === 'ADMIN' && (
                <button 
                  onClick={() => handleDelete(ev.date)}
                  className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                  title="Remove from Engine"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300">
              <FilterX size={64} className="opacity-10 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] italic">Zero Results Found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}