export default function EndpointsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-deep-iris/30" />
        <div className="h-4 w-64 animate-pulse rounded bg-deep-iris/20" />
      </div>

      {/* Card grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-soft-violet/10 bg-midnight-plum p-5"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 animate-pulse rounded bg-deep-iris/30" />
              <div className="size-6 animate-pulse rounded-full bg-deep-iris/20" />
            </div>
            <div className="mt-3 h-3 w-48 animate-pulse rounded bg-deep-iris/20" />
            <div className="mt-4 flex items-center gap-3">
              <div className="h-6 w-16 animate-pulse rounded-full bg-deep-iris/20" />
              <div className="h-3 w-20 animate-pulse rounded bg-deep-iris/15" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
