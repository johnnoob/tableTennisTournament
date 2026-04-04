import { Skeleton } from "@/components/ui/skeleton";

export function TournamentSkeleton() {
  return (
    <div className="pb-24 pt-8 px-6 space-y-8 bg-[#fbfcfe] min-h-screen">
      {/* Header Skeleton */}
      <header className="flex flex-col gap-2">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-4 w-32 rounded-md" />
      </header>

      {/* Hero Card Skeleton */}
      <div className="bg-slate-100/50 rounded-4xl p-8 h-[240px] md:h-[280px] flex flex-col justify-between border border-slate-100">
         <div className="space-y-4">
            <Skeleton className="h-8 w-32 rounded-lg bg-slate-200" />
            <Skeleton className="h-12 w-3/4 rounded-xl" />
            <div className="flex gap-4">
               <Skeleton className="h-4 w-24 rounded-md" />
               <Skeleton className="h-4 w-24 rounded-md" />
            </div>
         </div>
         <Skeleton className="h-14 w-full rounded-2xl mt-8" />
      </div>

      {/* Sub List Skeleton */}
      <section className="space-y-6">
        <Skeleton className="h-6 w-40 rounded-lg ml-1" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <Skeleton className="size-12 rounded-2xl" />
                  <div className="space-y-2">
                     <Skeleton className="h-5 w-48 rounded-lg" />
                     <Skeleton className="h-4 w-32 rounded-md" />
                  </div>
               </div>
               <Skeleton className="size-6 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
