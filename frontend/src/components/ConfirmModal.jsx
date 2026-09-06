import { useEffect } from 'react';

export default function ConfirmModal({ symbol, onConfirm, onCancel }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  if (!symbol) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-surface border border-border rounded-lg shadow-card max-w-sm w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-bad text-small font-semibold mb-2">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 16 16">
            <path d="M8 1a7 7 0 1 0 7 7A7.008 7.008 0 0 0 8 1zm0 10a1 1 0 1 1 1-1 1 1 0 0 1-1 1zm1-3.5a1 1 0 0 1-2 0V4.5a1 1 0 0 1 2 0z" />
          </svg>
          Confirm Removal
        </div>
        <h3 className="text-card-title text-text mb-1">Remove {symbol}?</h3>
        <p className="text-body text-muted mb-5">
          This will stop monitoring price changes and clear its accumulated snapshot history.
        </p>
        <div className="flex justify-end gap-2 text-small">
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 bg-bad text-white font-medium rounded-[6px] hover:bg-bad/90 transition-all duration-150 active:scale-[0.98]"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
