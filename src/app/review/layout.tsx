import { ReviewSidebar } from "@/components/review-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { ReactNode } from "react";

export default function ReviewLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <ReviewSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger />
          <Separator className="data-vertical:h-4 data-vertical:self-auto" orientation="vertical" />
          <h1 className="font-heading text-lg font-semibold">Signup Review</h1>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
