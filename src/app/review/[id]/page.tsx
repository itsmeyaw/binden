import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { ReviewRequest } from "@/components/review-request";
import { Button } from "@/components/ui/button";

export default async function ReviewRequestPage({ params }: PageProps<"/review/[id]">) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="p-4">
        <Button
          className="mb-4"
          nativeButton={false}
          variant="ghost"
          render={<Link href="/review" />}
        >
          <ArrowLeftIcon /> Back to requests
        </Button>
      </div>
      <ReviewRequest id={id} key={id} />
    </div>
  );
}
