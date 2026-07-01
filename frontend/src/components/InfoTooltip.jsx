import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';
import { lookupTerm } from '../data/glossary';

/**
 * <InfoTooltip term="Lift" />
 *
 * Renders a small ℹ icon next to a label. On hover (or focus), shows a
 * popover with the plain-English definition from the shared glossary.
 *
 * Props:
 *   term    — The technical term to look up (must match a GLOSSARY entry)
 *   text    — Optional: override definition text (for one-off annotations)
 *   size    — Icon size in px (default: 12)
 *   side    — Popover preferred side: 'top' | 'bottom' | 'left' | 'right' (default: 'top')
 */
export default function InfoTooltip({ term, text, size = 12, side = 'top' }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  const entry = term ? lookupTerm(term) : null;
  const definition = text || entry?.definition;
  const plain = entry?.plain;
  const example = entry?.example;

  // Close on click-away
  useEffect(() => {
    if (!visible) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setVisible(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible]);

  if (!definition) return null;

  const sideClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
    'bottom-right': 'top-full mt-2 left-0',
    'bottom-left': 'top-full mt-2 right-0',
    'top-right': 'bottom-full mb-2 left-0',
    'top-left': 'bottom-full mb-2 right-0',
  };

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <button
        type="button"
        tabIndex={0}
        aria-label={`What is ${term || 'this'}?`}
        className="inline-flex items-center justify-center rounded-full transition-opacity hover:opacity-100 opacity-50 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] ml-1"
        style={{ color: 'var(--accent)', verticalAlign: 'middle' }}
        onClick={(e) => { e.preventDefault(); setVisible(v => !v); }}
      >
        <Info size={size} />
      </button>

      {visible && (
        <div
          className={`absolute z-[200] w-64 animate-in fade-in zoom-in-95 duration-150 ${sideClasses[side]}`}
          role="tooltip"
        >
          <div
            className="rounded-2xl border p-4 shadow-2xl text-left"
            style={{
              background: 'var(--modal-bg, var(--bg-elevated))',
              borderColor: 'var(--border-strong)',
            }}
          >
            {/* Header */}
            <div className="mb-2">
              <p
                className="text-[10px] font-black uppercase tracking-[0.25em]"
                style={{ color: 'var(--accent)' }}
              >
                {entry ? entry.term : term}
              </p>
              {plain && (
                <p
                  className="text-xs font-bold mt-0.5"
                  style={{ color: 'var(--text-heading)' }}
                >
                  {plain}
                </p>
              )}
            </div>

            {/* Definition */}
            <p
              className="text-xs leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {definition}
            </p>

            {/* Example */}
            {example && (
              <div
                className="mt-3 pt-3 border-t"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <p
                  className="text-[10px] font-black uppercase tracking-widest mb-1"
                  style={{ color: 'var(--text-faint)' }}
                >
                  Example
                </p>
                <p
                  className="text-[11px] italic leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {example}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
