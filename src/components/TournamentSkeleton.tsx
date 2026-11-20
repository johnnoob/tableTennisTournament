import { Skeleton } from '@/components/ui/skeleton';

export function TournamentSkeleton() {
  return (
    <div className="arena-page">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="w-2 h-14 rounded-full" />
          <div className="space-y-2.5">
            <Skeleton className="h-9 w-40 rounded-xl" />
            <Skeleton className="h-4 w-48 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-12 w-full md:w-64 rounded-2xl" />
      </header>

      <div className="flex gap-2.5 py-3 border-y border-slate-200/70">
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-24 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-56 w-full rounded-2xl md:rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
