import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12 sm:px-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Administrator sign in</CardTitle>
          <CardDescription>
            Administrator authentication will use Better Auth and your managed Google Workspace
            account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link className={buttonVariants({ variant: "outline" })} href="/">
            Return home
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
import Link from "next/link";
