"use client";

import { useState } from "react";
import { CircleAlertIcon, RotateCwIcon } from "lucide-react";

import { roleLabels, type Role } from "@/components/group-membership-picker";
import type { Progress } from "@/components/review-progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

type Group = Progress["groups"][number];
type Recovery = { requestId: string; onProgress: (progress: Progress) => void };

async function post(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = (await response.json().catch(() => ({}))) as {
    progress?: Progress;
    error?: string;
    errors?: Record<string, string>;
  };
  return { ok: response.ok, result };
}

export function RetryProvisioning({ requestId, onProgress }: Recovery) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function retry() {
    setPending(true);
    setError(undefined);
    try {
      const { ok, result } = await post(
        `/api/review/requests/${encodeURIComponent(requestId)}/provisioning`,
      );
      if (ok && result.progress) onProgress(result.progress);
      else setError(result.error ?? "The retry could not be completed. Please try again.");
    } catch {
      setError("The retry could not be completed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button className="self-start" disabled={pending} onClick={() => void retry()} size="sm">
        {pending ? <Spinner data-icon="inline-start" /> : <RotateCwIcon data-icon="inline-start" />}
        Retry unfinished memberships
      </Button>
      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

const none = "none";

export function ReviseAssignment({
  group,
  choices,
  requestId,
  onProgress,
}: Recovery & { group: Group; choices: Progress["choices"] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [replacement, setReplacement] = useState(none);
  const [role, setRole] = useState<Role>("member");

  const options: Record<string, string> = Object.fromEntries([
    [none, "Remove without replacement"],
    ...choices.map((choice) => [choice.id, `${choice.name} (${choice.email})`]),
  ]);

  async function revise() {
    setPending(true);
    setError(undefined);
    try {
      const { ok, result } = await post(
        `/api/review/requests/${encodeURIComponent(requestId)}/provisioning/revisions`,
        {
          groupId: group.groupId,
          replacement: replacement === none ? undefined : { id: replacement, role },
          confirmed: true,
        },
      );
      if (ok && result.progress) {
        setOpen(false);
        onProgress(result.progress);
      } else {
        setError(
          result.errors?.replacement ??
            result.error ??
            "The revision could not be saved. Please try again.",
        );
      }
    } catch {
      setError("The revision could not be saved. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="xs" variant="outline">
        Remove or replace
      </Button>
      <AlertDialog onOpenChange={(next) => !pending && setOpen(next)} open={open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revise {group.groupEmail}?</AlertDialogTitle>
            <AlertDialogDescription>
              This unfinished assignment will be removed from the selected memberships. Memberships
              that already succeeded are kept. The revision is recorded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`replacement-${group.groupId}`}>Replacement group</FieldLabel>
              <Select
                items={options}
                onValueChange={(value) => value && setReplacement(value)}
                value={replacement}
              >
                <SelectTrigger id={`replacement-${group.groupId}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(options).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {replacement !== none && (
              <Field>
                <FieldLabel htmlFor={`replacement-role-${group.groupId}`}>Role</FieldLabel>
                <Select
                  items={roleLabels}
                  onValueChange={(value) => value && setRole(value as Role)}
                  value={role}
                >
                  <SelectTrigger id={`replacement-role-${group.groupId}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}
          </FieldGroup>
          {error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={() => void revise()}>
              {pending && <Spinner data-icon="inline-start" />}
              Confirm revision
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
