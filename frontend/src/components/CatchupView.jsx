import { useState } from 'react';
import StockCard from './StockCard.jsx';

function Section({ id, title, items, onRemove, onOpenDetail, defaultOpen = true, dotColor }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!items.length) return null;

  return (
    <div id={id} className="mb-6 scroll-mt-20">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between mb-3 border-b border-border pb-2 group text-left hover:border-border-hover transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <h2 className="text-section-header text-text">
            {title}
          </h2>
          <span className="text-small text-muted font-mono bg-surface-2 px-1.5 py-0.5 rounded border border-border">
            {items.length}
          </span>
        </div>
        <span className="text-small text-muted flex items-center gap-1 group-hover:text-text transition-colors">
          <span>{open ? 'Collapse' : 'Expand'}</span>
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 card-grid">
          {items.map((item) => (
            <StockCard
              key={item.symbol}
              item={item}
              onRemove={onRemove}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CatchupView({ catchup, onRemove, onOpenDetail }) {
  const total =
    (catchup?.needsDecision?.length || 0) +
    (catchup?.worthALook?.length || 0) +
    (catchup?.nothingToDo?.length || 0);

  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <Section
        id="needs-decision-section"
        title="Needs Decision"
        items={catchup.needsDecision || []}
        onRemove={onRemove}
        onOpenDetail={onOpenDetail}
        dotColor="bg-bad"
        defaultOpen={true}
      />
      <Section
        id="worth-a-look-section"
        title="Worth a Look"
        items={catchup.worthALook || []}
        onRemove={onRemove}
        onOpenDetail={onOpenDetail}
        dotColor="bg-warn"
        defaultOpen={true}
      />
      <Section
        id="quiet-section"
        title="Quiet"
        items={catchup.nothingToDo || []}
        onRemove={onRemove}
        onOpenDetail={onOpenDetail}
        dotColor="bg-muted"
        defaultOpen={false}
      />
    </div>
  );
}
