"use client";

import {
  ChatTextIcon,
  ClockCounterClockwiseIcon,
  type Icon,
  PaintBrushIcon,
  SquaresFourIcon,
  TagIcon,
  TicketIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { NotificationBell } from "./notification-bell";

interface RouteMeta {
  description?: string;
  icon?: Icon;
  title: string;
}

const ROUTE_META: Record<string, RouteMeta> = {
  "/dashboard": {
    title: "Dashboard",
    description: "Ticket volume and team activity at a glance.",
    icon: SquaresFourIcon,
  },
  "/tickets": {
    title: "All Tickets",
    description: "Search and manage all support tickets.",
    icon: TicketIcon,
  },
  "/canned-responses": {
    title: "Canned Responses",
    description:
      "Reusable reply templates any agent can insert into a ticket reply.",
    icon: ChatTextIcon,
  },
  "/admin/audit-log": {
    title: "Audit Log",
    description: "A record of account-level and administrative actions.",
    icon: ClockCounterClockwiseIcon,
  },
  "/admin/users": {
    title: "Users",
    description: "Manage agents and admins.",
    icon: UsersIcon,
  },
  "/admin/appearance": {
    title: "Appearance",
    description:
      "Set the color theme and appearance mode for all agents and admins.",
    icon: PaintBrushIcon,
  },
  "/admin/ticket-config": {
    title: "Ticket Configuration",
    description:
      "Manage ticket statuses and categories available to agents and customers.",
    icon: TagIcon,
  },
};

function getMeta(pathname: string): RouteMeta {
  if (ROUTE_META[pathname]) {
    return ROUTE_META[pathname];
  }
  if (pathname.startsWith("/tickets/")) {
    return {
      title: "Ticket Detail",
      description: "View and respond to this ticket.",
      icon: TicketIcon,
    };
  }
  return { title: "" };
}

export function TopBar() {
  const pathname = usePathname();
  const { title, description, icon: Icon } = getMeta(pathname);

  return (
    <div className="h-14 shrink-0 border-b border-border bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <Icon className="size-5 text-foreground shrink-0" />}
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-foreground leading-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="text-xs text-muted-foreground leading-tight truncate">
              {description}
            </p>
          )}
        </div>
      </div>
      <NotificationBell />
    </div>
  );
}
