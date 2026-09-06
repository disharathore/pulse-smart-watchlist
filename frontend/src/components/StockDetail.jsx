import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../api.js';

export default function StockDetail({ symbol, onClose }) {
  const [data, setData] = useState(null);
  const [news, setNews] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setNews([]);
    setError(null);

    Promise.all([
      api.getHistory(symbol).catch((err) => { throw err; }),
      api.getNews(symbol).catch(() => ({ news: [] })),
    ])
      .then(([resHistory, resNews]) => {
        if (cancelled) return;
        setData(resHistory);
        setNews(resNews?.news || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const chartData = (data?.history || []).map((h) => ({
    time: new Date(h.snapshot_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    price: Number(h.price),
  }));

  const isPositive = chartData.length >= 2 ? chartData[chartData.length - 1].price >= chartData[0].price : true;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-lg shadow-card max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4 border-b border-border pb-3">
          <div>
            <h2 className="text-card-title font-semibold text-text">{symbol} Details</h2>
            <p className="text-small text-muted">Price snapshots and detected event log</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-text p-1 rounded hover:bg-surface-2 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>

        {error && <div className="p-3 mb-4 rounded bg-bad/10 border border-bad/30 text-bad text-small">{error}</div>}
        {!data && !error && (
          <div className="h-56 flex items-center justify-center text-small text-muted">
            Loading data...
          </div>
        )}

        {data && (
          <>
            <div className="h-60 mb-6 border border-border rounded-lg bg-surface-2 p-3">
              {chartData.length >= 2 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="#1e1e22" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      domain={['auto', 'auto']}
                      stroke="#71717a"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#111113',
                        border: '1px solid #1e1e22',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#ececef',
                      }}
                      formatter={(val) => [`$${Number(val).toFixed(2)}`, 'Price']}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke={isPositive ? '#22c55e' : '#ef4444'}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-small text-muted">
                  Collecting history... Check back after the next poll cycle.
                </div>
              )}
            </div>

            <h3 className="text-section-header text-text mb-3">Detected Events</h3>
            {data.events?.length ? (
              <div className="space-y-2">
                {data.events.map((e) => (
                  <div key={e.id} className="text-small bg-surface-2 border border-border rounded-lg p-3">
                    <div className="flex justify-between items-center text-muted mb-1 text-[11px]">
                      <span className="font-semibold uppercase tracking-wider text-text">
                        {e.event_type?.replace(/_/g, ' ')}
                      </span>
                      <span>{new Date(e.detected_at).toLocaleString()}</span>
                    </div>
                    <div className="text-text">{e.reason_text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-small text-muted">No events detected yet.</p>
            )}

            {/* Recent News & Context */}
            <div className="mt-6 pt-5 border-t border-border">
              <h3 className="text-section-header text-text mb-3 flex items-center gap-2">
                <span>Recent News & Market Context</span>
                {news.length > 0 && (
                  <span className="text-[10px] font-mono text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border">
                    {news.length}
                  </span>
                )}
              </h3>
              {news.length > 0 ? (
                <div className="space-y-2.5">
                  {news.map((item) => (
                    <div
                      key={item.id}
                      className="text-small bg-surface-2/70 border border-border rounded-lg p-3 hover:border-border-hover transition-colors"
                    >
                      <div className="flex justify-between items-center text-muted mb-1 text-[11px]">
                        <span className="font-semibold text-accent flex items-center gap-1">
                          <span>📰</span> {item.source || 'News'}
                        </span>
                        <span>
                          {item.datetime
                            ? new Date(item.datetime * 1000).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text hover:text-accent font-medium leading-snug block transition-colors mb-1"
                      >
                        {item.headline} ↗
                      </a>
                      {item.summary && (
                        <p className="text-muted text-[11px] leading-relaxed line-clamp-2">
                          {item.summary}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-small text-muted">No recent company headlines found.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
