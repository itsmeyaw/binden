"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2Icon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { parseResendInput, type ResendErrors } from "@/lib/verification";

type Turnstile = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

type Outcome = "loading" | "verified" | "used" | "expired" | "invalid" | "error";

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function VerificationForm({ token }: { token?: string }) {
  const [outcome, setOutcome] = useState<Outcome>(token ? "loading" : "invalid");
  const [showResend, setShowResend] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [errors, setErrors] = useState<ResendErrors>({});
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const challenge = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

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

  useEffect(() => {
    if (!showResend || !siteKey || !challenge.current) return;

    const render = () => {
      if (!challenge.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(challenge.current, {
        sitekey: siteKey,
        action: "resend",
        theme: "light",
        callback: (value: string) => setTurnstileToken(value),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken(""),
      });
    };

    const script = document.getElementById("turnstile-script") as HTMLScriptElement | null;
    if (script) {
      script.addEventListener("load", render);
      render();
      return () => script.removeEventListener("load", render);
    }

    const nextScript = document.createElement("script");
    nextScript.id = "turnstile-script";
    nextScript.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    nextScript.async = true;
    nextScript.addEventListener("load", render);
    document.head.append(nextScript);
    return () => nextScript.removeEventListener("load", render);
  }, [showResend]);

  function resetChallenge() {
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
    setTurnstileToken("");
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
  const canResend = outcome === "expired" || outcome === "invalid";

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
                  {siteKey ? (
                    <div ref={challenge} />
                  ) : (
                    <FieldDescription>Verification is not configured yet.</FieldDescription>
                  )}
                  <FieldError id="resend-turnstile-error">{errors.turnstileToken}</FieldError>
                </Field>
                <Field>
                  <Button className="w-full" disabled={pending || !siteKey} type="submit">
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
