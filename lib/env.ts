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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.issues);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
