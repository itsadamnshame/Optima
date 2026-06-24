import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Search, ChevronDown, ChevronUp,
  Database, BarChart2, Brain, Package, Shield,
  Upload, Cpu, TrendingUp, Layers, Sparkles,
  Tag, ArrowRight, Hash, Zap, X
} from 'lucide-react';
import { GLOSSARY, GLOSSARY_CATEGORIES } from '../data/glossary';

// ─── MANUAL DATA ────────────────────────────────────────────────────────────

const MANUAL_SECTIONS = [
  {
    id: 'overview',
    icon: Zap,
    title: 'Getting Started',
    subtitle: 'How Optima works — the 4-step pipeline',
    content: [
      {
        type: 'intro',
        text: 'Optima is a smart merchandising platform that turns raw sales transaction data into actionable forecasts and product bundling strategies. The system follows a clear four-step pipeline:',
      },
      {
        type: 'steps',
        items: [
          {
            step: '01',
            title: 'Upload Your Data',
            description: 'Upload your sales transaction history (CSV or Excel files) through the Management Hub. The system will scan all products and prepare the data for analysis.',
            link: '/',
            linkLabel: 'Go to Management Hub',
          },
          {
            step: '02',
            title: 'Train the Models',
            description: 'In the Intelligence Hub (Model Training tab), select your datasets and choose which models to run — the Forecaster for demand predictions, the Bundler for co-purchase analysis, or both.',
            link: '/',
            linkLabel: 'Go to Model Training',
          },
          {
            step: '03',
            title: 'View Forecasts',
            description: 'Open the Forecasting page to explore 12-month demand predictions for each product, compare against prior years, and review model accuracy metrics.',
            link: '/analytics',
            linkLabel: 'Go to Forecasting',
          },
          {
            step: '04',
            title: 'Explore Product Bundles',
            description: 'Visit the Product Bundler to see which products are frequently bought together, test custom pairings in the Affinity Simulator, and save your bundle strategies.',
            link: '/qualitative',
            linkLabel: 'Go to Product Bundler',
          },
        ],
      },
    ],
  },
  {
    id: 'uploading',
    icon: Upload,
    title: 'Uploading Data',
    subtitle: 'How to ingest sales files and configure products',
    content: [
      {
        type: 'intro',
        text: 'Optima accepts CSV and Excel files (.csv, .xlsx, .xls) containing your sales transaction history. Admin access is required to upload data.',
      },
      {
        type: 'steps',
        items: [
          {
            step: '1',
            title: 'Select your files',
            description: 'In the Management Hub, click "Select Local Files". You can upload multiple files at once — Optima will merge them automatically.',
          },
          {
            step: '2',
            title: 'Review detected products',
            description: 'After scanning, Optima lists every unique product name found in your files. Review this list carefully before proceeding.',
          },
          {
            step: '3',
            title: 'Configure product flags (optional)',
            description: 'For each product, you can optionally set:\n• Bundle — include this item in co-purchase analysis\n• Exclude — this entry is not a real product (e.g. a discount code or service fee) and should be ignored',
          },
          {
            step: '4',
            title: 'Name and commit',
            description: 'Give the dataset a descriptive title (e.g. "Sales Q1 2026") and click "Commit Dataset". The data is now ingested and ready for model training.',
          },
        ],
      },
      {
        type: 'tip',
        title: 'Combining Yearly Files',
        text: 'If you have separate files for different years, upload each as its own dataset first, then use the "Assemble Master Dataset" tool to merge them into a single continuous record for training.',
      },
    ],
  },
  {
    id: 'training',
    icon: Cpu,
    title: 'Training Models',
    subtitle: 'Running the Forecaster and Bundler',
    content: [
      {
        type: 'intro',
        text: 'From the Management Hub, switch to the Model Training tab to launch AI model training. You can train the Forecaster, the Bundler, or both in the same run.',
      },
      {
        type: 'blocks',
        items: [
          {
            title: 'Forecaster',
            icon: '📈',
            description: 'Generates 12-month demand predictions for each product. Uses a hybrid deep learning + statistical model. Best run on a Master Dataset with at least 1–2 years of history.',
          },
          {
            title: 'Bundler',
            icon: '📦',
            description: 'Mines your transaction history for product co-purchase patterns using association rule analysis. Can optionally link to an existing Forecast run to improve scoring.',
          },
        ],
      },
      {
        type: 'steps',
        items: [
          {
            step: '1',
            title: 'Select datasets',
            description: 'Under "Data Mastery", check the datasets you want to train on. For best results, use a Master Dataset spanning 2+ years.',
          },
          {
            step: '2',
            title: 'Enable modules',
            description: 'Toggle on the Forecaster, the Bundler, or both. If running the Bundler, optionally link a Reference Forecast to improve bundle scoring.',
          },
          {
            step: '3',
            title: 'Set a run name',
            description: 'Give this training run a descriptive name (e.g. "June 2026 Full Run"). This name will appear in the Analytics Vault and Strategy Vault.',
          },
          {
            step: '4',
            title: 'Launch and wait',
            description: 'Click "Launch Intelligence Protocol". Training may take several minutes. Do not close the tab. A progress bar will track the run.',
          },
        ],
      },
      {
        type: 'tip',
        title: 'Min Support Setting',
        text: 'When running the Bundler, the Min Support value controls how common a product pair must be to appear in results. Start with 1–2% for most retail datasets. Lower it if you have fewer transactions.',
      },
    ],
  },
  {
    id: 'forecasting',
    icon: TrendingUp,
    title: 'Reading Forecasts',
    subtitle: 'Understanding charts, metrics, and benchmarks',
    content: [
      {
        type: 'intro',
        text: 'The Forecasting page shows your saved forecast runs. Click any run card to open its full results.',
      },
      {
        type: 'blocks',
        items: [
          {
            title: 'Global Strategy view',
            icon: '🌐',
            description: 'Shows the store-wide aggregate demand forecast, combining all products into a single 12-month outlook. Good for understanding overall business trajectory.',
          },
          {
            title: 'Product Analysis view',
            icon: '🔍',
            description: 'Lets you drill into individual product forecasts. Use the sidebar to search and select a product, then view its chart, YoY benchmark, accuracy metrics, and trend decomposition.',
          },
        ],
      },
      {
        type: 'steps',
        items: [
          {
            step: '→',
            title: 'The forecast chart',
            description: 'The solid line shows actual historical sales. The dotted line shows predicted future sales. The shaded band is the confidence interval — the range where actual sales are likely to fall.',
          },
          {
            step: '→',
            title: 'Error metrics (MAPE, MAE, RMSE)',
            description: 'These measure model accuracy on historical data. Lower is better. MAPE is the most intuitive — a MAPE of 10% means the model is off by about 10% on average.',
          },
          {
            step: '→',
            title: 'YoY Benchmarking',
            description: 'Compares the forecast period against the same period 1, 2, or 3 years ago. A positive delta means demand is expected to grow vs. that prior year.',
          },
          {
            step: '→',
            title: 'Trend Breakdown (STL)',
            description: 'Shows how the sales signal is split into trend, seasonal patterns, and noise. Useful for understanding what is driving sales — sustained growth, recurring cycles, or random variation.',
          },
        ],
      },
    ],
  },
  {
    id: 'bundles',
    icon: Package,
    title: 'Product Bundles',
    subtitle: 'Discovering, testing, and saving bundle strategies',
    content: [
      {
        type: 'intro',
        text: 'The Product Bundler page has two modes: Discovery Matrix (browse saved bundle results) and Affinity Simulator (test custom pairings).',
      },
      {
        type: 'blocks',
        items: [
          {
            title: 'Discovery Matrix',
            icon: '🔬',
            description: 'Shows all product pairs identified from the selected bundling run, ranked by probability score. Each card shows the pair, its badge (STRATEGIC, EMERGING, SEASONAL, RISK), and key metrics.',
          },
          {
            title: 'Affinity Simulator',
            icon: '⚗️',
            description: 'A manual tool to test any two products from your catalog. Select a primary and secondary item, and the system instantly calculates their Lift, Confidence, and a strategic rationale.',
          },
        ],
      },
      {
        type: 'steps',
        items: [
          {
            step: '→',
            title: 'Reading a bundle card',
            description: 'Each bundle card shows the product pair name, its badge, Confidence %, and Support %. Click "Deep Dive Result" to see full metrics including Lift, Forecast Alignment, and the strategic rationale.',
          },
          {
            step: '→',
            title: 'Using the Affinity Simulator',
            description: 'Switch to the Affinity Simulator tab. Search and select a primary product (Item A) and a secondary product (Item B). Results appear automatically once both are selected.',
          },
          {
            step: '→',
            title: 'Committing a strategy',
            description: 'After training, bundle results appear in a Sandbox preview. Review the pairs, then click "Commit Strategy" to permanently save them to the Strategy Vault for future reference.',
          },
        ],
      },
    ],
  },
  {
    id: 'admin',
    icon: Shield,
    title: 'Admin Features',
    subtitle: 'Managing users, sessions, and audit logs',
    content: [
      {
        type: 'intro',
        text: 'The Admin Panel is accessible only to users with Admin role. It provides tools for user management and system oversight.',
      },
      {
        type: 'blocks',
        items: [
          {
            title: 'Accounts',
            icon: '👤',
            description: 'View all registered accounts, change roles between USER and ADMIN, ban/reactivate accounts, and view per-account activity logs.',
          },
          {
            title: 'Registration Queue',
            icon: '📋',
            description: 'New users who register must be approved before they can log in. Review pending registrations and approve or deny each request.',
          },
          {
            title: 'Session Log',
            icon: '🕐',
            description: 'A live feed of all active and historical login sessions across all users. You can force-end any active session if needed.',
          },
          {
            title: 'Audit Trail',
            icon: '📜',
            description: 'A chronological record of every admin action taken in the system — approvals, denials, role changes, and bans.',
          },
        ],
      },
    ],
  },
];

