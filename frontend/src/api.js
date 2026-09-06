const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (err) {
    throw new Error('Could not reach the backend. Is it running on port 3001?');
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    throw new Error(`Unexpected response from server (status ${res.status}).`);
  }

  if (!res.ok) {
    throw new Error(body?.error || `Request failed with status ${res.status}`);
  }

  return body;
}

export const api = {
  getWatchlist: () => request('/watchlist'),
  getCatchup: () => request('/watchlist/catchup'),
  getStats: () => request('/watchlist/stats'),
  getAccuracy: () => request('/watchlist/accuracy'),
  addSymbol: (symbol) =>
    request('/watchlist/items', { method: 'POST', body: JSON.stringify({ symbol }) }),
  removeSymbol: (symbol) => request(`/watchlist/items/${symbol}`, { method: 'DELETE' }),
  markSeen: (symbol) =>
    request('/watchlist/seen', { method: 'POST', body: JSON.stringify(symbol ? { symbol } : {}) }),
  getHistory: (symbol) => request(`/stocks/${symbol}/history`),
  getNews: (symbol) => request(`/stocks/${symbol}/news`),
  getMarketStatus: () => request('/market-status'),

  // Sensitivity Settings (Priority C)
  getSettings: () => request('/settings'),
  updateSettings: (settings) =>
    request('/settings', { method: 'POST', body: JSON.stringify(settings) }),

  // SSE Stream URL helper (Priority A)
  getStreamUrl: () => `${API_BASE}/watchlist/stream`,

  // CSV export
  exportCSV: async () => {
    let res;
    try {
      res = await fetch(`${API_BASE}/watchlist/export`);
    } catch {
      throw new Error('Could not reach the backend. Is it running on port 3001?');
    }
    if (!res.ok) throw new Error(`Export failed with status ${res.status}`);
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `pulse-watchlist-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
