import Link from "next/link";
import { UsersRoundIcon } from "lucide-react";

import { cn } from "cn";

export function AuthShell({
  children,
  className = "max-w-sm",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className={cn("flex w-full flex-col gap-6", className)}>
        <Link href="/" className="flex items-center gap-2 self-center font-heading font-medium">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <UsersRoundIcon className="size-4" />
          </span>
          PM3 Muenchen e.V.
        </Link>
        {children}
      </div>
    </main>
  );
}
