import { useEffect } from 'react';

const SECTIONS = [
  {
    title: 'What is a "Meaningful Change"?',
    body: `Most watchlists show you prices. Pulse shows you whether a price change is worth your attention — based on how unusual it is for this specific stock, not a generic threshold.

A stock moving 2% means something very different for a quiet utility stock versus a volatile tech name. Pulse scores each symbol against its own recent volatility baseline.`,
  },
  {
    title: 'Signal 1: Volatility-Weighted Move (Z-Score)',
    body: `The primary signal. We compute the standard deviation of recent percentage moves for the symbol, then measure how many standard deviations today's move is from that baseline. A 2σ+ move earns up to 55 points.`,
  },
  {
    title: 'Signal 2: Position in Intraday Range',
    body: `If the current price is within 5% of today's intraday high or low, that signals an extreme for the day (+20 points).`,
  },
  {
    title: 'Signal 3: New High/Low Since Tracking Started',
    body: `If today's price exceeds the highest or lowest price recorded since you added the symbol to Pulse, it earns +25 points.

Note: Finnhub's free tier does not expose historical OHLCV. We use our own accumulated snapshot history since the symbol was added.`,
  },
  {
    title: 'Triage States & Thresholds',
    body: `• Score 0–24: Quiet (filtered into collapsed section by default)
• Score 25–54: Worth a Look
• Score 55–100: Needs Decision (high priority, triggers alerts)`,
  },
  {
    title: 'Confidence Indicator',
    body: `• LOW: < 5 snapshots. Baseline is still accumulating; raw magnitude fallback is used.
• MED: 5–19 snapshots. Volatility baseline exists.
• HIGH: 20+ snapshots. Full statistical model with z-scores is active.`,
  },
  {
    title: 'Signal Accuracy Tracking',
    body: `The "Signal Acc." indicator measures what fraction of flagged events were followed by continued movement (≥0.3%) over subsequent poll cycles. It computes live outcome validation so the scoring engine is verifiable.`,
  },
];

const SHORTCUTS = [
  { key: '/', desc: 'Focus add-ticker input' },
  { key: 'r', desc: 'Manually refresh market data' },
  { key: 'Esc', desc: 'Close any open modal or dialog' },
];

export default function HelpModal({ onClose }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-start justify-center z-50 p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-lg shadow-card max-w-2xl w-full my-8 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5 border-b border-border pb-3">
          <div>
            <h2 className="text-card-title text-text font-semibold">
              How Pulse Works
            </h2>
            <p className="text-small text-muted mt-0.5">
              Methodology, signals, and scoring engine details
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-text p-1 rounded hover:bg-surface-2 transition-colors"
            aria-label="Close help"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>

        {/* Keyboard Shortcuts Section (Part 3C) */}
        <div className="mb-6 p-4 rounded-lg bg-surface-2 border border-border">
          <h3 className="text-section-header text-text mb-3">Keyboard Shortcuts</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SHORTCUTS.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-bg border border-border rounded text-small font-mono text-text shadow-xs">
                  {s.key}
                </kbd>
                <span className="text-small text-muted">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Content sections */}
        <div className="space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-small font-semibold text-text mb-1.5">
                {section.title}
              </h3>
              <div className="text-small text-muted leading-relaxed whitespace-pre-line">
                {section.body}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-border text-small text-muted flex flex-col sm:flex-row justify-between gap-2">
          <span>Built for Groww Code Hackathon</span>
          <span>Live Finnhub quotes + real-time statistical triage</span>
        </div>
      </div>
    </div>
  );
}
