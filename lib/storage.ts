import fs from "node:fs/promises";
import path from "node:path";
import type { Files } from "files-sdk";
import { env } from "@/lib/env";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

// ── Local filesystem driver — the default, and the only one with no setup.
// Unchanged from before the multi-driver switch existed; every other
// self-hosted deployment that hasn't opted into S3/R2 keeps this exact
// behavior. MUST be a persistent volume in Docker or a redeploy wipes
// uploads — see docker-compose.yml and docs/file-uploads.md.
const fsDriver = {
  async upload(key: string, buffer: Buffer): Promise<void> {
    const dest = path.join(UPLOADS_DIR, ...key.split("/"));
    await ensureDir(path.dirname(dest));
    await fs.writeFile(dest, buffer);
  },
  async download(key: string): Promise<Buffer> {
    const src = path.join(UPLOADS_DIR, ...key.split("/"));
    return fs.readFile(src);
  },
  async delete(key: string): Promise<void> {
    const target = path.join(UPLOADS_DIR, ...key.split("/"));
    await fs.unlink(target).catch(() => undefined);
  },
};

// ── Cloud drivers (s3 / r2), via files-sdk (https://files-sdk.dev).
// Lazily constructed via dynamic import so the local-disk (default) path
// never pulls in files-sdk or the AWS SDK — no added cold-start cost for
// deployments that don't use them. Cached after first build since
// `STORAGE_DRIVER` never changes at runtime.
let cloudFilesPromise: Promise<Files> | null = null;

function buildCloudFiles(): Promise<Files> {
  if (env.STORAGE_DRIVER === "s3") {
    return (async () => {
      const [{ Files: FilesCtor }, { s3 }] = await Promise.all([
        import("files-sdk"),
        import("files-sdk/s3"),
      ]);
      return new FilesCtor({
        adapter: s3({
          // Presence already enforced in lib/env.ts when STORAGE_DRIVER=s3.
          bucket: env.S3_BUCKET as string,
          region: env.S3_REGION,
          publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
          // credentials: omitted on purpose — the adapter falls back to the
          // standard AWS chain (env vars, IAM role, shared profile).
        }),
      });
    })();
  }
  // env.STORAGE_DRIVER === "r2" (the only remaining branch; "local" never
  // reaches this function — see the driver switch below).
  return (async () => {
    const [{ Files: FilesCtor }, { r2 }] = await Promise.all([
      import("files-sdk"),
      import("files-sdk/r2"),
    ]);
    return new FilesCtor({
      adapter: r2({
        bucket: env.R2_BUCKET as string,
        accountId: env.R2_ACCOUNT_ID as string,
        // accessKeyId/secretAccessKey: omitted on purpose — the adapter
        // reads R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY directly.
        publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
      }),
    });
  })();
}

function getCloudFiles(): Promise<Files> {
  cloudFilesPromise ??= buildCloudFiles();
  return cloudFilesPromise;
}

export const storage = {
  /**
   * Store a file. Key format: `tickets/{ticketId}/{uuid}/{filename}`
   * Returns the key (never a full URL).
   */
  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    if (env.STORAGE_DRIVER === "local") {
      await fsDriver.upload(key, buffer);
      return;
    }
    const files = await getCloudFiles();
    await files.upload(key, buffer, { contentType: mimeType });
  },

  /** Read a file as a Buffer. */
  async download(key: string): Promise<Buffer> {
    if (env.STORAGE_DRIVER === "local") {
      return fsDriver.download(key);
    }
    const files = await getCloudFiles();
    const file = await files.download(key);
    return Buffer.from(await file.arrayBuffer());
  },

  /** Delete a file. Does not throw if the file does not exist. */
  async delete(key: string): Promise<void> {
    if (env.STORAGE_DRIVER === "local") {
      await fsDriver.delete(key);
      return;
    }
    const files = await getCloudFiles();
    await files.delete(key).catch(() => undefined);
  },

  /**
   * Return the URL to serve the file from. Always our own proxy route,
   * regardless of driver — deliberately NOT a direct/signed cloud URL:
   *   - keeps this synchronous, since callers build it inline
   *     (e.g. `items.map(a => ({ url: storage.url(a.storageKey) }))`)
   *     rather than awaiting per attachment;
   *   - keeps ticket-attachment access control in our own route rather
   *     than handing out cloud URLs (signed or public) directly.
   * `/api/files/[...key]` calls `storage.download()` under the hood, which
   * already supports every driver.
   */
  url(key: string): string {
    return `/api/files/${key}`;
  },
};
