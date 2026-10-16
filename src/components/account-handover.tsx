"use client";

import { useState } from "react";
import { CircleAlertIcon } from "lucide-react";

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
  requestId,
  onProgress,
}: {
  email: string | null;
  requestId: string;
  onProgress: (progress: Progress) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function send() {
    setPending(true);
    setError(undefined);
    try {
      const { ok, result } = await post(
        `/api/review/requests/${encodeURIComponent(requestId)}/handover`,
      );
      if (ok && result.progress) {
        setOpen(false);
        onProgress(result.progress);
      } else setError(result.error ?? "The first-login email could not be sent. Please try again.");
    } catch {
      setError("The first-login email could not be sent. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Alert>
        <CircleAlertIcon />
        <AlertTitle>The first-login email was not sent</AlertTitle>
        <AlertDescription>
          The email with a temporary password could not be sent to the applicant&apos;s contact
          email. Send it again once the cause is resolved.
        </AlertDescription>
      </Alert>
      <Button className="self-start" onClick={() => setOpen(true)} size="sm">
        Send first-login email
      </Button>
      <AlertDialog onOpenChange={(next) => !pending && setOpen(next)} open={open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send the first-login email?</AlertDialogTitle>
            <AlertDialogDescription>
              This sets a new temporary password for {email} and emails it to the applicant&apos;s
              contact email. Any earlier temporary password stops working. It does not show that the
              message was delivered or that the applicant has signed in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={() => void send()}>
              {pending && <Spinner data-icon="inline-start" />}
              Send email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
