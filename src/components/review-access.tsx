import Link from "next/link";
import { CircleAlertIcon, RefreshCwIcon } from "lucide-react";

import { AuthButton } from "@/components/auth-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";

export type ReviewOutcome = "signed-out" | "denied" | "reconnect" | "unavailable";

const details: Record<ReviewOutcome, { title: string; message: string }> = {
  "signed-out": {
    title: "Sign in required",
    message: "Sign in with your managed Google Workspace account to review requests.",
  },
  denied: {
    title: "Review access denied",
    message: "Your Workspace role does not permit reviewing signup requests.",
  },
  reconnect: {
    title: "Reconnect your Google account",
    message: "Google rejected your connection or it has expired. Reconnect your managed account.",
  },
  unavailable: {
    title: "Workspace access unavailable",
    message: "Google Workspace could not confirm your current profile. Try again shortly.",
  },
};

export function ReviewAccess({ outcome, retry }: { outcome: ReviewOutcome; retry?: () => void }) {
  const detail = details[outcome];
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>{detail.title}</AlertTitle>
      <AlertDescription>{detail.message}</AlertDescription>
      <div className="mt-4 flex flex-wrap gap-2">
        {outcome === "signed-out" && (
          <Link className={buttonVariants({ size: "sm" })} href="/login">
            Sign in
          </Link>
        )}
        {outcome === "reconnect" && <AuthButton action="reconnect" />}
        {outcome === "unavailable" && retry && (
          <Button onClick={retry} size="sm" type="button" variant="outline">
            <RefreshCwIcon /> Try again
          </Button>
        )}
      </div>
    </Alert>
  );
}
