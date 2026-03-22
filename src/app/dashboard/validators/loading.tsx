export default function ValidatorsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-deep-iris/30" />
        <div className="h-4 w-64 animate-pulse rounded bg-deep-iris/20" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-soft-violet/10 bg-midnight-plum">
        <div className="border-b border-slate-DEFAULT/10 px-6 py-3">
          <div className="flex gap-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 w-20 animate-pulse rounded bg-deep-iris/30" />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-8 border-b border-slate-DEFAULT/5 px-6 py-4">
            <div className="h-4 w-32 animate-pulse rounded bg-deep-iris/20" />
            <div className="h-4 w-16 animate-pulse rounded bg-deep-iris/20" />
            <div className="h-4 w-20 animate-pulse rounded bg-deep-iris/20" />
            <div className="h-4 w-16 animate-pulse rounded bg-deep-iris/20" />
            <div className="h-4 w-12 animate-pulse rounded bg-deep-iris/20" />
          </div>
        ))}
      </div>
    </div>
  );
}
