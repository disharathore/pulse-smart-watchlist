import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from './api.js';
import { ToastProvider, useToast } from './components/Toast.jsx';
import AddStockForm from './components/AddStockForm.jsx';
import CatchupView from './components/CatchupView.jsx';
import WatchlistTable from './components/WatchlistTable.jsx';
import StockDetail from './components/StockDetail.jsx';
import StatsBar from './components/StatsBar.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import TickerTape from './components/TickerTape.jsx';
import HelpModal from './components/HelpModal.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import PortfolioChart from './components/PortfolioChart.jsx';
import { SkeletonGrid } from './components/Skeleton.jsx';

const FALLBACK_POLL_MS = 30000;

function computeStats(fullList) {
  if (!fullList.length) return null;
  const withChange = fullList.filter((i) => i.pctChange != null);
  const avgChange = withChange.length
    ? withChange.reduce((sum, i) => sum + i.pctChange, 0) / withChange.length
    : 0;
  const biggestMover = withChange.length
    ? withChange.reduce((max, i) => (Math.abs(i.pctChange) > Math.abs(max.pctChange) ? i : max))
    : null;
  return {
    totalSymbols: fullList.length,
    needsDecisionCount: fullList.filter((i) => i.triage === 'needs_decision').length,
    avgChange,
    biggestMover,
  };
}

