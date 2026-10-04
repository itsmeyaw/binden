import { ReviewQueue } from "@/components/review-queue";

export default function ReviewPage() {
  return (
    <main className="flex flex-1 items-start justify-center bg-muted/40 px-4 py-12 sm:px-6">
      <ReviewQueue />
    </main>
  );
}
