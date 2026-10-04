import { ReviewQueue } from "@/components/review-queue";
import { ReviewRequest } from "@/components/review-request";

export function ReviewWorkspace({ id }: { id?: string }) {
  return (
    <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.6fr)]">
      <ReviewQueue />
      <ReviewRequest id={id} key={id ?? "unselected"} />
    </div>
  );
}
