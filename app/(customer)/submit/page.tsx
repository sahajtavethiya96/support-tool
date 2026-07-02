"use client";

import {
  ArrowLeftIcon,
  LifebuoyIcon,
  LockSimpleIcon,
  PaperclipIcon,
  TicketIcon,
  XIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SearchableSelect } from "@/components/common/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT_NAME } from "@/config/platform";

const CATEGORIES = [
  { value: "bug", label: "Bug" },
  { value: "issue", label: "Issue" },
  { value: "feature_request", label: "Feature Request" },
  { value: "billing", label: "Billing" },
  { value: "general_query", label: "General Query" },
] as const;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/zip",
  "text/plain",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;

interface FormErrors {
  attachments?: string;
  category?: string;
  description?: string;
  email?: string;
  general?: string;
  name?: string;
  subject?: string;
}

export default function SubmitPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (!name.trim() || name.trim().length < 2 || name.trim().length > 100) {
      e.name = "Name must be 2–100 characters.";
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = "Please enter a valid email address.";
    }
    if (
      !subject.trim() ||
      subject.trim().length < 5 ||
      subject.trim().length > 200
    ) {
      e.subject = "Subject must be 5–200 characters.";
    }
    if (
      !description.trim() ||
      description.trim().length < 10 ||
      description.trim().length > 5000
    ) {
      e.description = "Description must be 10–5000 characters.";
    }
    if (!category) {
      e.category = "Please select a category.";
    }
    return e;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const combined = [...files, ...selected];

    if (combined.length > MAX_FILES) {
      setErrors((prev) => ({
        ...prev,
        attachments: `Maximum ${MAX_FILES} files allowed.`,
      }));
      return;
    }
    const oversized = combined.find((f) => f.size > MAX_FILE_SIZE);
    if (oversized) {
      setErrors((prev) => ({
        ...prev,
        attachments: `${oversized.name} exceeds 10 MB.`,
      }));
      return;
    }
    const badType = combined.find((f) => !ALLOWED_TYPES.includes(f.type));
    if (badType) {
      setErrors((prev) => ({
        ...prev,
        attachments: `${badType.name} is not an allowed file type.`,
      }));
      return;
    }
    setFiles(combined);
    setErrors((prev) => ({ ...prev, attachments: undefined }));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => ({ ...prev, attachments: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const body = new FormData();
      body.append("name", name.trim());
      body.append("email", email.trim());
      body.append("subject", subject.trim());
      body.append("description", description.trim());
      body.append("category", category);
      files.forEach((f) => body.append("attachments", f));

      const res = await fetch("/api/tickets", { method: "POST", body });
      const data = (await res.json()) as {
        ticketNumber?: number;
        error?: string;
      };

      if (!res.ok) {
        setErrors({
          general: data.error ?? "Something went wrong. Please try again.",
        });
        return;
      }

      router.push(
        `/submit/success?ticket=${data.ticketNumber}&email=${encodeURIComponent(email.trim())}`
      );
    } catch {
      setErrors({ general: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-public flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-sand sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link className="flex items-center gap-2 sm:gap-2.5 min-w-0" href="/">
            <div className="size-7 rounded-md bg-bark flex items-center justify-center shrink-0">
              <TicketIcon className="size-4 text-cream" weight="fill" />
            </div>
            <span className="font-semibold text-bark text-sm truncate">
              {PRODUCT_NAME}
            </span>
          </Link>
          <Link
            className="text-sm text-stone hover:text-bark transition-colors shrink-0"
            href="/my-tickets"
          >
            My Tickets
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Back link */}
        <Link
          className="inline-flex items-center gap-1.5 text-sm text-stone hover:text-bark transition-colors mb-6"
          href="/"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to home
        </Link>

        {/* Intro */}
        <div className="flex items-start gap-3.5 mb-8">
          <div className="size-11 rounded-xl bg-cream flex items-center justify-center shrink-0">
            <LifebuoyIcon className="size-5 text-bark" weight="duotone" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-bark leading-tight">
              Submit a support ticket
            </h1>
            <p className="text-sm text-stone mt-1">
              Describe your issue and we&apos;ll get back to you as soon as
              possible.
            </p>
          </div>
        </div>

        <form noValidate onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl border border-sand shadow-soft shadow-sm p-6 sm:p-8 space-y-5">
            {/* Name + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-bark text-sm font-medium" htmlFor="name">
                  Full Name <span className="text-red-600">*</span>
                </Label>
                <Input
                  className=""
                  disabled={submitting}
                  id="name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  value={name}
                />
                {errors.name && (
                  <p className="text-xs text-red-600">{errors.name}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  className="text-bark text-sm font-medium"
                  htmlFor="email"
                >
                  Email Address <span className="text-red-600">*</span>
                </Label>
                <Input
                  className=""
                  disabled={submitting}
                  id="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  type="email"
                  value={email}
                />
                {errors.email && (
                  <p className="text-xs text-red-600">{errors.email}</p>
                )}
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <Label
                className="text-bark text-sm font-medium"
                htmlFor="subject"
              >
                Subject <span className="text-red-600">*</span>
              </Label>
              <Input
                className=""
                disabled={submitting}
                id="subject"
                maxLength={200}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your issue"
                value={subject}
              />
              <div className="flex justify-between">
                {errors.subject ? (
                  <p className="text-xs text-red-600">{errors.subject}</p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-stone">{subject.length}/200</span>
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-bark text-sm font-medium">
                Category <span className="text-red-600">*</span>
              </Label>
              <SearchableSelect
                disabled={submitting}
                onValueChange={setCategory}
                options={CATEGORIES.map((c) => ({
                  value: c.value,
                  label: c.label,
                }))}
                placeholder="Select a category"
                searchPlaceholder="Search category…"
                triggerClassName="h-11 w-full"
                value={category}
              />
              {errors.category && (
                <p className="text-xs text-red-600">{errors.category}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label
                className="text-bark text-sm font-medium"
                htmlFor="description"
              >
                Description <span className="text-red-600">*</span>
              </Label>
              <Textarea
                className="resize-none"
                disabled={submitting}
                id="description"
                maxLength={5000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe your issue in detail…"
                rows={5}
                value={description}
              />
              <div className="flex justify-between">
                {errors.description ? (
                  <p className="text-xs text-red-600">{errors.description}</p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-stone">
                  {description.length}/5000
                </span>
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label className="text-bark text-sm font-medium">
                Attachments{" "}
                <span className="text-stone font-normal">(optional)</span>
              </Label>

              {files.length > 0 && (
                <ul className="space-y-1">
                  {files.map((f, i) => (
                    <li
                      className="flex items-center gap-2 rounded-md bg-cream border border-sand px-3 py-2 text-sm"
                      key={i}
                    >
                      <PaperclipIcon className="size-3.5 text-stone shrink-0" />
                      <span className="text-bark truncate flex-1">
                        {f.name}
                      </span>
                      <span className="text-stone shrink-0">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        className="text-stone hover:text-bark ml-1"
                        onClick={() => removeFile(i)}
                        type="button"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {files.length < MAX_FILES && (
                <label className="flex items-center gap-2 text-sm text-stone hover:text-bark cursor-pointer w-fit">
                  <PaperclipIcon className="size-4" />
                  <span>Attach files</span>
                  <input
                    accept=".jpg,.jpeg,.png,.pdf,.zip,.txt"
                    className="sr-only"
                    disabled={submitting}
                    multiple
                    onChange={handleFileChange}
                    type="file"
                  />
                </label>
              )}
              <p className="text-xs text-stone">
                Up to {MAX_FILES} files — JPG, PNG, PDF, ZIP, TXT — max 10 MB
                each.
              </p>
              {errors.attachments && (
                <p className="text-xs text-red-600">{errors.attachments}</p>
              )}
            </div>
          </div>

          {errors.general && (
            <p className="mt-4 text-sm text-red-600 text-center">
              {errors.general}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="flex items-center gap-1.5 text-xs text-stone">
              <LockSimpleIcon className="size-3.5 shrink-0" />
              Your details are kept private and only used to respond to your
              ticket.
            </p>
            <Button
              className="bg-bark hover:bg-bark/90 text-white rounded-md w-full sm:w-auto sm:min-w-40"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Submitting…" : "Submit Ticket"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
