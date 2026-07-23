"use client";

import {
  ChartBarIcon,
  ChatTextIcon,
  ClockCounterClockwiseIcon,
  EnvelopeSimpleIcon,
  KeyIcon,
  ListChecksIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  SquaresFourIcon,
  TagIcon,
  TicketIcon,
  UsersIcon,
  WebhooksLogoIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/common/brand-mark";
import { ADMIN_ROLE } from "@/config/platform";
import { getInitials } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";

interface AgentSidebarProps {
  brandName: string;
  logoUrl: string | null;
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
  { href: "/admin/reports", label: "Reports", icon: ChartBarIcon },
  { href: "/admin/appearance", label: "Appearance", icon: PaintBrushIcon },
  { href: "/admin/ticket-config", label: "Ticket Config", icon: TagIcon },
  {
    href: "/admin/custom-fields",
    label: "Custom Fields",
    icon: ListChecksIcon,
  },
  {
    href: "/admin/email-templates",
    label: "Email Templates",
    icon: EnvelopeSimpleIcon,
  },
  {
    href: "/admin/audit-log",
    label: "Audit Log",
    icon: ClockCounterClockwiseIcon,
  },
  { href: "/admin/api-keys", label: "API Keys", icon: KeyIcon },
  { href: "/admin/webhooks", label: "Webhooks", icon: WebhooksLogoIcon },
];

export function AgentSidebar({
  brandName,
  logoUrl,
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
          <BrandMark
            fallbackIcon={
              <div className="size-7 rounded-md bg-sidebar-accent flex items-center justify-center shrink-0">
                <TicketIcon
                  className="size-4 text-sidebar-accent-foreground"
                  weight="fill"
                />
              </div>
            }
            imgClassName="h-7 w-auto max-w-40 object-contain"
            logoUrl={logoUrl}
            name={brandName}
            textClassName="font-semibold text-sidebar-accent-foreground text-sm"
          />
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

      {/* Agent info — links to the profile page */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <Link
          className="flex items-center gap-2.5 rounded-md bg-sidebar-accent/40 px-2.5 py-2 transition-colors hover:bg-sidebar-accent/70"
          href="/dashboard/profile"
        >
          <div className="size-8 rounded-full bg-sidebar-primary flex items-center justify-center shrink-0">
            <span className="text-2xs font-semibold text-sidebar-primary-foreground">
              {getInitials(userName)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-sidebar-accent-foreground truncate">
              {userName}
            </p>
            <p className="text-2xs text-sidebar-foreground truncate">
              {userEmail}
            </p>
          </div>
          {isAdmin && (
            <ShieldCheckIcon className="size-3.5 text-sidebar-foreground shrink-0" />
          )}
        </Link>
        <SignOutButton />
      </div>
    </aside>
  );
}
