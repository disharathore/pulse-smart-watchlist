import { useEffect, useState, useRef } from 'react';
import Sparkline from './Sparkline.jsx';
import ScoreGauge from './ScoreGauge.jsx';
import { api } from '../api.js';

const TRIAGE_CONFIG = {
  needs_decision: {
    label: 'Needs Decision',
    dotColor: 'bg-bad',
    textColor: 'text-bad',
    bgColor: 'bg-bad/10',
    borderColor: 'border-bad/20',
  },
  worth_a_look: {
    label: 'Worth a Look',
    dotColor: 'bg-warn',
    textColor: 'text-warn',
    bgColor: 'bg-warn/10',
    borderColor: 'border-warn/20',
  },
  nothing_to_do: {
    label: 'Quiet',
    dotColor: 'bg-muted/40',
    textColor: 'text-muted',
    bgColor: 'bg-surface-2',
    borderColor: 'border-border',
  },
};

export default function StockCard({ item, onRemove, onOpenDetail }) {
  const [history, setHistory] = useState(null);
  const [flashClass, setFlashClass] = useState('');
  const prevPriceRef = useRef(item.price);
  const triage = TRIAGE_CONFIG[item.triage] || TRIAGE_CONFIG.nothing_to_do;
  const isUp = (item.pctChange ?? 0) >= 0;
  const isCorrelated = item.reasons?.some((r) => r.includes('broader market move'));

  // Price change flash animation
  useEffect(() => {
    if (prevPriceRef.current !== undefined && item.price !== undefined && prevPriceRef.current !== null) {
      if (item.price > prevPriceRef.current) {
        setFlashClass('num-flash-up');
      } else if (item.price < prevPriceRef.current) {
        setFlashClass('num-flash-down');
      }
      const t = setTimeout(() => setFlashClass(''), 800);
      prevPriceRef.current = item.price;
      return () => clearTimeout(t);
    }
    prevPriceRef.current = item.price;
  }, [item.price]);

  useEffect(() => {
    let cancelled = false;
    api
      .getHistory(item.symbol)
      .then((res) => !cancelled && setHistory(res.history))
      .catch(() => !cancelled && setHistory([]));
    return () => {
      cancelled = true;
    };
  }, [item.symbol]);

  return (
    <div
      className="group relative bg-surface border border-border rounded-xl p-4.5 shadow-card hover:shadow-card-hover hover:border-border-hover hover:scale-[1.01] transition-all duration-150 ease-out flex flex-col justify-between animate-fade-up"
    >
      {/* Delete trigger — appears on card hover */}
      <button
        onClick={() => onRemove(item.symbol)}
        className="absolute top-3.5 right-3.5 text-muted opacity-0 group-hover:opacity-100 hover:text-bad p-1 rounded hover:bg-surface-2 transition-all"
        aria-label={`Remove ${item.symbol}`}
        title="Remove symbol"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>

      {/* Top: Symbol + Sector + Triage badge | Price + Change */}
      <div>
        <div className="flex items-start justify-between pr-7 gap-3">
          <div>
            <button
              onClick={() => onOpenDetail?.(item.symbol)}
              className="font-bold text-lg tracking-tight text-text hover:text-accent transition-colors text-left flex items-center gap-1.5"
            >
              <span>{item.symbol}</span>
              <span className="text-[11px] text-muted font-normal opacity-0 group-hover:opacity-100 transition-opacity">
                ↗
              </span>
            </button>
            {/* Sector / Company Name Tag */}
            <div
              className="text-[11px] text-muted truncate max-w-[170px] sm:max-w-[210px] mt-0.5"
              title={`${item.companyName || item.symbol} · ${item.sector || 'Equities'}`}
            >
              {item.companyName ? `${item.companyName} · ` : ''}{item.sector || 'Equities'}
            </div>
            <div className="mt-1.5">
              <span
                className={`inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border ${triage.bgColor} ${triage.textColor} ${triage.borderColor}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${triage.dotColor}`} />
                {triage.label}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            {item.dataError ? (
              <div className="text-body text-muted">No data</div>
            ) : (
              <div className={`px-1 rounded transition-colors ${flashClass}`}>
                <div className="font-bold text-xl tabular-nums font-mono text-text tracking-tight">
                  {item.price != null ? `$${item.price.toFixed(2)}` : '—'}
                </div>
                <div
                  className={`text-small font-semibold tabular-nums font-mono mt-0.5 flex items-center justify-end gap-0.5 ${
                    isUp ? 'text-good' : 'text-bad'
                  }`}
                >
                  {item.pctChange != null ? (
                    <>
                      <span>{isUp ? '▲' : '▼'}</span>
                      <span>
                        {isUp ? '+' : ''}
                        {item.pctChange.toFixed(2)}%
                      </span>
                    </>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Attention Score Gauge */}
        <div className="mt-3.5 pt-3 border-t border-border/80 flex items-center justify-between">
          <span className="text-small text-muted font-medium">Attention Score</span>
          <ScoreGauge score={item.score} />
        </div>

        {/* Confidence pill — only for low/medium */}
        {item.confidence && item.confidence !== 'high' && (
          <div className="mt-1.5 text-right">
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                item.confidence === 'low'
                  ? 'bg-bad/10 text-bad/80 border border-bad/20'
                  : 'bg-warn/10 text-warn/80 border border-warn/20'
              }`}
            >
              {item.confidence === 'low' ? 'Low sample baseline' : 'Calibrating'}
            </span>
          </div>
        )}

        {/* Reasons */}
        {item.reasons?.length > 0 && (
          <div className="mt-3 space-y-1.5 bg-surface-2/60 rounded-lg p-2.5 border border-border/50">
            {item.reasons.map((r, i) => (
              <div key={i} className="text-small text-muted leading-snug flex items-start gap-1.5">
                <span className="text-accent text-[11px] mt-0.5 shrink-0">▸</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        )}

        {/* Top Headline Context */}
        {item.topNews && (
          <div className="mt-2.5 p-2 rounded-lg bg-surface-2/40 border border-border/60 text-small">
            <div className="flex items-center justify-between text-[10px] text-muted mb-0.5">
              <span className="font-semibold uppercase tracking-wider text-text/70 flex items-center gap-1">
                <span>📰</span> {item.topNews.source || 'News'}
              </span>
            </div>
            <a
              href={item.topNews.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-text/90 hover:text-accent font-medium leading-snug line-clamp-2 block transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {item.topNews.headline} ↗
            </a>
          </div>
        )}

        {/* Correlated move callout */}
        {isCorrelated && (
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-accent bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-md font-medium">
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 2v4M8 10v0.5M3 8h10" />
              <circle cx="8" cy="8" r="6.5" />
            </svg>
            <span>Market-wide co-movement — not idiosyncratic</span>
          </div>
        )}
      </div>

      {/* Sparkline */}
      <div className="mt-3.5 pt-2 border-t border-border/40">
        <Sparkline data={history} positive={isUp} />
        {item.stale && (
          <div className="mt-1 text-[10px] text-muted/70 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-warn" />
            Cached snapshot
          </div>
        )}
      </div>
    </div>
  );
}
