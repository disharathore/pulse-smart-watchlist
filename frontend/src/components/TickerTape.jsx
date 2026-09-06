function ArrowUpIcon() {
  return (
    <svg className="w-2.5 h-2.5 inline-block fill-current" viewBox="0 0 10 10">
      <polygon points="5,1 9,8 1,8" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg className="w-2.5 h-2.5 inline-block fill-current" viewBox="0 0 10 10">
      <polygon points="5,9 9,2 1,2" />
    </svg>
  );
}

export default function TickerTape({ items }) {
  if (!items || items.length === 0) return null;

  const renderItems = (keyPrefix) =>
    items.map((item) => {
      const isUp = (item.pctChange ?? 0) >= 0;
      return (
        <span
          key={`${keyPrefix}-${item.symbol}`}
          className="flex items-center gap-2 px-4 whitespace-nowrap text-small border-r border-border"
        >
          <span className="font-semibold text-text">{item.symbol}</span>
          <span className="text-muted font-mono">
            {item.price != null ? `$${item.price.toFixed(2)}` : '—'}
          </span>
          <span className={`font-mono font-medium flex items-center gap-0.5 ${isUp ? 'text-good' : 'text-bad'}`}>
            {item.pctChange != null ? (
              <>
                {isUp ? <ArrowUpIcon /> : <ArrowDownIcon />}
                <span>{Math.abs(item.pctChange).toFixed(2)}%</span>
              </>
            ) : (
              '—'
            )}
          </span>
        </span>
      );
    });

  return (
    <div className="w-full overflow-hidden border-b border-border bg-surface py-1 select-none">
      <div className="ticker-track">
        {renderItems('a')}
        {renderItems('b')}
      </div>
    </div>
  );
}
