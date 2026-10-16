import Link from "next/link";

import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "@/components/signup-form";
import { FieldDescription } from "@/components/ui/field";

export default function SignUpPage() {
  return (
    <AuthShell className="max-w-md">
      <SignupForm />
      <FieldDescription className="text-center">
        Already have an account? <Link href="/">Sign in</Link>
      </FieldDescription>
    </AuthShell>
  );
}
