import { Skeleton } from "@/components/ui/skeleton";

export function PostCardSkeleton({ withImage = false }: { withImage?: boolean }) {
  return (
    <div className="rounded-xl sm:rounded-2xl border border-t-[3px] bg-card p-2.5 sm:p-4 shadow-sm space-y-2.5 sm:space-y-3">
      {/* Header: avatar + name/handle + type chip */}
      <div className="flex items-start gap-2 sm:gap-3">
        <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-24 sm:w-32" />
            <Skeleton className="h-3 w-16 sm:w-20" />
          </div>
          <Skeleton className="h-2.5 w-2/5" />
        </div>
        <Skeleton className="h-5 w-12 sm:w-16 rounded-full shrink-0" />
      </div>

      {/* Title line */}
      <Skeleton className="h-4 w-4/5" />

      {/* Body content */}
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-3/4" />
      </div>

      {/* Optional image */}
      {withImage && (
        <Skeleton className="w-full aspect-[4/3] sm:aspect-[16/9] rounded-lg" />
      )}

      {/* Tags row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>

      {/* Reactions row */}
      <div className="flex items-center gap-1.5 pt-2 border-t">
        <Skeleton className="h-6 w-9 rounded-full" />
        <Skeleton className="h-6 w-9 rounded-full" />
        <Skeleton className="h-6 w-9 rounded-full" />
        <Skeleton className="h-6 w-9 rounded-full" />
        <Skeleton className="h-6 w-9 rounded-full" />
        <Skeleton className="ml-auto h-6 w-8 rounded-full" />
        <Skeleton className="h-6 w-8 rounded-full" />
      </div>
    </div>
  );
}
