"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
  icon?: ReactNode;
  title: string;
  titleClassName?: string;
}

/** Collapsible card used by the ticket detail sidebar sections. */
export function SidebarCard({
  title,
  icon,
  children,
  defaultOpen = true,
  className,
  contentClassName,
  titleClassName,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      className={cn(
        "bg-card rounded-xl border border-border shadow-soft overflow-hidden",
        className
      )}
      onOpenChange={setOpen}
      open={open}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-4 text-left cursor-pointer">
        <h3
          className={cn(
            "text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5",
            titleClassName
          )}
        >
          {icon}
          {title}
        </h3>
        <CaretDownIcon
          className={cn(
            "size-3.5 text-muted-foreground shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          "px-4 pb-4 data-[state=closed]:animate-none",
          contentClassName
        )}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
