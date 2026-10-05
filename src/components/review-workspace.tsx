import { ReviewQueue } from "@/components/review-queue";
import { ReviewRequest } from "@/components/review-request";

export function ReviewWorkspace({ id }: { id?: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Sign up requests</h2>
        <p className="text-muted-foreground">
          Verified requests ready for an administrator&apos;s review.
        </p>
      </div>
      <div className="grid min-h-0 flex-1 divide-y rounded-lg border bg-card lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.6fr)] lg:divide-x lg:divide-y-0 lg:overflow-hidden">
        <div className={id ? "hidden lg:block" : undefined}>
          <ReviewQueue />
        </div>
        <div className={id ? undefined : "hidden lg:block"}>
          <ReviewRequest id={id} key={id ?? "unselected"} />
        </div>
      </div>
    </div>
  );
}
