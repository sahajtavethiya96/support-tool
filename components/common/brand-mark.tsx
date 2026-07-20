import type { ReactNode } from "react";

interface BrandMarkProps {
  /** Classes for the <img> when a logo is configured. */
  imgClassName?: string;
  logoUrl: string | null;
  name: string;
  /** Icon/initials badge shown when no logo is configured — layout (size,
   * color, rounding) is the caller's own markup, this component just decides
   * whether to render it. */
  fallbackIcon?: ReactNode;
  /** Classes for the name text, only rendered alongside `fallbackIcon`. */
  textClassName?: string;
}

/**
 * A logo image when one's configured, replacing the icon-badge + name text
 * entirely (mirrors lib/email/components/layout.tsx's EmailLayout, which
 * makes the same swap for emails) — an uploaded logo usually already
 * contains a wordmark, so showing the text name alongside it would double up.
 */
export function BrandMark({
  name,
  logoUrl,
  fallbackIcon,
  textClassName,
  imgClassName,
}: BrandMarkProps) {
  if (logoUrl) {
    return <img alt={name} className={imgClassName} src={logoUrl} />;
  }
  return (
    <>
      {fallbackIcon}
      <span className={textClassName}>{name}</span>
    </>
  );
}
