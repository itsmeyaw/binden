import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12 sm:px-6">
      <section className="flex w-full max-w-xl flex-col gap-8">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-primary">Nonprofit Workspace</p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight">
            Get started with your account.
          </h1>
          <p className="text-lg text-muted-foreground">
            Request a Workspace account, or sign in to continue managing an existing request.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link className={buttonVariants({ size: "lg" })} href="/login">
            Sign in
          </Link>
          <Link className={buttonVariants({ variant: "outline", size: "lg" })} href="/sign-up">
            Request an account
          </Link>
        </div>
      </section>
    </main>
  );
}
