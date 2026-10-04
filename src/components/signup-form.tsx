"use client";

import { useRef, useState } from "react";
import { CheckCircle2Icon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  TurnstileChallenge,
  type TurnstileChallengeHandle,
  turnstileConfigured,
} from "@/components/turnstile-challenge";
import { parseSignupInput, type SignupErrors } from "@/lib/signup";

type Fields = {
  givenName: string;
  familyName: string;
  contactEmail: string;
  phone: string;
  connection: string;
};

type Errors = SignupErrors;

const initialFields: Fields = {
  givenName: "",
  familyName: "",
  contactEmail: "",
  phone: "",
  connection: "",
};

export function SignupForm() {
  const [fields, setFields] = useState(initialFields);
  const [errors, setErrors] = useState<Errors>({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string>();
  const challenge = useRef<TurnstileChallengeHandle>(null);

  function updateField(name: keyof Fields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function validate() {
    return parseSignupInput({ ...fields, turnstileToken }).errors ?? {};
  }

  function resetChallenge() {
    challenge.current?.reset();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setPending(true);
    setNotice(undefined);
    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, turnstileToken }),
      });
      const result = (await response.json()) as {
        error?: string;
        errors?: Errors;
        message?: string;
      };
      if (!response.ok) {
        setErrors(result.errors ?? {});
        setNotice(result.error);
        if (response.status !== 422) resetChallenge();
        return;
      }
      setNotice(result.message);
      setErrors({});
    } catch {
      setNotice("We could not submit your request. Please try again.");
      resetChallenge();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Request a Workspace account</CardTitle>
        <CardDescription>
          Tell us how to contact you. We will send a verification link before your request is
          reviewed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {notice && (
          <Alert className="mb-6" variant={notice.startsWith("Your") ? "default" : "destructive"}>
            {notice.startsWith("Your") ? <CheckCircle2Icon /> : <TriangleAlertIcon />}
            <AlertTitle>
              {notice.startsWith("Your") ? "Request received" : "Unable to submit"}
            </AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        <form noValidate onSubmit={submit}>
          <FieldSet disabled={pending}>
            <FieldGroup>
              <Field data-invalid={Boolean(errors.givenName)}>
                <FieldLabel htmlFor="given-name">Given name</FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.givenName)}
                  aria-describedby={errors.givenName ? "given-name-error" : undefined}
                  autoComplete="given-name"
                  id="given-name"
                  onChange={(event) => updateField("givenName", event.target.value)}
                  required
                  value={fields.givenName}
                />
                <FieldError id="given-name-error">{errors.givenName}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.familyName)}>
                <FieldLabel htmlFor="family-name">Family name</FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.familyName)}
                  aria-describedby={errors.familyName ? "family-name-error" : undefined}
                  autoComplete="family-name"
                  id="family-name"
                  onChange={(event) => updateField("familyName", event.target.value)}
                  required
                  value={fields.familyName}
                />
                <FieldError id="family-name-error">{errors.familyName}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.contactEmail)}>
                <FieldLabel htmlFor="contact-email">Contact email</FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.contactEmail)}
                  aria-describedby={errors.contactEmail ? "contact-email-error" : undefined}
                  autoComplete="email"
                  id="contact-email"
                  inputMode="email"
                  onChange={(event) => updateField("contactEmail", event.target.value)}
                  required
                  type="email"
                  value={fields.contactEmail}
                />
                <FieldError id="contact-email-error">{errors.contactEmail}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.phone)}>
                <FieldLabel htmlFor="phone">
                  Phone number <span className="font-normal text-muted-foreground">(optional)</span>
                </FieldLabel>
                <Input
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                  autoComplete="tel"
                  id="phone"
                  onChange={(event) => updateField("phone", event.target.value)}
                  type="tel"
                  value={fields.phone}
                />
                <FieldError id="phone-error">{errors.phone}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.connection)}>
                <FieldLabel htmlFor="connection">
                  Connection to the nonprofit{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </FieldLabel>
                <Textarea
                  aria-invalid={Boolean(errors.connection)}
                  aria-describedby={errors.connection ? "connection-error" : undefined}
                  id="connection"
                  onChange={(event) => updateField("connection", event.target.value)}
                  value={fields.connection}
                />
                <FieldError id="connection-error">{errors.connection}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.turnstileToken)}>
                <FieldLabel>Verification</FieldLabel>
                <TurnstileChallenge action="signup" onToken={setTurnstileToken} ref={challenge} />
                <FieldError id="turnstile-error">{errors.turnstileToken}</FieldError>
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field>
                <Button className="w-full" disabled={pending || !turnstileConfigured} type="submit">
                  {pending && <Spinner data-icon="inline-start" />}
                  {pending ? "Submitting request" : "Submit request"}
                </Button>
              </Field>
            </FieldGroup>
          </FieldSet>
        </form>
      </CardContent>
    </Card>
  );
}
