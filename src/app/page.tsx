import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { FieldDescription } from "@/components/ui/field";

export default function Home() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <section className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-bold">Welcome to PM3 Muenchen e.V.</h1>
          <FieldDescription>
            Don&apos;t have an account? <Link href="/sign-up">Request one</Link>
          </FieldDescription>
        </div>
        <Link className={buttonVariants({ className: "w-full" })} href="/login">
          Login with Google Workspace
        </Link>
      </section>
    </main>
  );
}
