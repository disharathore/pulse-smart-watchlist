import { useState } from 'react';

export default function AddStockForm({ onAdd }) {
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const raw = symbol.trim();
    if (!raw) return;
    const symbols = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    setLoading(true);
    try {
      await onAdd(symbols);
      setSymbol('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <div className="relative flex items-center">
        <input
          id="add-symbol-input"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Add ticker (e.g. AAPL, NVDA)..."
          className="input-field text-small py-1 px-2.5 w-44 sm:w-56"
          disabled={loading}
        />
        <span className="hidden sm:inline-block absolute right-2 text-[10px] text-muted border border-border px-1 py-0.2 rounded bg-surface pointer-events-none">
          /
        </span>
      </div>
      <button
        type="submit"
        disabled={loading || !symbol.trim()}
        className="btn-primary py-1 px-3 text-small disabled:opacity-50"
      >
        {loading ? 'Adding...' : 'Add'}
      </button>
    </form>
  );
}