// ─── ACCORDION SECTION ───────────────────────────────────────────────────────

function ManualSection({ section }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;

  return (
    <div
      className="rounded-[2rem] border overflow-hidden transition-all"
      style={{
        background: 'var(--glass-bg)',
        borderColor: open ? 'var(--accent)' : 'var(--glass-border)',
        boxShadow: open ? '0 0 30px var(--accent-glow)' : 'none',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-8 text-left transition-all hover:opacity-80"
      >
        <div className="flex items-center gap-5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border"
            style={{
              background: open ? 'var(--accent)' : 'var(--card-accent-bg)',
              borderColor: open ? 'var(--accent)' : 'var(--glass-border)',
              color: open ? '#fff' : 'var(--accent)',
              boxShadow: open ? '0 8px 20px -4px var(--accent-glow)' : 'none',
              transition: 'all 0.3s',
            }}
          >
            <Icon size={22} />
          </div>
          <div>
            <h3
              className="text-base font-black uppercase tracking-tight"
              style={{ color: 'var(--text-heading)' }}
            >
              {section.title}
            </h3>
            <p
              className="text-xs font-bold mt-0.5"
              style={{ color: 'var(--text-faint)' }}
            >
              {section.subtitle}
            </p>
          </div>
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border"
          style={{
            borderColor: 'var(--glass-border)',
            background: 'var(--input-bg)',
            color: 'var(--text-faint)',
          }}
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {open && (
        <div
          className="px-8 pb-8 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300"
          style={{ borderTop: '1px solid var(--glass-border)' }}
        >
          {section.content.map((block, i) => {
            if (block.type === 'intro') {
              return (
                <p key={i} className="text-sm leading-relaxed pt-6" style={{ color: 'var(--text-secondary)' }}>
                  {block.text}
                </p>
              );
            }
            if (block.type === 'tip') {
              return (
                <div
                  key={i}
                  className="rounded-2xl p-5 border"
                  style={{
                    background: 'var(--card-accent-bg)',
                    borderColor: 'var(--accent)',
                  }}
                >
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--accent)' }}>
                    💡 Tip: {block.title}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {block.text}
                  </p>
                </div>
              );
            }
            if (block.type === 'steps') {
              return (
                <div key={i} className="space-y-4">
                  {block.items.map((item, j) => (
                    <div
                      key={j}
                      className="flex gap-5 p-5 rounded-2xl border"
                      style={{ background: 'var(--bg-elevated, var(--input-bg))', borderColor: 'var(--border-subtle)' }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-[11px] tracking-widest"
                        style={{ background: 'var(--card-accent-bg)', color: 'var(--accent)', border: '1px solid var(--glass-border)' }}
                      >
                        {item.step}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-sm uppercase tracking-tight mb-1" style={{ color: 'var(--text-heading)' }}>
                          {item.title}
                        </p>
                        <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-muted)' }}>
                          {item.description}
                        </p>
                        {item.link && (
                          <Link
                            to={item.link}
                            className="inline-flex items-center gap-1.5 mt-3 text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-70"
                            style={{ color: 'var(--accent)' }}
                          >
                            {item.linkLabel} <ArrowRight size={12} />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            if (block.type === 'blocks') {
              return (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {block.items.map((item, j) => (
                    <div
                      key={j}
                      className="p-5 rounded-2xl border"
                      style={{ background: 'var(--bg-elevated, var(--input-bg))', borderColor: 'var(--border-subtle)' }}
                    >
                      <p className="text-xl mb-3">{item.icon}</p>
                      <p className="font-black text-sm uppercase tracking-tight mb-2" style={{ color: 'var(--text-heading)' }}>
                        {item.title}
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

// ─── GLOSSARY CARD ───────────────────────────────────────────────────────────

function GlossaryCard({ entry }) {
  const categoryColors = {
    'Forecasting': { bg: 'rgba(99,102,241,0.12)', color: '#818cf8', border: 'rgba(99,102,241,0.25)' },
    'Bundle Analysis': { bg: 'rgba(16,185,129,0.10)', color: '#34d399', border: 'rgba(16,185,129,0.25)' },
    'Data & Training': { bg: 'rgba(245,158,11,0.10)', color: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
    'Statistics': { bg: 'rgba(139,92,246,0.10)', color: '#a78bfa', border: 'rgba(139,92,246,0.25)' },
    'Retail & Merchandising': { bg: 'rgba(244,63,94,0.10)', color: '#fb7185', border: 'rgba(244,63,94,0.25)' },
    'Navigation': { bg: 'rgba(14,165,233,0.10)', color: '#38bdf8', border: 'rgba(14,165,233,0.25)' },
    'System': { bg: 'rgba(156,163,175,0.10)', color: '#9ca3af', border: 'rgba(156,163,175,0.20)' },
  };
  const colors = categoryColors[entry.category] || categoryColors['System'];

  return (
    <div
      className="rounded-[1.75rem] p-6 border flex flex-col gap-4 transition-all hover:scale-[1.01]"
      style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="font-black text-sm uppercase tracking-tight leading-tight"
            style={{ color: 'var(--text-heading)' }}
          >
            {entry.term}
          </p>
          {entry.plain && (
            <p
              className="text-[11px] font-bold mt-0.5"
              style={{ color: 'var(--text-faint)' }}
            >
              also: {entry.plain}
            </p>
          )}
        </div>
        <span
          className="flex-shrink-0 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
          style={{ background: colors.bg, color: colors.color, borderColor: colors.border }}
        >
          {entry.category}
        </span>
      </div>

      {/* Definition */}
      <p
        className="text-xs leading-relaxed flex-1"
        style={{ color: 'var(--text-secondary)' }}
      >
        {entry.definition}
      </p>

      {/* Example */}
      {entry.example && (
        <div
          className="rounded-xl p-3 border"
          style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)' }}
        >
          <p
            className="text-[9px] font-black uppercase tracking-widest mb-1"
            style={{ color: 'var(--text-faint)' }}
          >
            Example
          </p>
          <p
            className="text-[11px] italic leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            {entry.example}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

export default function HelpCenter() {
  const [activeTab, setActiveTab] = useState('manual');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredGlossary = useMemo(() => {
    const q = search.toLowerCase().trim();
    return GLOSSARY.filter(entry => {
      const matchesCategory = activeCategory === 'All' || entry.category === activeCategory;
      const matchesSearch =
        !q ||
        entry.term.toLowerCase().includes(q) ||
        (entry.plain || '').toLowerCase().includes(q) ||
        entry.definition.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [search, activeCategory]);

  // Count per category for chips
  const categoryCounts = useMemo(() => {
    const counts = { All: GLOSSARY.length };
    GLOSSARY.forEach(e => {
      counts[e.category] = (counts[e.category] || 0) + 1;
    });
    return counts;
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* ── HERO ── */}
      <div
        className="relative rounded-[2.5rem] p-10 overflow-hidden"
        style={{ background: 'var(--gradient-hero)', border: '1px solid var(--glass-border)' }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-hero)' }} />
        <div className="relative z-10 space-y-4">
          <p
            className="text-[10px] font-black uppercase tracking-[0.35em] flex items-center gap-2"
            style={{ color: 'var(--accent)' }}
          >
            <BookOpen size={14} /> Help Center
          </p>
          <h1
            className="text-4xl font-black tracking-tighter"
            style={{ color: 'var(--text-heading)' }}
          >
            User Manual &amp; Glossary
          </h1>
          <p
            className="text-sm max-w-xl leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            Everything you need to understand and use Optima effectively. Browse step-by-step guides in the Manual, or look up any technical term in the Glossary.
          </p>

          {/* Tab toggle */}
          <div
            className="flex w-fit p-1.5 rounded-2xl border mt-6"
            style={{ background: 'var(--input-bg)', borderColor: 'var(--border-subtle)' }}
          >
            {[
              { id: 'manual', icon: BookOpen, label: 'User Manual' },
              { id: 'glossary', icon: Hash, label: 'Glossary' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                style={{
                  background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                  color: activeTab === tab.id ? '#fff' : 'var(--text-faint)',
                  boxShadow: activeTab === tab.id ? '0 10px 15px -3px var(--accent-glow)' : 'none',
                }}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MANUAL TAB ── */}
      {activeTab === 'manual' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3 px-2 mb-6">
            <BookOpen size={16} style={{ color: 'var(--accent)' }} />
            <div>
              <p className="font-black text-sm uppercase tracking-tight" style={{ color: 'var(--text-heading)' }}>
                Step-by-Step Guides
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                Click any section to expand its guide
              </p>
            </div>
          </div>
          {MANUAL_SECTIONS.map(section => (
            <ManualSection key={section.id} section={section} />
          ))}
        </div>
      )}

      {/* ── GLOSSARY TAB ── */}
      {activeTab === 'glossary' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Search + Stats bar */}
          <div
            className="rounded-[2rem] p-6 border space-y-4"
            style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}
          >
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-faint)' }}
                />
                <input
                  type="text"
                  placeholder="Search terms and definitions..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-2xl pl-11 pr-10 py-3.5 text-sm font-bold outline-none transition-all"
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div
                className="flex items-center gap-3 px-5 py-3.5 rounded-2xl border flex-shrink-0"
                style={{ background: 'var(--card-accent-bg)', borderColor: 'var(--glass-border)' }}
              >
                <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                <span className="text-sm font-black" style={{ color: 'var(--text-heading)' }}>
                  {filteredGlossary.length}
                </span>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                  {filteredGlossary.length === 1 ? 'term' : 'terms'}
                </span>
              </div>
            </div>

            {/* Category chips */}
            <div className="flex flex-wrap gap-2">
              {GLOSSARY_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all"
                  style={{
                    background: activeCategory === cat ? 'var(--accent)' : 'var(--input-bg)',
                    color: activeCategory === cat ? '#fff' : 'var(--text-muted)',
                    borderColor: activeCategory === cat ? 'var(--accent)' : 'var(--border-subtle)',
                    boxShadow: activeCategory === cat ? '0 4px 12px -2px var(--accent-glow)' : 'none',
                  }}
                >
                  <Tag size={10} />
                  {cat}
                  <span
                    className="ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-black"
                    style={{
                      background: activeCategory === cat ? 'rgba(255,255,255,0.2)' : 'var(--card-accent-bg)',
                      color: activeCategory === cat ? '#fff' : 'var(--text-faint)',
                    }}
                  >
                    {categoryCounts[cat] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Glossary grid */}
          {filteredGlossary.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
              <div
                className="p-6 rounded-full"
                style={{ background: 'var(--input-bg)', color: 'var(--text-faint)', opacity: 0.3 }}
              >
                <Search size={40} />
              </div>
              <div>
                <h3
                  className="text-xl font-black uppercase italic"
                  style={{ color: 'var(--text-heading)' }}
                >
                  No terms found
                </h3>
                <p
                  className="text-sm mt-1 max-w-xs mx-auto"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Try adjusting your search or clearing the category filter.
                </p>
              </div>
              <button
                onClick={() => { setSearch(''); setActiveCategory('All'); }}
                className="px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:opacity-80"
                style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 8px 20px -4px var(--accent-glow)' }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredGlossary.map(entry => (
                <GlossaryCard key={entry.term} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
