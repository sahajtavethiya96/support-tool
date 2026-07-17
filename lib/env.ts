import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_SECRET: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.preprocess(
    (v) => (v ? Number(v) : undefined),
    z.number().optional()
  ),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  EMAIL_FROM: optionalString,
  EMAIL_WEBHOOK_SECRET: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  // Pusher Beams (optional) — browser/OS push for agent notifications.
  NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID: optionalString,
  PUSHER_BEAMS_SECRET_KEY: optionalString,
  // Pusher Channels (optional) — real-time ticket list + live ticket detail
  // updates. A different Pusher product from Beams above (pub/sub, not push).
  PUSHER_APP_ID: optionalString,
  NEXT_PUBLIC_PUSHER_KEY: optionalString,
  PUSHER_SECRET: optionalString,
  NEXT_PUBLIC_PUSHER_CLUSTER: optionalString,
  // File storage driver — see lib/storage.ts and docs/file-uploads.md.
  // "local" (default) needs no other vars: files go to ./uploads, which MUST
  // be a persistent volume in Docker (see docker-compose.yml). Preprocessed
  // like optionalString above — an empty-string value (e.g. a blank
  // `STORAGE_DRIVER=` line) must fall back to the default, not fail
  // validation, same as every other optional var in this file.
  STORAGE_DRIVER: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["local", "s3", "r2"]).default("local")
  ),
  // s3 driver — credentials come from the standard AWS chain (env vars, IAM
  // role, shared profile), not from a var here.
  S3_BUCKET: optionalString,
  S3_REGION: optionalString,
  // r2 driver — accessKeyId/secretAccessKey are read directly from the
  // R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY names below by the files-sdk r2
  // adapter itself (not renamed here) — see lib/storage.ts.
  R2_BUCKET: optionalString,
  R2_ACCOUNT_ID: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  // Optional for either cloud driver: a CDN/public domain bound to the
  // bucket. When set, served URLs skip signing. Unset is fine — Support
  // Tool always proxies file reads through /api/files/[...key] rather than
  // handing out cloud URLs directly, so this only matters if you also want
  // to point external tooling at the bucket yourself.
  STORAGE_PUBLIC_BASE_URL: optionalString,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.issues);
  throw new Error("Invalid environment variables");
}

if (parsed.data.STORAGE_DRIVER === "s3" && !parsed.data.S3_BUCKET) {
  throw new Error("STORAGE_DRIVER=s3 requires S3_BUCKET to be set.");
}
if (
  parsed.data.STORAGE_DRIVER === "r2" &&
  !(parsed.data.R2_BUCKET && parsed.data.R2_ACCOUNT_ID)
) {
  throw new Error(
    "STORAGE_DRIVER=r2 requires R2_BUCKET and R2_ACCOUNT_ID to be set."
  );
}

export const env = parsed.data;
