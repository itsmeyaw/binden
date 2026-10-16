import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Sign up requests</h2>
        <p className="text-muted-foreground">
          Verified requests ready for an administrator&apos;s review.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
