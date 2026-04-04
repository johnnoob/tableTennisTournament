import { Skeleton } from "@/components/ui/skeleton";

export function MatchHistorySkeleton() {
  return (
    <div className="min-h-screen bg-[#fbfcfe] w-full">
      <div className="pb-24 pt-8 px-6 max-w-[1400px] mx-auto w-full">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* 左側主內容區 Skeleton */}
          <div className="flex-1 space-y-8 min-w-0">
            <header className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-40 rounded-lg" />
                    <Skeleton className="h-4 w-24 rounded-md" />
                  </div>
                </div>
                <Skeleton className="size-10 rounded-full" />
              </div>

              <div className="space-y-4">
                <Skeleton className="h-12 w-full rounded-2xl" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-24 rounded-full" />
                  <Skeleton className="h-10 w-24 rounded-full" />
                  <Skeleton className="h-10 w-24 rounded-full" />
                </div>
              </div>
            </header>

            <section className="space-y-6">
              <div className="flex items-center gap-4 py-2">
                <Skeleton className="h-4 w-32 rounded-md" />
                <div className="h-px bg-slate-100 flex-1" />
              </div>

              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white p-5 rounded-3xl border border-slate-50 flex items-center gap-4">
                    <Skeleton className="size-12 md:size-20 rounded-2xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between">
                        <Skeleton className="h-5 w-40 rounded-lg" />
                        <Skeleton className="h-4 w-16 rounded-md" />
                      </div>
                      <Skeleton className="h-4 w-24 rounded-md" />
                    </div>
                    <Skeleton className="h-10 w-24 rounded-2xl" />
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* 右側統計欄位 Skeleton */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0 order-first lg:order-last mb-8 lg:mb-0">
            <div className="space-y-6">
              <Skeleton className="h-[400px] w-full rounded-[2.5rem]" />
              <Skeleton className="h-40 w-full rounded-[2.5rem] hidden lg:block" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
