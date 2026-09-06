import { useState, useEffect } from 'react';

export default function SettingsModal({ currentSettings, onSave, onClose }) {
  const [needsDecision, setNeedsDecision] = useState(currentSettings?.needsDecision ?? 55);
  const [worthALook, setWorthALook] = useState(currentSettings?.worthALook ?? 25);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState(null);

  useEffect(() => {
    if (currentSettings) {
      setNeedsDecision(currentSettings.needsDecision ?? 55);
      setWorthALook(currentSettings.worthALook ?? 25);
    }
  }, [currentSettings]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (needsDecision <= worthALook) {
      setValidationError('Needs Decision threshold must be strictly higher than Worth a Look.');
      return;
    }
    setValidationError(null);
    setSaving(true);
    try {
      await onSave({ needsDecision: Number(needsDecision), worthALook: Number(worthALook) });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setNeedsDecision(55);
    setWorthALook(25);
    setValidationError(null);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-lg shadow-card max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-3 mb-5">
          <div>
            <h2 className="text-card-title text-text font-semibold">
              Sensitivity Settings
            </h2>
            <p className="text-small text-muted mt-0.5">
              Configure score trigger thresholds (0–100 scale)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-text p-1 rounded hover:bg-surface-2 transition-colors"
            aria-label="Close settings"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>

        {validationError && (
          <div className="mb-4 p-3 rounded bg-bad/10 border border-bad/30 text-bad text-small">
            {validationError}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Threshold 1: Needs Decision */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-small font-semibold text-text flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-bad inline-block" />
                Needs Decision
              </label>
              <span className="font-mono text-small font-semibold text-bad">
                ≥ {needsDecision}
              </span>
            </div>
            <p className="text-small text-muted mb-2.5">
              High priority. Flags extreme statistical outliers, day extremes, or fast momentum.
            </p>
            <input
              type="range"
              min="30"
              max="90"
              value={needsDecision}
              onChange={(e) => setNeedsDecision(Number(e.target.value))}
              className="w-full accent-accent cursor-pointer h-1.5 bg-surface-2 rounded-lg"
            />
          </div>

          {/* Threshold 2: Worth a Look */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-small font-semibold text-text flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-warn inline-block" />
                Worth a Look
              </label>
              <span className="font-mono text-small font-semibold text-warn">
                ≥ {worthALook}
              </span>
            </div>
            <p className="text-small text-muted mb-2.5">
              Moderate priority. Stocks between this and Needs Decision are flagged for attention.
            </p>
            <input
              type="range"
              min="10"
              max="60"
              value={worthALook}
              onChange={(e) => setWorthALook(Number(e.target.value))}
              className="w-full accent-accent cursor-pointer h-1.5 bg-surface-2 rounded-lg"
            />
          </div>

          {/* Triage Preview */}
          <div className="rounded-lg border border-border bg-surface-2 p-3.5 space-y-2 text-small">
            <div className="text-[11px] uppercase tracking-wider text-muted font-medium">Active Ranges</div>
            <div className="flex justify-between items-center text-bad font-mono">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-bad"/> Needs Decision:</span>
              <span>{needsDecision} – 100</span>
            </div>
            <div className="flex justify-between items-center text-warn font-mono">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-warn"/> Worth a Look:</span>
              <span>{worthALook} – {needsDecision - 1}</span>
            </div>
            <div className="flex justify-between items-center text-muted font-mono">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-muted"/> Quiet:</span>
              <span>0 – {worthALook - 1}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <button
              type="button"
              onClick={handleReset}
              className="text-small text-muted hover:text-text underline"
            >
              Reset defaults
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
