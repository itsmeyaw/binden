"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2Icon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  TurnstileChallenge,
  type TurnstileChallengeHandle,
  turnstileConfigured,
} from "@/components/turnstile-challenge";
import { parseResendInput, type ResendErrors } from "@/lib/verification";

type Outcome = "loading" | "verified" | "used" | "expired" | "invalid" | "error";

export function VerificationForm({ token }: { token?: string }) {
  const [outcome, setOutcome] = useState<Outcome>(token ? "loading" : "invalid");
  const [showResend, setShowResend] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [errors, setErrors] = useState<ResendErrors>({});
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const challenge = useRef<TurnstileChallengeHandle>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/verify?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = (await response.json()) as { outcome: Outcome };
        setOutcome(result.outcome);
      })
      .catch(() => setOutcome("error"));
  }, [token]);

  function resetChallenge() {
    challenge.current?.reset();
  }

  async function resend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseResendInput({ contactEmail, turnstileToken });
    if (!parsed.data) {
      setErrors(parsed.errors);
      return;
    }

    setPending(true);
    setNotice(undefined);
    try {
      const response = await fetch("/api/verify/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = (await response.json()) as {
        error?: string;
        errors?: ResendErrors;
        message?: string;
      };
      if (!response.ok) {
        setErrors(result.errors ?? {});
        setNotice(result.error);
        if (response.status !== 422) resetChallenge();
        return;
      }
      setErrors({});
      setNotice(result.message);
      resetChallenge();
    } catch {
      setNotice("We could not send a verification email. Please try again.");
      resetChallenge();
    } finally {
      setPending(false);
    }
  }

  const details: Record<
    Exclude<Outcome, "loading">,
    { title: string; message: string; success?: boolean }
  > = {
    verified: {
      title: "Email verified",
      message: "Your signup request is ready for review.",
      success: true,
    },
    used: {
      title: "Email already verified",
      message: "Your signup request is already ready for review.",
      success: true,
    },
    expired: {
      title: "Verification link expired",
      message: "Signup requests must be verified within 24 hours of submission.",
    },
    invalid: {
      title: "Verification link is invalid",
      message: "Check that you opened the complete link from your verification email.",
    },
    error: {
      title: "Unable to verify email",
      message: "Verification is temporarily unavailable. Please try again.",
    },
  };
  const detail = outcome === "loading" ? undefined : details[outcome];
  const canResend = outcome === "invalid";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Verify your contact email</CardTitle>
        <CardDescription>
          Verification makes your Workspace signup request ready for review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {outcome === "loading" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Verifying your email
          </div>
        ) : (
          detail && (
            <Alert variant={detail.success ? "default" : "destructive"}>
              {detail.success ? <CheckCircle2Icon /> : <TriangleAlertIcon />}
              <AlertTitle>{detail.title}</AlertTitle>
              <AlertDescription>{detail.message}</AlertDescription>
            </Alert>
          )
        )}

        {canResend && !showResend && (
          <Button className="mt-6 w-full" onClick={() => setShowResend(true)} type="button">
            Send a replacement link
          </Button>
        )}

        {outcome === "expired" && (
          <Link className={buttonVariants({ className: "mt-6 w-full" })} href="/sign-up">
            Start a new signup request
          </Link>
        )}

        {showResend && (
          <form className="mt-6" noValidate onSubmit={resend}>
            <FieldSet disabled={pending}>
              <FieldGroup>
                {notice && (
                  <Alert variant={notice.startsWith("If an") ? "default" : "destructive"}>
                    {notice.startsWith("If an") ? <CheckCircle2Icon /> : <TriangleAlertIcon />}
                    <AlertTitle>
                      {notice.startsWith("If an")
                        ? "Verification email requested"
                        : "Unable to send email"}
                    </AlertTitle>
                    <AlertDescription>{notice}</AlertDescription>
                  </Alert>
                )}
                <Field data-invalid={Boolean(errors.contactEmail)}>
                  <FieldLabel htmlFor="resend-contact-email">Contact email</FieldLabel>
                  <Input
                    aria-describedby={
                      errors.contactEmail ? "resend-contact-email-error" : undefined
                    }
                    aria-invalid={Boolean(errors.contactEmail)}
                    autoComplete="email"
                    id="resend-contact-email"
                    inputMode="email"
                    onChange={(event) => {
                      setContactEmail(event.target.value);
                      setErrors((current) => ({ ...current, contactEmail: undefined }));
                    }}
                    required
                    type="email"
                    value={contactEmail}
                  />
                  <FieldError id="resend-contact-email-error">{errors.contactEmail}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.turnstileToken)}>
                  <FieldLabel>Verification</FieldLabel>
                  <TurnstileChallenge action="resend" onToken={setTurnstileToken} ref={challenge} />
                  <FieldError id="resend-turnstile-error">{errors.turnstileToken}</FieldError>
                </Field>
                <Field>
                  <Button
                    className="w-full"
                    disabled={pending || !turnstileConfigured}
                    type="submit"
                  >
                    {pending && <Spinner data-icon="inline-start" />}
                    {pending ? "Sending verification email" : "Send verification email"}
                  </Button>
                </Field>
              </FieldGroup>
            </FieldSet>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
