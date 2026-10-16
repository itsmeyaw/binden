import { ReviewQueue } from "@/components/review-queue";

export default function ReviewPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Sign up requests</h2>
        <p className="text-muted-foreground">
          Verified requests ready for an administrator&apos;s review.
        </p>
      </div>
      <ReviewQueue />
    </div>
  );
}
