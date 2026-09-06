import { useMemo, useState } from 'react';

const SORT_OPTIONS = [
  { key: 'score', label: 'Score' },
  { key: 'pctChange', label: 'Change %' },
  { key: 'price', label: 'Price' },
  { key: 'symbol', label: 'Symbol' },
];

function ArrowUpIcon() {
  return (
    <svg className="w-2.5 h-2.5 inline-block fill-current" viewBox="0 0 10 10">
      <polygon points="5,1 9,8 1,8" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg className="w-2.5 h-2.5 inline-block fill-current" viewBox="0 0 10 10">
      <polygon points="5,9 9,2 1,2" />
    </svg>
  );
}

const TRIAGE_BADGES = {
  needs_decision: {
    label: 'Needs Decision',
    style: 'text-bad bg-bad/10 border-bad/30',
  },
  worth_a_look: {
    label: 'Worth a Look',
    style: 'text-warn bg-warn/10 border-warn/30',
  },
  nothing_to_do: {
    label: 'Quiet',
    style: 'text-muted bg-surface-2 border-border',
  },
};

export default function WatchlistTable({ items, onRemove, onOpenDetail }) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('score');
  const [sortDir, setSortDir] = useState('desc');

  const filtered = useMemo(() => {
    let list = items.filter((i) => i.symbol.toLowerCase().includes(query.trim().toLowerCase()));
    list = [...list].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return list;
  }, [items, query, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  if (!items.length) return null;

  return (
    <div>
      {/* Search Filter & Sort Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter symbols..."
            className="input-field text-small py-1.5 px-3 w-full sm:w-60"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text text-small"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-small text-muted font-medium mr-1 hidden sm:inline">
            Sort:
          </span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => toggleSort(opt.key)}
              className={`text-small px-2.5 py-1 rounded-[6px] border font-medium transition-all ${
                sortKey === opt.key
                  ? 'bg-accent/15 border-accent text-accent'
                  : 'bg-surface border-border text-muted hover:text-text hover:border-border-hover'
              }`}
            >
              {opt.label}{' '}
              {sortKey === opt.key && (
                <span className="inline-block ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop & Tablet Table View (hidden on very small screens) */}
      <div className="hidden sm:block border border-border rounded-lg bg-surface overflow-hidden shadow-subtle">
        <table className="w-full text-body border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-muted text-small font-medium">
              <th className="px-4 py-3 text-left">Symbol</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">24h Change</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3 text-left">Triage Status</th>
              <th className="px-4 py-3 text-left">Confidence</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((item) => {
              const isUp = (item.pctChange ?? 0) >= 0;
              const badge = TRIAGE_BADGES[item.triage] || TRIAGE_BADGES.nothing_to_do;

              return (
                <tr
                  key={item.symbol}
                  className="hover:bg-surface-2/60 transition-colors duration-100 group"
                >
                  <td className="px-4 py-3 text-left">
                    <button
                      onClick={() => onOpenDetail(item.symbol)}
                      className="font-semibold text-text hover:text-accent transition-colors"
                    >
                      {item.symbol}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text">
                    {item.price != null ? `$${item.price.toFixed(2)}` : '—'}
                    {item.stale && <span className="ml-1 text-[10px] text-muted">(Stale)</span>}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-medium ${isUp ? 'text-good' : 'text-bad'}`}>
                    {item.pctChange != null ? (
                      <span className="inline-flex items-center gap-1 justify-end">
                        {isUp ? <ArrowUpIcon /> : <ArrowDownIcon />}
                        <span>{Math.abs(item.pctChange).toFixed(2)}%</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-text">
                    {item.score}
                  </td>
                  <td className="px-4 py-3 text-left">
                    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${badge.style}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-left">
                    <span
                      className={`text-[11px] font-mono ${
                        item.confidence === 'low'
                          ? 'text-bad'
                          : item.confidence === 'medium'
                          ? 'text-warn'
                          : 'text-muted'
                      }`}
                    >
                      {item.confidence?.toUpperCase() || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onRemove(item.symbol)}
                      className="text-muted hover:text-bad transition-colors p-1 rounded hover:bg-surface"
                      title={`Remove ${item.symbol}`}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout (Part 3D) */}
      <div className="sm:hidden space-y-2.5">
        {filtered.map((item) => {
          const isUp = (item.pctChange ?? 0) >= 0;
          const badge = TRIAGE_BADGES[item.triage] || TRIAGE_BADGES.nothing_to_do;

          return (
            <div
              key={item.symbol}
              className="border border-border rounded-lg bg-surface p-3.5 shadow-subtle flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => onOpenDetail(item.symbol)}
                  className="font-semibold text-card-title text-text hover:text-accent"
                >
                  {item.symbol}
                </button>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${badge.style}`}>
                    {badge.label}
                  </span>
                  <button
                    onClick={() => onRemove(item.symbol)}
                    className="text-muted hover:text-bad p-1"
                    title={`Remove ${item.symbol}`}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-body border-t border-border pt-2 mt-0.5">
                <div>
                  <span className="text-small text-muted mr-1.5">Price:</span>
                  <span className="font-mono font-medium text-text">
                    {item.price != null ? `$${item.price.toFixed(2)}` : '—'}
                  </span>
                </div>
                <div className={`font-mono font-medium ${isUp ? 'text-good' : 'text-bad'}`}>
                  {item.pctChange != null ? (
                    <span className="inline-flex items-center gap-1">
                      {isUp ? <ArrowUpIcon /> : <ArrowDownIcon />}
                      <span>{Math.abs(item.pctChange).toFixed(2)}%</span>
                    </span>
                  ) : (
                    '—'
                  )}
                </div>
                <div>
                  <span className="text-small text-muted mr-1">Score:</span>
                  <span className="font-mono font-medium text-text">{item.score}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 border border-border rounded-lg bg-surface text-small text-muted">
          No symbols matching "{query}"
        </div>
      )}
    </div>
  );
}
