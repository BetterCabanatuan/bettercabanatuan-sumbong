"use client";

import { LogOut, Settings } from "lucide-react";
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
import { type NavItem, SETTINGS, WORK } from "@/components/volunteer/nav";
import type { Permission } from "@/lib/types";

export function VolunteerSidebar({
  displayName,
  roleName,
  permissions,
  pending,
}: {
  displayName: string;
  roleName: string;
  permissions: Permission[];
  pending: number;
}) {
  const pathname = usePathname();
  const allowed = (item: NavItem) => !item.permission || permissions.includes(item.permission);
  const work = WORK.filter(allowed);
  const settings = SETTINGS.filter(allowed);
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
              {work.map((item) => (
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
        {settings.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <Settings className="mr-1" /> Settings
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {settings.map((item) => (
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
          <span className="text-xs text-muted-foreground">{roleName}</span>
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
