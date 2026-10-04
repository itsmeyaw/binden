import { ReviewWorkspace } from "@/components/review-workspace";

export default async function ReviewRequestPage({ params }: PageProps<"/review/[id]">) {
  const { id } = await params;
  return <ReviewWorkspace id={id} />;
}