function AppInner() {
  const toast = useToast();
  const [tab, setTab] = useState('catchup');
  const [catchup, setCatchup] = useState(null);
  const [fullList, setFullList] = useState([]);
  const [detailSymbol, setDetailSymbol] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals & Panels
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ needsDecision: 55, worthALook: 25 });

  // Signal Accuracy
  const [accuracy, setAccuracy] = useState(null);

  // SSE connection status
  const [sseConnected, setSseConnected] = useState(false);

  // Unseen needs_decision count & notification tracking
  const [unseenCount, setUnseenCount] = useState(0);
  const notifiedKeysRef = useRef(new Set());
  const bellDismissedRef = useRef(false);

  // Load watchlist & catch-up data
  const loadAll = useCallback(async (silent = false) => {
    try {
      const [c, f] = await Promise.all([api.getCatchup(), api.getWatchlist()]);
      setCatchup(c);
      const list = Array.isArray(f) ? f : [];
      setFullList(list);
      setError(null);

      // Check for new needs_decision events to notify
      const needsDecisionItems = c?.needsDecision || [];
      if (needsDecisionItems.length > 0) {
        for (const item of needsDecisionItems) {
          const key = `${item.symbol}-${item.score}-${item.reasons?.[0] || ''}`;
          if (!notifiedKeysRef.current.has(key)) {
            notifiedKeysRef.current.add(key);

            // Trigger native notification if allowed
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`Pulse: ${item.symbol}`, {
                  body: `${item.reasons?.[0] || 'Unusual market activity requires review.'} (Score: ${item.score})`,
                  icon: '/favicon.ico',
                });
              } catch (e) {
                console.error('Notification error:', e);
              }
            }
          }
        }
      }

      // Update unseen badge count: show if user is on full list or hasn't dismissed the bell
      if (needsDecisionItems.length > 0) {
        if (tab !== 'catchup' || !bellDismissedRef.current) {
          setUnseenCount(needsDecisionItems.length);
        }
      } else {
        setUnseenCount(0);
      }
    } catch (err) {
      setError(err.message);
      if (!silent) toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast, tab]);

  // Load accuracy stats
  const loadAccuracy = useCallback(async () => {
    try {
      const data = await api.getAccuracy();
      setAccuracy(data.accuracyPct ?? null);
    } catch {
      // Informational only
    }
  }, []);

  // Load user settings
  const loadSettings = useCallback(async () => {
    try {
      const s = await api.getSettings();
      if (s) setSettings(s);
    } catch (err) {
      console.warn('Failed to load settings:', err);
    }
  }, []);

  // 1. Initial load
  useEffect(() => {
    loadAll();
    loadAccuracy();
    loadSettings();
  }, [loadAll, loadAccuracy, loadSettings]);

  // 2. SSE live push with polling fallback
  useEffect(() => {
    let es = null;
    let fallbackInterval = null;

    const connectSSE = () => {
      try {
        es = new EventSource(api.getStreamUrl());

        es.onopen = () => {
          setSseConnected(true);
        };

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected') {
              setSseConnected(true);
              return;
            }
            if (data.type === 'correlated_move') {
              toast(`Correlated move: ${data.count} symbols moving together`, 'info');
            }
            loadAll(true);
            loadAccuracy();
          } catch {
            loadAll(true);
          }
        };

        es.onerror = () => {
          setSseConnected(false);
        };
      } catch (err) {
        setSseConnected(false);
      }
    };

    connectSSE();

    fallbackInterval = setInterval(() => {
      loadAll(true);
      loadAccuracy();
    }, FALLBACK_POLL_MS);

    return () => {
      if (es) es.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [loadAll, loadAccuracy, toast]);

  // Manual refresh handler
  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadAll(true), loadAccuracy()]);
      toast('Watchlist refreshed', 'success');
    } catch (err) {
      toast(`Refresh failed: ${err.message}`, 'error');
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  }, [loadAll, loadAccuracy, toast]);

  // Global Keyboard Shortcuts (Part 3C)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isInputFocused = tag === 'input' || tag === 'textarea';

      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        const input = document.getElementById('add-symbol-input');
        if (input) {
          input.focus();
          input.select();
        }
      } else if ((e.key === 'r' || e.key === 'R') && !isInputFocused && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleManualRefresh();
      } else if (e.key === 'Escape') {
        setDetailSymbol(null);
        setPendingRemove(null);
        setShowHelp(false);
        setShowSettings(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleManualRefresh]);

  // Handle notification permission request & Bell click
  const handleBellClick = () => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') toast('Browser notifications enabled', 'success');
      });
    }

    setTab('catchup');
    setUnseenCount(0);
    bellDismissedRef.current = true;

    setTimeout(() => {
      const section = document.getElementById('needs-decision-section');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  };

  const handleAdd = async (symbols) => {
    let succeeded = 0;
    for (const s of symbols) {
      try {
        await api.addSymbol(s);
        succeeded++;
      } catch (err) {
        toast(`${s}: ${err.message}`, 'error');
      }
    }
    if (succeeded > 0) {
      toast(`Added ${succeeded} symbol${succeeded > 1 ? 's' : ''}`, 'success');
      await loadAll();
    }
  };

  const handleRemove = async (symbol) => {
    try {
      await api.removeSymbol(symbol);
      toast(`Removed ${symbol}`, 'success');
      await loadAll();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setPendingRemove(null);
    }
  };

  const handleOpenDetail = async (symbol) => {
    setDetailSymbol(symbol);
    api.markSeen(symbol).catch(() => {});
  };

  const handleExport = async () => {
    try {
      await api.exportCSV();
      toast('CSV exported', 'success');
    } catch (err) {
      toast(`Export failed: ${err.message}`, 'error');
    }
  };

  const handleSaveSettings = async (newSettings) => {
    try {
      const updated = await api.updateSettings(newSettings);
      setSettings(updated);
      bellDismissedRef.current = false;
      toast('Sensitivity thresholds updated', 'success');
      await loadAll(true);
    } catch (err) {
      toast(`Settings error: ${err.message}`, 'error');
    }
  };

  const stats = computeStats(fullList);
  const isEmpty = !loading && fullList.length === 0;

  return (
    <div className="min-h-screen bg-bg text-text">
      <TickerTape items={fullList} />

      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-bg/95 backdrop-blur-sm z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Left: Logo + Status */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <h1 className="text-page-title tracking-tight text-text font-semibold">
                  Pulse
                </h1>
              </div>

              {/* Live/Poll status dot */}
              <div
                className="flex items-center gap-1.5 text-small text-muted bg-surface px-2 py-0.5 rounded-full border border-border"
                title={sseConnected ? 'Connected via Server-Sent Events' : 'SSE reconnecting — polling every 30s'}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    sseConnected ? 'bg-good' : 'bg-warn animate-pulse'
                  }`}
                />
                <span>{sseConnected ? 'Live' : 'Polling'}</span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <AddStockForm onAdd={handleAdd} />

              {/* Refresh */}
              <button
                id="refresh-btn"
                onClick={handleManualRefresh}
                title="Refresh quotes (Hotkey: R)"
                disabled={refreshing}
                className="btn-secondary p-1.5"
              >
                <svg
                  className={`w-4 h-4 ${refreshing ? 'spin-anim text-accent' : ''}`}
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M1 8a7 7 0 0 1 12.3-4.5M15 8a7 7 0 0 1-12.3 4.5" />
                  <polyline points="13 1 13 4 10 4" />
                  <polyline points="3 15 3 12 6 12" />
                </svg>
              </button>

              {/* Notification Bell */}
              <button
                id="bell-btn"
                onClick={handleBellClick}
                title={unseenCount > 0 ? `${unseenCount} unseen alerts` : 'Notifications'}
                className={`btn-secondary p-1.5 relative ${unseenCount > 0 ? 'border-bad/50 text-bad' : ''}`}
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 16 16">
                  <path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5v3.25L2 11.5v1h12v-1l-1.5-2.25V6A4.5 4.5 0 0 0 8 1.5zM6.5 13.5a1.5 1.5 0 0 0 3 0h-3z" />
                </svg>
                {unseenCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-bad text-white text-[9px] font-semibold w-4 h-4 rounded-full flex items-center justify-center">
                    {unseenCount}
                  </span>
                )}
              </button>

              {/* Settings */}
              <button
                id="settings-btn"
                onClick={() => setShowSettings(true)}
                title="Settings"
                className="btn-secondary p-1.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6.5 1.5h3l.5 2 1.5.7 1.8-1 2.1 2.1-1 1.8.7 1.5 2 .5v3l-2 .5-.7 1.5 1 1.8-2.1 2.1-1.8-1-1.5.7-.5 2h-3l-.5-2-1.5-.7-1.8 1-2.1-2.1 1-1.8-.7-1.5-2-.5v-3l2-.5.7-1.5-1-1.8 2.1-2.1 1.8 1 1.5-.7z" />
                  <circle cx="8" cy="8" r="2" />
                </svg>
              </button>

              {/* Export */}
              <button
                id="export-csv-btn"
                onClick={handleExport}
                title="Export CSV"
                className="btn-secondary p-1.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 11v3h12v-3M8 2v8M5 7l3 3 3-3" />
                </svg>
              </button>

              {/* Help */}
              <button
                id="help-btn"
                onClick={() => setShowHelp(true)}
                title="How it works & Shortcuts"
                className="btn-secondary p-1.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M6 6a2 2 0 1 1 2 2v1.5" />
                  <circle cx="8" cy="12" r="0.5" fill="currentColor" />
                </svg>
              </button>

              {/* Tab Segmented Control */}
              <div className="flex bg-surface rounded-lg border border-border p-0.5">
                <button
                  id="tab-catchup"
                  onClick={() => {
                    setTab('catchup');
                    setUnseenCount(0);
                  }}
                  className={`px-3 py-1 text-small font-medium rounded-[5px] transition-all duration-150 ${
                    tab === 'catchup'
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  Catch-up
                </button>
                <button
                  id="tab-full"
                  onClick={() => setTab('full')}
                  className={`px-3 py-1 text-small font-medium rounded-[5px] transition-all duration-150 ${
                    tab === 'full'
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  Full List
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="border border-bad/30 bg-bad/5 text-bad text-body px-4 py-3 mb-6 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <SkeletonGrid count={3} />
        ) : isEmpty ? (
          /* Guided first-run experience (Part 3B) */
          <div className="text-center py-16 px-6 border border-border/80 rounded-2xl bg-surface/80 shadow-card max-w-lg mx-auto my-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 text-accent flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner">
              ⚡
            </div>
            <h2 className="text-xl font-bold text-text mb-2 tracking-tight">Welcome to Pulse</h2>
            <p className="text-body text-muted mb-6 max-w-md mx-auto leading-relaxed">
              Pulse uses per-symbol statistical baselines to filter market noise and highlight moves that actually require your attention.
            </p>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Quick Add Market Leaders</div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN'].map((sym) => (
                <button
                  key={sym}
                  onClick={() => handleAdd([sym])}
                  className="btn-secondary text-small px-3 py-1.5 hover:border-accent/50 hover:text-accent transition-all font-mono font-medium"
                >
                  + {sym}
                </button>
              ))}
            </div>
            <div className="mt-6 text-[11px] text-muted/60 flex items-center justify-center gap-2">
              <span>Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[10px] font-mono text-muted">/</kbd> to search anytime</span>
            </div>
          </div>
        ) : (
          <>
            <StatsBar stats={stats} accuracy={accuracy} />
            <PortfolioChart items={fullList} />
            {tab === 'catchup' ? (
              <CatchupView
                catchup={catchup || { needsDecision: [], worthALook: [], nothingToDo: [] }}
                onRemove={(s) => setPendingRemove(s)}
                onOpenDetail={handleOpenDetail}
              />
            ) : (
              <WatchlistTable
                items={fullList}
                onRemove={(s) => setPendingRemove(s)}
                onOpenDetail={handleOpenDetail}
              />
            )}
          </>
        )}
      </main>

      {/* Modal Dialogs */}
      {detailSymbol && <StockDetail symbol={detailSymbol} onClose={() => setDetailSymbol(null)} />}
      <ConfirmModal
        symbol={pendingRemove}
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => handleRemove(pendingRemove)}
      />
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showSettings && (
        <SettingsModal
          currentSettings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
