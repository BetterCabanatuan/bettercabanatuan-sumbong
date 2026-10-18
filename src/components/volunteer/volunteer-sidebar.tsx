"use client";

import { ClipboardCheck, FileText, LayoutDashboard, LogOut, Mail, Settings, Tags, Building2, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const WORK = [
  { href: "/v", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/v/review", label: "Review", icon: ClipboardCheck, badge: "pending" as const },
  { href: "/v/reports", label: "Reports", icon: FileText },
  { href: "/v/digests", label: "Digests", icon: Mail },
];

const SETTINGS = [
  { href: "/v/settings/categories", label: "Categories", icon: Tags },
  { href: "/v/settings/offices", label: "Responsible Offices", icon: Building2 },
  { href: "/v/settings/volunteers", label: "Volunteers", icon: Users },
];

export function VolunteerSidebar({
  displayName,
  role,
  pending,
}: {
  displayName: string;
  role: "volunteer" | "coordinator";
  pending: number;
}) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/v" className="flex items-center gap-2.5 px-2 py-1.5 text-navy">
          <BrandMark />
          <span className="flex flex-col leading-tight">
            <span className="font-semibold">Sumbong</span>
            <span className="text-xs text-muted-foreground">Volunteer console</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Work</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {WORK.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton isActive={isActive(item.href, item.exact)} render={<Link href={item.href} />}>
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.badge && pending > 0 && <SidebarMenuBadge>{pending}</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {role === "coordinator" && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <Settings className="mr-1" /> Coordinator
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {SETTINGS.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton isActive={isActive(item.href)} render={<Link href={item.href} />}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-0.5 px-2 text-sm">
          <span className="font-medium">{displayName}</span>
          <span className="text-xs text-muted-foreground capitalize">{role}</span>
        </div>
        <form action="/auth/signout" method="post">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<button type="submit" />}>
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
