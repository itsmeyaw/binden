"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, CircleAlertIcon, PencilIcon } from "lucide-react";

import { ReviewAccess, type ReviewOutcome } from "@/components/review-access";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type SignupRequest = {
  id: string;
  givenName: string;
  familyName: string;
  contactEmail: string;
  contactEmailConfirmedByAdmin: boolean;
  phone: string | null;
  connection: string | null;
  status: "verified" | "rejection_pending_notification";
  rejectionReason: string | null;
  createdAt: string;
};

type State =
  | { status: "loading" }
  | { status: "unselected" }
  | { status: "ready"; request: SignupRequest }
  | { status: "missing" }
  | { status: ReviewOutcome };

type Errors = Partial<
  Record<"givenName" | "familyName" | "contactEmail" | "phone" | "connection" | "reason", string>
>;

async function fetchRequest(id: string): Promise<State> {
  try {
    const response = await fetch(`/api/review/requests/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const result = (await response.json()) as {
      outcome?: ReviewOutcome;
      request?: SignupRequest;
    };
    if (response.status === 404) return { status: "missing" };
    if (!response.ok || !result.request) return { status: result.outcome ?? "unavailable" };
    return { status: "ready", request: result.request };
  } catch {
    return { status: "unavailable" };
  }
}

export function ReviewRequest({ id }: { id?: string }) {
  const [state, setState] = useState<State>({ status: id ? "loading" : "unselected" });
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!id) return;
    const requestId = id;
    let active = true;
    void fetchRequest(requestId).then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [id]);

  async function retry() {
    if (!id) return;
    setState({ status: "loading" });
    setState(await fetchRequest(id));
  }

  async function correct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || state.status !== "ready") return;
    setPending(true);
    setErrors({});
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/review/requests/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          givenName: values.get("givenName"),
          familyName: values.get("familyName"),
          contactEmail: values.get("contactEmail"),
          contactEmailConfirmedByAdmin: values.get("contactEmailConfirmedByAdmin") === "on",
          phone: values.get("phone"),
          connection: values.get("connection"),
        }),
      });
      const result = (await response.json()) as { errors?: Errors; request?: SignupRequest };
      if (!response.ok) {
        setErrors(result.errors ?? {});
        return;
      }
      if (result.request) setState({ status: "ready", request: result.request });
      setEditing(false);
    } catch {
      setErrors({ contactEmail: "The correction could not be saved. Please try again." });
    } finally {
      setPending(false);
    }
  }

  async function reject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    setPending(true);
    setErrors({});
    const reason = new FormData(event.currentTarget).get("reason");
    try {
      const response = await fetch(`/api/review/requests/${encodeURIComponent(id)}/rejection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const result = (await response.json()) as { errors?: Errors; outcome?: string };
      if (response.ok) {
        setState({ status: "missing" });
        return;
      }
      if (result.outcome === "rejection-notification-pending" && state.status === "ready") {
        setState({
          status: "ready",
          request: {
            ...state.request,
            status: "rejection_pending_notification",
            rejectionReason: String(reason),
          },
        });
        setRejecting(false);
        return;
      }
      setErrors(
        result.errors ?? { reason: "The request could not be rejected. Please try again." },
      );
    } catch {
      setErrors({ reason: "The request could not be rejected. Please try again." });
    } finally {
      setPending(false);
    }
  }

  async function retryNotification() {
    if (!id || state.status !== "ready") return;
    setPending(true);
    try {
      const response = await fetch(`/api/review/requests/${encodeURIComponent(id)}/rejection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retry: true }),
      });
      if (response.ok) setState({ status: "missing" });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="min-h-0 p-4 lg:overflow-y-auto">
      {id && (
        <Button
          className="mb-4 lg:hidden"
          type="button"
          variant="ghost"
          render={<Link href="/review" />}
        >
          <ArrowLeftIcon /> Back to requests
        </Button>
      )}
      {state.status === "loading" && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner /> Loading request
        </div>
      )}
      {state.status === "unselected" && (
        <p className="text-muted-foreground">Select a signup request to review its details.</p>
      )}
      {state.status === "missing" && (
        <p className="text-muted-foreground">
          This signup request is no longer available for review.
        </p>
      )}
      {state.status === "ready" && (
        <div className="flex flex-col gap-5">
          {state.request.status === "rejection_pending_notification" ? (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Rejection notification needs retrying</AlertTitle>
              <AlertDescription>
                The rejection was recorded, but we could not capture the applicant&apos;s
                notification.
              </AlertDescription>
              <AlertAction>
                <Button
                  disabled={pending}
                  onClick={() => void retryNotification()}
                  size="sm"
                  type="button"
                >
                  {pending && <Spinner data-icon="inline-start" />}
                  Retry notification
                </Button>
              </AlertAction>
            </Alert>
          ) : (
            <>
              <form noValidate onSubmit={correct}>
                <FieldSet disabled={pending || !editing}>
                  <FieldGroup className="sm:grid sm:grid-cols-2">
                    <Field data-invalid={Boolean(errors.givenName)}>
                      <FieldLabel htmlFor="given-name">Given name</FieldLabel>
                      <Input
                        aria-invalid={Boolean(errors.givenName)}
                        defaultValue={state.request.givenName}
                        id="given-name"
                        name="givenName"
                        required
                      />
                      <FieldError>{errors.givenName}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors.familyName)}>
                      <FieldLabel htmlFor="family-name">Family name</FieldLabel>
                      <Input
                        aria-invalid={Boolean(errors.familyName)}
                        defaultValue={state.request.familyName}
                        id="family-name"
                        name="familyName"
                        required
                      />
                      <FieldError>{errors.familyName}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors.contactEmail)}>
                      <FieldLabel htmlFor="contact-email">Contact email</FieldLabel>
                      <Input
                        aria-invalid={Boolean(errors.contactEmail)}
                        defaultValue={state.request.contactEmail}
                        id="contact-email"
                        name="contactEmail"
                        required
                        type="email"
                      />
                      <FieldError>{errors.contactEmail}</FieldError>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="phone">Phone number</FieldLabel>
                      <Input
                        defaultValue={state.request.phone ?? ""}
                        id="phone"
                        name="phone"
                        type="tel"
                      />
                      <FieldError>{errors.phone}</FieldError>
                    </Field>
                    <Field className="sm:col-span-2">
                      <FieldLabel htmlFor="connection">Connection to the nonprofit</FieldLabel>
                      <Textarea
                        defaultValue={state.request.connection ?? ""}
                        id="connection"
                        name="connection"
                      />
                      <FieldError>{errors.connection}</FieldError>
                    </Field>
                    <Field className="sm:col-span-2" orientation="horizontal">
                      <Checkbox
                        defaultChecked={state.request.contactEmailConfirmedByAdmin}
                        disabled={!editing || pending}
                        id="contact-email-confirmed"
                        name="contactEmailConfirmedByAdmin"
                      />
                      <FieldLabel htmlFor="contact-email-confirmed">
                        I confirm this contact email as an administrator.
                      </FieldLabel>
                    </Field>
                  </FieldGroup>
                </FieldSet>
                <div className="mt-5 flex flex-wrap gap-2">
                  {editing ? (
                    <Button disabled={pending} type="submit" variant="outline">
                      {pending && <Spinner data-icon="inline-start" />}
                      <PencilIcon data-icon="inline-start" /> Done
                    </Button>
                  ) : (
                    <Button
                      disabled={pending}
                      onClick={(event) => {
                        // The same DOM button becomes type="submit" before this click's default action runs.
                        event.preventDefault();
                        setEditing(true);
                      }}
                      type="button"
                      variant="outline"
                    >
                      <PencilIcon data-icon="inline-start" /> Correct details
                    </Button>
                  )}
                  {!editing && !rejecting && (
                    <Button onClick={() => setRejecting(true)} type="button" variant="destructive">
                      Reject request
                    </Button>
                  )}
                </div>
              </form>
              {rejecting && <Separator />}
              {rejecting && (
                <form noValidate onSubmit={reject}>
                  <FieldSet disabled={pending}>
                    <FieldGroup>
                      <Field data-invalid={Boolean(errors.reason)}>
                        <FieldLabel htmlFor="rejection-reason">Reason for the applicant</FieldLabel>
                        <Textarea
                          aria-invalid={Boolean(errors.reason)}
                          id="rejection-reason"
                          name="reason"
                          required
                        />
                        <FieldError>{errors.reason}</FieldError>
                      </Field>
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" variant="destructive">
                          {pending && <Spinner data-icon="inline-start" />}Reject and notify
                          applicant
                        </Button>
                        <Button onClick={() => setRejecting(false)} type="button" variant="outline">
                          Cancel
                        </Button>
                      </div>
                    </FieldGroup>
                  </FieldSet>
                </form>
              )}
            </>
          )}
        </div>
      )}
      {state.status !== "loading" &&
        state.status !== "ready" &&
        state.status !== "missing" &&
        state.status !== "unselected" && (
          <ReviewAccess outcome={state.status} retry={() => void retry()} />
        )}
    </section>
  );
}
