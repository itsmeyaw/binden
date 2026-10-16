import Link from "next/link";
import { AlertCircleIcon } from "lucide-react";

import { AuthButton } from "@/components/auth-button";
import { AuthShell } from "@/components/auth-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { error } = await searchParams;

  return (
    <AuthShell>
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>
            Sign in with your PM3 Muenchen Google Workspace account to review signup requests.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error === "sign-in" && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Sign-in failed</AlertTitle>
              <AlertDescription>
                We couldn&apos;t sign you in with Google. Please try again.
              </AlertDescription>
            </Alert>
          )}
          <AuthButton className="w-full" label="Login with Google Workspace" />
          <FieldDescription className="text-center">
            Don&apos;t have an account? <Link href="/sign-up">Request one</Link>
          </FieldDescription>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        Only managed Workspace accounts can sign in.
      </FieldDescription>
    </AuthShell>
  );
}
