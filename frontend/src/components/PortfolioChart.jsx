import { useEffect, useState, useRef } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { api } from '../api.js';

function formatTime(isoStr, isMultiDay = false) {
  const d = new Date(isoStr);
  if (isMultiDay) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Distinct, controlled palette for Compare Mode
const COMPARE_COLORS = ['#6366f1', '#22c55e', '#06b6d4', '#f59e0b', '#ec4899'];

/**
 * Builds aggregated series (for AreaChart) AND individual symbol series (for Compare Mode).
 */
function processSymbolSeries(symbolHistories, baselineMap = {}) {
  const bySymbol = {};

  for (const item of symbolHistories) {
    const { symbol, history, prevClose, open } = item;
    if (!history || history.length === 0) continue;

    const baseline =
      Number(baselineMap[symbol]) ||
      Number(prevClose) ||
      Number(open) ||
      Number(history[0]?.price);

    if (!baseline || isNaN(baseline)) continue;

    bySymbol[symbol] = history
      .map((h) => {
        const price = Number(h.price);
        if (!price || isNaN(price)) return null;
        const ts = new Date(h.snapshot_at).getTime();
        const pct = ((price - baseline) / baseline) * 100;
        return { ts, pct: parseFloat(pct.toFixed(2)), price };
      })
      .filter(Boolean)
      .sort((a, b) => a.ts - b.ts);
  }

  const symbolKeys = Object.keys(bySymbol);
  if (symbolKeys.length === 0) return { aggregate: [], bySymbol: {}, symbolKeys: [] };

  // Determine time range
  let minTs = Infinity;
  let maxTs = -Infinity;
  for (const s of symbolKeys) {
    const pts = bySymbol[s];
    if (pts.length > 0) {
      if (pts[0].ts < minTs) minTs = pts[0].ts;
      if (pts[pts.length - 1].ts > maxTs) maxTs = pts[pts.length - 1].ts;
    }
  }

  if (minTs === Infinity || maxTs === -Infinity) {
    return { aggregate: [], bySymbol: {}, symbolKeys: [] };
  }

  const isMultiDay = maxTs - minTs > 20 * 3600 * 1000;
  const timeSpan = maxTs - minTs;

  // 30-45 sample points
  const numSteps = Math.min(45, Math.max(15, symbolKeys.length * 8));
  const step = timeSpan > 0 ? timeSpan / numSteps : 60000;

  const samplePoints = [];
  for (let t = minTs; t <= maxTs; t += step) {
    samplePoints.push(t);
  }
  if (samplePoints[samplePoints.length - 1] < maxTs) {
    samplePoints.push(maxTs);
  }

  const aggregate = [];
  const comparePoints = [];

  for (const t of samplePoints) {
    const activePcts = [];
    const pointData = {
      ts: t,
      time: formatTime(new Date(t).toISOString(), isMultiDay),
    };

    for (const s of symbolKeys) {
      const pts = bySymbol[s];
      if (pts.length > 0 && pts[0].ts <= t) {
        let latest = pts[0];
        for (let i = 1; i < pts.length; i++) {
          if (pts[i].ts <= t) {
            latest = pts[i];
          } else {
            break;
          }
        }
        activePcts.push(latest.pct);
        pointData[s] = latest.pct;
      }
    }

    if (activePcts.length > 0) {
      const avg = activePcts.reduce((sum, v) => sum + v, 0) / activePcts.length;
      pointData.avg = parseFloat(avg.toFixed(2));
      pointData.activeCount = activePcts.length;
      aggregate.push({
        ts: t,
        time: pointData.time,
        avg: pointData.avg,
        activeCount: pointData.activeCount,
      });
      comparePoints.push(pointData);
    }
  }

  return { aggregate, comparePoints, bySymbol, symbolKeys };
}

const CustomAggregateTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  const isPos = val >= 0;
  const activeCount = payload[0]?.payload?.activeCount;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-card text-small">
      <div className="text-muted mb-0.5">{label}</div>
      <div className={`font-mono font-semibold ${isPos ? 'text-good' : 'text-bad'}`}>
        {isPos ? '+' : ''}{val?.toFixed(2)}%
      </div>
      <div className="text-[10px] text-muted mt-0.5">
        Portfolio average ({activeCount || 0} active)
      </div>
    </div>
  );
};

