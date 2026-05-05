import React, { useState, useEffect } from 'react';
import { Calculator, Plus, X, Search, Zap, TrendingUp, DollarSign, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function BundleCalculator() {
    const { token } = useAuth();
    const [allItems, setAllItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            const res = await fetch('/api/get-items', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setAllItems(data.items || []);
        } catch (err) {
            console.error("Failed to fetch items:", err);
        }
    };

    const handleAddItem = (item) => {
        if (selectedItems.length >= 4) return;
        if (!selectedItems.includes(item)) {
            setSelectedItems([...selectedItems, item]);
            // Search term intentionally not cleared for better multi-select UX
        }
    };

    const handleRemoveItem = (item) => {
        setSelectedItems(selectedItems.filter(i => i !== item));
        setResults(null);
    };

    const analyzeBundle = async () => {
        if (selectedItems.length < 2) {
            setError("Select at least 2 items to analyze.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/analyze-bundle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ items: selectedItems })
            });
            const data = await res.json();
            if (res.ok) {
                setResults(data.results);
            } else {
                setError(data.detail || "Analysis failed.");
            }
        } catch (err) {
            setError("Connection error. Is the server running?");
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = allItems.filter(i => 
        i.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !selectedItems.includes(i)
    ).slice(0, 5);

    return (
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/40">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #6366f1;
                }
            `}</style>
            <div className="flex items-center gap-3 mb-8">
                <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-200">
                    <Calculator size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Bundle Strength Simulator</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manual Apriori & Profitability Audit</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* SELECTION PANEL */}
                <div className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select 2-4 Items to Combine</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search inventory..."
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            />
                        </div>

                        {/* SCROLLABLE CHECKLIST */}
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden">
                            <div className="max-h-[200px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                {allItems
                                    .filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map(item => {
                                        const isChecked = selectedItems.includes(item);
                                        const isDisabled = !isChecked && selectedItems.length >= 4;
                                        
                                        return (
                                            <label 
                                                key={item} 
                                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
                                                    isChecked 
                                                        ? 'bg-indigo-600 text-white shadow-md' 
                                                        : isDisabled 
                                                            ? 'opacity-30 cursor-not-allowed grayscale' 
                                                            : 'hover:bg-white text-slate-600'
                                                }`}
                                            >
                                                <input 
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    disabled={isDisabled}
                                                    onChange={() => isChecked ? handleRemoveItem(item) : handleAddItem(item)}
                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 hidden"
                                                />
                                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                                                    isChecked ? 'bg-white border-white' : 'border-slate-300 bg-white'
                                                }`}>
                                                    {isChecked && <div className="w-2 h-2 bg-indigo-600 rounded-sm"></div>}
                                                </div>
                                                <span className="text-[11px] font-bold uppercase tracking-tight truncate flex-1">{item}</span>
                                                {isChecked && <Plus size={14} className="rotate-45" />}
                                            </label>
                                        );
                                    })
                                }
                                {allItems.filter(item => item.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                                    <div className="py-8 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">No matching items found</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {selectedItems.length > 0 && (
                            <div className="w-full flex justify-between items-center mb-1">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Selected Bundle ({selectedItems.length}/4)</span>
                                <button onClick={() => { setSelectedItems([]); setResults(null); }} className="text-[8px] font-black text-red-400 uppercase tracking-widest hover:text-red-600 transition-colors">Clear All</button>
                            </div>
                        )}
                        
                        <div className="flex flex-wrap gap-2">
                            {selectedItems.map(item => (
                                <div key={item} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-indigo-100 animate-in zoom-in-95 duration-200">
                                    {item}
                                    <button onClick={() => handleRemoveItem(item)} className="hover:text-red-500 transition-colors">
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            {selectedItems.length === 0 && (
                                <div className="w-full py-8 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-300">
                                    <Plus size={32} className="mb-2 opacity-50" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Select items above</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <button 
                        onClick={analyzeBundle}
                        disabled={selectedItems.length < 2 || loading}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] hover:bg-black transition-all shadow-lg disabled:bg-slate-200 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} className="text-amber-400" />}
                        Execute Bundle Audit
                    </button>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl border border-red-100 text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-2">
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}
                </div>

                {/* RESULTS PANEL */}
                <div className="bg-slate-50 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[300px] border border-slate-100 relative">
                    {!results && !loading && (
                        <div className="text-center space-y-2 opacity-50">
                            <Calculator size={48} className="mx-auto text-slate-300" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Awaiting Simulation Parameters</p>
                        </div>
                    )}

                    {loading && (
                        <div className="text-center space-y-4">
                            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calculating Lift & Reliability...</p>
                        </div>
                    )}

                    {results && !loading && (
                        <div className="w-full space-y-8 animate-in fade-in duration-500">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Impact Multiplier (Lift)</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-black text-indigo-600 italic">x{results.lift}</span>
                                        <span className={`text-[10px] font-bold ${results.lift > 1 ? 'text-emerald-500' : 'text-red-400'}`}>
                                            {results.lift > 1 ? 'Positive' : 'Dilutive'}
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Bundle Cost</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-black text-slate-900 italic">₱{results.bundle_total_cost}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="flex justify-between items-center relative z-10">
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Predictive Support</p>
                                        <p className="text-sm font-black text-slate-900">{(results.support * 100).toFixed(4)}%</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Market Reach</p>
                                        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                                            {results.support > 0.01 ? 'High Frequency' : 'Niche Target'}
                                        </p>
                                    </div>
                                </div>
                                <div className="absolute bottom-0 left-0 h-1 bg-indigo-600 transition-all duration-1000" style={{ width: `${Math.min(results.support * 1000, 100)}%` }}></div>
                            </div>

                            <div className="bg-indigo-900 rounded-[2rem] p-6 text-white">
                                <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                    <TrendingUp size={14} className="text-emerald-400" /> Strategic Verdict
                                </h4>
                                <p className="text-xs font-medium leading-relaxed italic opacity-90">
                                    {results.lift > 1.5 
                                        ? "This combination shows strong synergy. The products drive collective demand significantly better than when sold individually. Prioritize for high-margin promotions."
                                        : results.lift > 1
                                        ? "This bundle is healthy but shows standard relational patterns. Good for maintaining average order value (AOV) without aggressive discounting."
                                        : "This bundle has low mathematical synergy. These items are likely unrelated in consumer behavior; consider swapping one item for a more frequent leader SKU."}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
