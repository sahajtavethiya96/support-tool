"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/common/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_NAME } from "@/config/platform";
import { getInitials } from "@/lib/utils";

interface Props {
  initialBrandName: string | null;
  initialLogoUrl: string | null;
}

export function BrandingSettingsForm({
  initialBrandName,
  initialLogoUrl,
}: Props) {
  const [brandName, setBrandName] = useState(initialBrandName ?? "");
  const [savedBrandName, setSavedBrandName] = useState(initialBrandName ?? "");
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayName = brandName.trim() || PRODUCT_NAME;

  async function saveBrandName() {
    if (brandName === savedBrandName) {
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName: brandName.trim() || null }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save.");
        return;
      }
      setSavedBrandName(brandName);
      toast.success("Brand name saved.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSavingName(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/admin/settings/logo", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        logoUrl?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to upload logo.");
        return;
      }
      setLogoUrl(data.logoUrl ?? null);
      toast.success("Logo uploaded.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function removeLogo() {
    setUploading(true);
    try {
      const res = await fetch("/api/admin/settings/logo", {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to remove logo.");
        return;
      }
      setLogoUrl(null);
      toast.success("Logo removed.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium text-foreground">Branding</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Shown in the sidebar, emails, and browser tab instead of "
          {PRODUCT_NAME}".
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="brand-name">Brand name</Label>
        <Input
          disabled={savingName}
          id="brand-name"
          onBlur={saveBrandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder={PRODUCT_NAME}
          value={brandName}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Logo</Label>
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-border bg-accent/40 overflow-hidden">
            <BrandMark
              fallbackIcon={
                <span className="text-sm font-semibold text-muted-foreground">
                  {getInitials(displayName)}
                </span>
              }
              imgClassName="max-h-12 max-w-12 object-contain"
              logoUrl={logoUrl}
              name={displayName}
              textClassName="sr-only"
            />
          </div>
          <div className="flex gap-2">
            <Button
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              {logoUrl ? "Replace" : "Upload"}
            </Button>
            {logoUrl && (
              <Button
                className="border-red-200 text-red-600 hover:bg-red-50"
                disabled={uploading}
                onClick={removeLogo}
                size="sm"
                type="button"
                variant="outline"
              >
                Remove
              </Button>
            )}
          </div>
          <input
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={handleFileSelect}
            ref={fileInputRef}
            type="file"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPEG, SVG, or WebP — up to 2 MB.
        </p>
      </div>
    </div>
  );
}
