export default function ScoreGauge({ score = 0 }) {
  const pct = Math.max(0, Math.min(100, score));

  // Color based on score level — semantic only
  const color =
    score >= 55
      ? { bar: 'bg-bad', text: 'text-bad', bg: 'bg-bad/10' }
      : score >= 25
      ? { bar: 'bg-warn', text: 'text-warn', bg: 'bg-warn/10' }
      : { bar: 'bg-muted/40', text: 'text-muted', bg: 'bg-surface-2' };

  return (
    <div className="flex items-center gap-2 shrink-0" title={`Attention Score: ${score}/100`}>
      {/* Thin horizontal progress line */}
      <div className="w-16 h-1 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full ${color.bar} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Numeric badge */}
      <span className={`text-small font-semibold font-mono tabular-nums px-1.5 py-0.5 rounded ${color.bg} ${color.text}`}>
        {score}
      </span>
    </div>
  );
}
