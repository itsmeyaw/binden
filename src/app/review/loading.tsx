import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Sign up requests</h2>
        <p className="text-muted-foreground">
          Verified requests ready for an administrator&apos;s review.
        </p>
      </div>
      <div className="grid min-h-0 flex-1 divide-y overflow-hidden rounded-lg border bg-card lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.6fr)] lg:divide-x lg:divide-y-0">
        <div className="flex items-center gap-2 p-4 text-muted-foreground">
          <Spinner /> Loading requests
        </div>
        <div />
      </div>
    </div>
  );
}
