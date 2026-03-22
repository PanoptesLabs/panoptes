export default function GovernanceLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-deep-iris/30" />
        <div className="h-4 w-64 animate-pulse rounded bg-deep-iris/20" />
      </div>

      {/* List skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-soft-violet/10 bg-midnight-plum p-5"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-4 w-48 animate-pulse rounded bg-deep-iris/30" />
                <div className="h-3 w-72 animate-pulse rounded bg-deep-iris/20" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded-full bg-deep-iris/20" />
            </div>
            <div className="mt-3 flex gap-4">
              <div className="h-3 w-24 animate-pulse rounded bg-deep-iris/15" />
              <div className="h-3 w-20 animate-pulse rounded bg-deep-iris/15" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
