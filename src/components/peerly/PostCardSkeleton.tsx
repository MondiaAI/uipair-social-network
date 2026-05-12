import { Skeleton } from "@/components/ui/skeleton";

export function PostCardSkeleton({ withImage = false }: { withImage?: boolean }) {
  return (
    <div className="rounded-xl sm:rounded-2xl border bg-card p-2.5 sm:p-4 shadow-sm space-y-2.5 sm:space-y-3">
      <div className="flex items-start gap-2 sm:gap-3">
        <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5 min-w-0">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full shrink-0" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      {withImage && <Skeleton className="w-full aspect-[4/3] sm:aspect-[16/9] rounded-lg" />}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Skeleton className="h-6 w-10 rounded-full" />
        <Skeleton className="h-6 w-10 rounded-full" />
        <Skeleton className="h-6 w-10 rounded-full" />
        <Skeleton className="ml-auto h-6 w-8 rounded-full" />
      </div>
    </div>
  );
}
