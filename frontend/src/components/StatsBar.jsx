import { useEffect, useRef, useState } from 'react';

function useCountUp(target, duration = 800) {
  const [current, setCurrent] = useState(null);
  const prevTarget = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target === null || target === undefined) return;

    const numTarget = parseFloat(target);
    if (isNaN(numTarget)) {
      setCurrent(target);
      return;
    }

    const start = prevTarget.current ?? 0;
    prevTarget.current = numTarget;

    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      const val = start + (numTarget - start) * eased;
      setCurrent(val);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return current;
}

function StatCell({ label, value, color, mono, title, isNumeric, decimals = 0, suffix = '' }) {
  const animated = useCountUp(isNumeric ? parseFloat(value) : null, 900);
  const displayValue = isNumeric && animated !== null
    ? `${parseFloat(value) >= 0 && suffix === '%' && decimals > 0 && parseFloat(value) > 0 ? '+' : ''}${animated.toFixed(decimals)}${suffix}`
    : value;

  return (
    <div
      className="bg-surface px-5 py-4 flex flex-col justify-between group"
      title={title || ''}
    >
      <div className="text-small text-muted uppercase tracking-wider font-medium mb-2">
        {label}
      </div>
      <div
        className={`font-bold tabular-nums ${mono ? 'font-mono' : ''} ${color} transition-colors duration-300`}
        style={{ fontSize: '1.35rem', lineHeight: '1.3' }}
      >
        {displayValue}
      </div>
    </div>
  );
}

export default function StatsBar({ stats, accuracy }) {
  if (!stats) return null;
  const { totalSymbols, needsDecisionCount, biggestMover, avgChange } = stats;
  const avgIsUp = avgChange >= 0;

  const cells = [
    {
      label: 'Tracking',
      value: String(totalSymbols),
      rawValue: totalSymbols,
      isNumeric: true,
      decimals: 0,
      color: 'text-text',
    },
    {
      label: 'Needs Attention',
      value: String(needsDecisionCount),
      rawValue: needsDecisionCount,
      isNumeric: true,
      decimals: 0,
      color: needsDecisionCount > 0 ? 'text-bad' : 'text-text',
    },
    {
      label: 'Avg Move',
      value: `${avgIsUp ? '+' : ''}${avgChange.toFixed(2)}%`,
      rawValue: avgChange,
      isNumeric: true,
      decimals: 2,
      suffix: '%',
      color: avgIsUp ? 'text-good' : 'text-bad',
      mono: true,
    },
    {
      label: 'Biggest Mover',
      value: biggestMover
        ? `${biggestMover.symbol} ${biggestMover.pctChange >= 0 ? '+' : ''}${biggestMover.pctChange?.toFixed(2)}%`
        : '—',
      isNumeric: false,
      color: biggestMover
        ? biggestMover.pctChange >= 0
          ? 'text-good'
          : 'text-bad'
        : 'text-muted',
      mono: true,
    },
    {
      label: 'Signal Accuracy',
      value: accuracy != null ? `${accuracy}%` : '—',
      rawValue: accuracy,
      isNumeric: accuracy != null,
      decimals: 0,
      suffix: '%',
      color:
        accuracy == null
          ? 'text-muted'
          : accuracy >= 60
          ? 'text-good'
          : accuracy >= 40
          ? 'text-warn'
          : 'text-bad',
      mono: true,
      title: '% of flagged events followed by further price movement in next 3 poll cycles',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-border rounded-xl overflow-hidden mb-6 border border-border shadow-card">
      {cells.map((cell, i) => (
        <StatCell key={i} {...cell} />
      ))}
    </div>
  );
}
