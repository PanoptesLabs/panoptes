export default function IncidentsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-36 animate-pulse rounded-lg bg-deep-iris/30" />
        <div className="h-4 w-64 animate-pulse rounded bg-deep-iris/20" />
      </div>

      {/* Summary cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-soft-violet/10 bg-midnight-plum p-6"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 animate-pulse rounded bg-deep-iris/30" />
              <div className="size-8 animate-pulse rounded-lg bg-deep-iris/20" />
            </div>
            <div className="mt-4 h-8 w-16 animate-pulse rounded bg-deep-iris/30" />
          </div>
        ))}
      </div>

      {/* List skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-soft-violet/10 bg-midnight-plum p-5"
          >
            <div className="flex items-start gap-4">
              <div className="mt-0.5 size-5 animate-pulse rounded bg-deep-iris/20" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-56 animate-pulse rounded bg-deep-iris/30" />
                <div className="h-3 w-80 animate-pulse rounded bg-deep-iris/20" />
                <div className="flex gap-4">
                  <div className="h-3 w-16 animate-pulse rounded bg-deep-iris/15" />
                  <div className="h-3 w-24 animate-pulse rounded bg-deep-iris/15" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
