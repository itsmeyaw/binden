import { ReviewRequest } from "@/components/review-request";

export default async function ReviewRequestPage({ params }: PageProps<"/review/[id]">) {
  const { id } = await params;
  return (
    <main className="flex flex-1 items-start justify-center bg-muted/40 px-4 py-12 sm:px-6">
      <ReviewRequest id={id} />
    </main>
  );
}
