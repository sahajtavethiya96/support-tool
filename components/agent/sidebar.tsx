"use client";

import {
  ChatTextIcon,
  ClockCounterClockwiseIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  SquaresFourIcon,
  TagIcon,
  TicketIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_ROLE, PRODUCT_NAME } from "@/config/platform";
import { SignOutButton } from "./sign-out-button";

interface AgentSidebarProps {
  userEmail: string;
  userName: string;
  userRole: string;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: SquaresFourIcon },
  { href: "/tickets", label: "All Tickets", icon: TicketIcon },
  { href: "/canned-responses", label: "Canned Responses", icon: ChatTextIcon },
];

const adminItems = [
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/appearance", label: "Appearance", icon: PaintBrushIcon },
  { href: "/admin/ticket-config", label: "Ticket Config", icon: TagIcon },
  {
    href: "/admin/audit-log",
    label: "Audit Log",
    icon: ClockCounterClockwiseIcon,
  },
];

export function AgentSidebar({
  userName,
  userEmail,
  userRole,
}: AgentSidebarProps) {
  const pathname = usePathname();
  const isAdmin = userRole === ADMIN_ROLE;

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="w-60 bg-sidebar h-full flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-sidebar-border">
        <Link className="flex items-center gap-2.5" href="/tickets">
          <div className="size-7 rounded-md bg-sidebar-accent flex items-center justify-center">
            <TicketIcon
              className="size-4 text-sidebar-accent-foreground"
              weight="fill"
            />
          </div>
          <span className="font-semibold text-sidebar-accent-foreground text-sm">
            {PRODUCT_NAME}
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            className={
              isActive(href)
                ? "flex items-center gap-3 px-3 py-2 text-sm font-medium text-white bg-sidebar-accent rounded-md border-l-2 border-sidebar-primary"
                : "flex items-center gap-3 px-3 py-2 text-sm text-white rounded-md hover:bg-sidebar-accent transition-colors"
            }
            href={href}
            key={href}
          >
            <Icon
              className="size-4 shrink-0"
              weight={isActive(href) ? "fill" : "regular"}
            />
            {label}
          </Link>
        ))}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-2xs font-medium text-sidebar-foreground/70 uppercase tracking-wider">
                Admin
              </span>
            </div>
            {adminItems.map(({ href, label, icon: Icon }) => (
              <Link
                className={
                  isActive(href)
                    ? "flex items-center gap-3 px-3 py-2 text-sm font-medium text-white bg-sidebar-accent rounded-md border-l-2 border-sidebar-primary"
                    : "flex items-center gap-3 px-3 py-2 text-sm text-white rounded-md hover:bg-sidebar-accent transition-colors"
                }
                href={href}
                key={href}
              >
                <Icon
                  className="size-4 shrink-0"
                  weight={isActive(href) ? "fill" : "regular"}
                />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Agent info */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="size-7 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
            <span className="text-2xs font-semibold text-sidebar-accent-foreground">
              {userName.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-sidebar-accent-foreground truncate">
              {userName}
            </p>
            <p className="text-2xs text-sidebar-foreground truncate">
              {userEmail}
            </p>
          </div>
          {isAdmin && (
            <ShieldCheckIcon className="size-3.5 text-sidebar-foreground shrink-0 ml-auto" />
          )}
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
