/** Shimmering placeholder block. Reserve space so there is no layout shift. */
export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />
}

/** Placeholder for a report list card while data loads. */
export function ReportCardSkeleton() {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-2/3" />
    </div>
  )
}
