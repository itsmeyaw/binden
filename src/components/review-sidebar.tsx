"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheckIcon } from "lucide-react";

import { AuthButton } from "@/components/auth-button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export function ReviewSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <span className="px-2 font-heading text-lg font-semibold group-data-[collapsible=icon]:hidden">
          PM3 Muenchen
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/review")}
                  render={<Link href="/review" />}
                  tooltip="Signup Review"
                >
                  <ClipboardCheckIcon />
                  <span>Signup Review</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <AuthButton action="sign-out" className="w-full" />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
