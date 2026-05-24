import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Info, Activity, TrendingUp, Zap, ShieldOff, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const badgeStyles = {
  STRATEGIC: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  EMERGING: 'var(--card-accent-bg) var(--accent) var(--glass-border)',
  SEASONAL: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  RISK: 'var(--error-bg) var(--sim-error-text) var(--error-border)',
  DEFAULT: 'var(--glass-bg) var(--text-muted) var(--glass-border)'
};

export default function BundlerDetail() {
  const { token } = useAuth();
  const { runId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [run, setRun] = useState(location.state?.run || null);
  const [bundles, setBundles] = useState(location.state?.bundles || []);
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const query = new URLSearchParams(location.search).get('bundle');
    const idx = parseInt(query, 10);
    return Number.isInteger(idx) && idx >= 0 ? idx : 0;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (runId === 'sandbox') {
      if (!bundles.length) {
        setError('No sandbox bundle preview available.');
      }
      return;
    }

    if (!run || run.id.toString() !== runId) {
      fetchRunDetails(runId);
    }
  }, [runId]);

  const fetchRunDetails = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`/api/bundler/runs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRun(res.data.run || { id });
      setBundles(res.data.bundles || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load bundle details.');
    } finally {
      setLoading(false);
    }
  };

  const selectedBundle = bundles[selectedIndex] || bundles[0] || null;

  const factorRows = selectedBundle ? [
    { label: 'Lift', value: selectedBundle.lift },
    { label: 'Confidence', value: `${((selectedBundle.confidence || 0) * 100).toFixed(1)}%` },
    { label: 'Support', value: selectedBundle.support },
    ...(selectedBundle.forecast_score !== undefined && selectedBundle.forecast_score !== null ? [
      { label: 'Forecast Alignment', value: selectedBundle.forecast_score },
      { label: 'Trend Momentum', value: selectedBundle.trend_slope },
      { label: 'Seasonal Weight', value: selectedBundle.seasonal_weight }
    ] : [])
  ] : [];

  const getBadgeStyle = (badge) => badgeStyles[badge] || badgeStyles.DEFAULT;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={16} /> Back to Strategy
      </button>

      <div className="rounded-[2.5rem] p-10" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
        <div className="flex flex-col md:flex-row justify-between gap-6 mb-8">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.35em]" style={{ color: 'var(--accent)' }}>Bundle Intelligence Breakdown</p>
            <h1 className="text-3xl font-black" style={{ color: 'var(--text-heading)' }}>{run?.name || 'Bundle Run Detail'}</h1>
            <p className="text-sm max-w-2xl" style={{ color: 'var(--text-muted)' }}>A detailed view of the selected recommendation, including the statistical factors, forecast alignment, and strategic rationale used to rank this pair.</p>
          </div>
          <div className="rounded-3xl p-6 text-sm" style={{ background: 'var(--card-accent-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}>
            <p className="font-black uppercase text-[9px] tracking-[0.35em] mb-3" style={{ color: 'var(--text-faint)' }}>Run Info</p>
            <p><span className="font-bold">Run ID:</span> {run?.id}</p>
            <p><span className="font-bold">Status:</span> {run?.status || 'N/A'}</p>
            <p><span className="font-bold">Created:</span> {run?.created_at ? new Date(run.created_at).toLocaleString() : 'N/A'}</p>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 size={28} className="animate-spin text-emerald-400" /></div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-8 text-rose-200">{error}</div>
        ) : !selectedBundle ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-zinc-300">No bundle details available for this run.</div>
        ) : (
          <div className="grid gap-8 xl:grid-cols-[1.5fr_1fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.35em]" style={{ color: 'var(--text-faint)' }}>Selected Bundle</p>
                    <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-heading)' }}>{selectedBundle.pair}</h2>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] ${getBadgeStyle(selectedBundle.badge)}`}>{selectedBundle.badge}</span>
                    <p className="text-[10px] mt-2" style={{ color: 'var(--text-faint)' }}>Probability of success</p>
                    <p className="text-4xl font-black mt-1" style={{ color: 'var(--accent)' }}>{selectedBundle.probability}%</p>
                  </div>
                </div>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {factorRows.map(f => (
                    <div key={f.label} className="rounded-3xl p-4 border" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                      <p className="text-[9px] uppercase tracking-[0.35em] mb-2" style={{ color: 'var(--text-faint)' }}>{f.label}</p>
                      <p className="text-lg font-black" style={{ color: 'var(--text-heading)' }}>{f.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl p-8 border" style={{ background: 'var(--card-accent-bg)', borderColor: 'var(--glass-border)' }}>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] mb-3" style={{ color: 'var(--text-faint)' }}>Strategic Rationale</p>
                <p className="text-sm italic leading-relaxed" style={{ color: 'var(--text-primary)' }}>{selectedBundle.why || 'This bundle was scored using historical association, demand signals, and model-derived trend/seasonality factors.'}</p>
              </div>

              <div className="rounded-3xl p-8 border" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] mb-4" style={{ color: 'var(--text-faint)' }}>Calculation Summary</p>
                <ul className="space-y-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <li className="flex items-start gap-3"><Zap size={16} style={{ color: 'var(--accent)' }} className="mt-1" /><span><strong>Lift</strong> measures the strength of the historical item association.</span></li>
                  <li className="flex items-start gap-3"><TrendingUp size={16} className="mt-1" style={{ color: 'var(--accent-alt)' }} /><span><strong>Confidence</strong> quantifies how often the rule is true in historical transactions.</span></li>
                  <li className="flex items-start gap-3"><Activity size={16} className="mt-1" style={{ color: 'var(--accent)' }} /><span><strong>Forecast alignment</strong> shows how well item demand signals match predicted future volume.</span></li>
                  <li className="flex items-start gap-3"><ShieldOff size={16} className="mt-1 text-rose-500" /><span><strong>Availability</strong> filters out discontinued or unavailable products from strategic ranking.</span></li>
                </ul>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl p-8 border" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] mb-4" style={{ color: 'var(--text-faint)' }}>All Pairs in Run</p>
                <div className="space-y-3">
                  {bundles.map((bundle, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedIndex(index)}
                      className={`w-full text-left rounded-3xl border p-4 transition-all ${index === selectedIndex ? 'border-emerald-500/40 bg-emerald-500/10' : 'hover:opacity-70'}`}
                      style={{ 
                        background: index === selectedIndex ? 'var(--card-accent-bg)' : 'transparent',
                        borderColor: index === selectedIndex ? 'var(--accent)' : 'var(--glass-border)'
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-black text-sm" style={{ color: 'var(--text-heading)' }}>#{bundle.rank} {bundle.pair}</span>
                        <span className={`text-[10px] uppercase tracking-[0.35em] ${getBadgeStyle(bundle.badge)}`}>{bundle.badge}</span>
                      </div>
                      <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>Probability: {bundle.probability}% · Lift: {bundle.lift}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
