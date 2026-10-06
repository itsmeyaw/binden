"use client";

import { useState } from "react";
import { CircleAlertIcon, ExternalLinkIcon } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { post } from "@/components/provisioning-recovery";
import type { Progress } from "@/components/review-progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function AccountHandover({
  email,
  googleUserId,
  requestId,
  onProgress,
}: {
  email: string | null;
  googleUserId: string | null;
  requestId: string;
  onProgress: (progress: Progress) => void;
}) {
  const adminEmail = authClient.useSession().data?.user.email;
  // Opens the user's own page; falls back to the list when the id is unknown.
  const adminUrl = new URL(
    googleUserId
      ? `https://admin.google.com/ac/users/${encodeURIComponent(googleUserId)}`
      : "https://admin.google.com/ac/users",
  );
  if (adminEmail) adminUrl.searchParams.set("authuser", adminEmail);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setPending(true);
    setError(undefined);
    try {
      const { ok, result } = await post(
        `/api/review/requests/${encodeURIComponent(requestId)}/handover`,
      );
      if (ok && result.progress) {
        setOpen(false);
        onProgress(result.progress);
      } else setError(result.error ?? "The handover could not be confirmed. Please try again.");
    } catch {
      setError("The handover could not be confirmed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Alert>
        <CircleAlertIcon />
        <AlertTitle>Send first-login instructions in the Admin console</AlertTitle>
        <AlertDescription>
          <ol className="list-decimal pl-4">
            <li>
              Open the{" "}
              <a
                className="inline-flex items-center gap-1 underline"
                href={adminUrl.href}
                rel="noreferrer"
                target="_blank"
              >
                Admin console user page <ExternalLinkIcon className="size-3" />
              </a>{" "}
              for {email}.
            </li>
            <li>Choose Reset password and require a password change at next sign-in.</li>
            <li>Choose the option to email the instructions to the applicant.</li>
            <li>Return here and confirm. The application never sends or stores the password.</li>
          </ol>
        </AlertDescription>
      </Alert>
      <Button className="self-start" onClick={() => setOpen(true)} size="sm">
        Confirm instructions were sent
      </Button>
      <AlertDialog onOpenChange={(next) => !pending && setOpen(next)} open={open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm the instructions were sent?</AlertDialogTitle>
            <AlertDialogDescription>
              This records that first-login instructions were sent for {email}. It does not show
              that the message was delivered or that the applicant has signed in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={() => void confirm()}>
              {pending && <Spinner data-icon="inline-start" />}
              Confirm handover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
