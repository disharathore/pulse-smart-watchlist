export default function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 skeleton-pulse">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="h-5 w-20 bg-surface-2 rounded mb-2" />
          <div className="h-4 w-28 bg-surface-2 rounded" />
        </div>
        <div className="h-8 w-12 bg-surface-2 rounded" />
      </div>
      <div className="h-8 w-full bg-surface-2 rounded mt-3" />
    </div>
  );
}

export function SkeletonGrid({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
