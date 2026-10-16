import { ReviewRequest } from "@/components/review-request";

export default async function ReviewRequestPage({ params }: PageProps<"/review/[id]">) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-4xl">
      <ReviewRequest id={id} key={id} />
    </div>
  );
}