const CustomCompareTooltip = ({ active, payload, label, selectedSymbols }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-card text-small min-w-[140px]">
      <div className="text-muted mb-1 text-[11px] border-b border-border pb-1">{label}</div>
      <div className="space-y-1">
        {payload.map((p) => {
          const isPos = p.value >= 0;
          return (
            <div key={p.dataKey} className="flex items-center justify-between gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: p.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                {p.dataKey}:
              </span>
              <span className={`font-mono font-semibold ${isPos ? 'text-good' : 'text-bad'}`}>
                {isPos ? '+' : ''}{p.value?.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function PortfolioChart({ items = [], symbols = [], isMarketClosed = false }) {
  const [data, setData] = useState({ aggregate: [], comparePoints: [], symbolKeys: [] });
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedCompare, setSelectedCompare] = useState([]);
  const mounted = useRef(true);

  const resolvedSymbols = items.length > 0
    ? items.map((i) => (typeof i === 'string' ? i : i.symbol))
    : symbols;

  const baselineMap = {};
  if (items.length > 0) {
    for (const item of items) {
      if (item?.symbol && item.prevClose != null) {
        baselineMap[item.symbol] = Number(item.prevClose);
      }
    }
  }

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const symbolsKey = resolvedSymbols.slice().sort().join(',');

  useEffect(() => {
    if (!resolvedSymbols || resolvedSymbols.length === 0) {
      setLoading(false);
      setData({ aggregate: [], comparePoints: [], symbolKeys: [] });
      return;
    }

    setLoading(true);

    Promise.all(
      resolvedSymbols.map((sym) =>
        api.getHistory(sym)
          .then((res) => ({
            symbol: sym,
            history: res.history || [],
            prevClose: res.prevClose,
            open: res.open,
            currentPrice: res.currentPrice,
          }))
          .catch(() => ({ symbol: sym, history: [] }))
      )
    ).then((results) => {
      if (!mounted.current) return;
      const processed = processSymbolSeries(results, baselineMap);
      setData(processed);

      // Default compare selection: up to first 3 symbols
      if (processed.symbolKeys.length > 0 && selectedCompare.length === 0) {
        setSelectedCompare(processed.symbolKeys.slice(0, 3));
      }
      setLoading(false);
    }).catch(() => {
      if (!mounted.current) return;
      setLoading(false);
    });
  }, [symbolsKey, Object.keys(baselineMap).length]);

  const toggleCompareSymbol = (sym) => {
    if (selectedCompare.includes(sym)) {
      if (selectedCompare.length > 1) {
        setSelectedCompare(selectedCompare.filter((s) => s !== sym));
      }
    } else {
      setSelectedCompare([...selectedCompare, sym]);
    }
  };

  const series = data.aggregate;
  const latestAvg = series.length > 0 ? series[series.length - 1].avg : null;
  const isPositive = latestAvg !== null ? latestAvg >= 0 : true;
  const lineColor = isPositive ? '#22c55e' : '#ef4444';

  if (loading) {
    return (
      <div className="w-full h-52 rounded-xl border border-border bg-surface flex items-center justify-center mb-6 skeleton-pulse">
        <span className="text-small text-muted">Loading portfolio performance…</span>
      </div>
    );
  }

  if (!series || series.length < 2) {
    return (
      <div className="w-full h-36 rounded-xl border border-border bg-surface flex items-center justify-center mb-6">
        <div className="text-center">
          <div className="text-small text-muted">Accumulating snapshot history…</div>
          <div className="text-[11px] text-muted/60 mt-1">Chart will populate as data is gathered</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mb-6 rounded-xl border border-border bg-surface overflow-hidden chart-elevation">
      {/* Chart header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-section-header text-text">Portfolio Performance</h2>
            {/* Compare mode toggle */}
            {data.symbolKeys.length > 1 && (
              <button
                onClick={() => setCompareMode(!compareMode)}
                className={`text-[11px] font-medium px-2 py-0.5 rounded border transition-all ${
                  compareMode
                    ? 'bg-accent/15 border-accent text-accent'
                    : 'bg-surface-2 border-border text-muted hover:text-text'
                }`}
                title="Overlay multiple symbols on one normalized chart"
              >
                {compareMode ? '✓ Comparing' : '⇄ Compare'}
              </button>
            )}
          </div>
          <div className="text-[11px] text-muted mt-0.5 flex items-center gap-2 flex-wrap">
            <span>
              {compareMode
                ? `Overlaying ${selectedCompare.length} symbols normalized to % change`
                : `Average % change today · ${resolvedSymbols.length} symbol${resolvedSymbols.length !== 1 ? 's' : ''}`}
            </span>
            {isMarketClosed && (
              <span className="text-muted/80 bg-surface-2 px-1.5 py-0.2 rounded border border-border text-[10px]">
                Prices reflect last close · Markets closed
              </span>
            )}
          </div>
        </div>

        {!compareMode && latestAvg !== null && (
          <div className="text-right">
            <div
              className={`font-mono text-xl font-bold tabular-nums ${
                latestAvg >= 0 ? 'text-good' : 'text-bad'
              }`}
            >
              {latestAvg >= 0 ? '+' : ''}{latestAvg.toFixed(2)}%
            </div>
            <div className="text-[10px] text-muted">portfolio avg today</div>
          </div>
        )}
      </div>

      {/* Compare Symbol Selector Pills */}
      {compareMode && data.symbolKeys.length > 0 && (
        <div className="px-5 py-2 border-b border-border/60 flex items-center gap-2 flex-wrap bg-surface-2/30">
          <span className="text-[11px] text-muted font-medium mr-1">Select:</span>
          {data.symbolKeys.map((sym, idx) => {
            const isSelected = selectedCompare.includes(sym);
            const colorIdx = selectedCompare.indexOf(sym);
            const color = colorIdx >= 0 ? COMPARE_COLORS[colorIdx % COMPARE_COLORS.length] : '#71717a';
            return (
              <button
                key={sym}
                onClick={() => toggleCompareSymbol(sym)}
                className={`text-[11px] font-mono px-2 py-0.5 rounded-full border transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'border-border-hover text-text font-semibold bg-surface'
                    : 'border-border text-muted/60 hover:text-muted bg-surface-2'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: isSelected ? color : '#3f3f46' }}
                />
                <span>{sym}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Chart body */}
      <div className="h-48 px-2 pb-3 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {compareMode ? (
            <LineChart data={data.comparePoints} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                stroke="#3f3f46"
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#3f3f46"
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
                width={52}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 2" />
              <Tooltip content={<CustomCompareTooltip selectedSymbols={selectedCompare} />} />
              {selectedCompare.map((sym, idx) => (
                <Line
                  key={sym}
                  type="monotone"
                  dataKey={sym}
                  stroke={COMPARE_COLORS[idx % COMPARE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={600}
                />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={lineColor} stopOpacity={0.16} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                stroke="#3f3f46"
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#3f3f46"
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
                width={52}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 2" />
              <Tooltip content={<CustomAggregateTooltip />} />
              <Area
                type="monotone"
                dataKey="avg"
                stroke={lineColor}
                strokeWidth={2}
                fill="url(#portfolioGrad)"
                dot={false}
                isAnimationActive={true}
                animationDuration={800}
                animationEasing="ease-out"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
