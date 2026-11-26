import fs from "node:fs";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { UPLOAD_DIR, getDb } from "./db.ts";

// Cloudflare R2 / S3 Configuration from environment
const S3_ENDPOINT = process.env.R2_ENDPOINT || process.env.S3_ENDPOINT;
const S3_REGION = process.env.R2_REGION || process.env.S3_REGION || "auto";
const S3_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
const S3_BUCKET = process.env.R2_BUCKET || process.env.S3_BUCKET;
const S3_PUBLIC_URL = process.env.R2_PUBLIC_URL || process.env.S3_PUBLIC_URL; // Optional CDN or public URL

export const isS3Configured = Boolean(
  S3_ENDPOINT && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY && S3_BUCKET
);

export function getStorageConfig() {
  return {
    isConfigured: isS3Configured,
    bucket: S3_BUCKET || null,
    endpoint: S3_ENDPOINT || null,
    region: S3_REGION || null,
    hasPublicUrl: Boolean(S3_PUBLIC_URL),
  };
}

let s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID!,
        secretAccessKey: S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

function normalizeKey(filename: string): string {
  return filename.replace(/\\/g, "/").replace(/^\/+/, "");
}

function resolveLocalPath(filename: string): string {
  const clean = normalizeKey(filename);
  const safeRelPath = path.normalize(clean).replace(/^(\.\.[\/\\])+/, "");
  return path.join(UPLOAD_DIR, safeRelPath);
}

export interface PutFileOptions {
  filename: string;
  buffer: Buffer | Uint8Array;
  contentType: string;
}

/**
 * Saves a file to object storage (Cloudflare R2 / S3) if configured,
 * otherwise persists it to the local UPLOAD_DIR on disk.
 */
export async function saveFile({ filename, buffer, contentType }: PutFileOptions): Promise<string> {
  const key = normalizeKey(filename);

  if (isS3Configured) {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return key;
  }

  // Fallback to local filesystem
  const localPath = resolveLocalPath(filename);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, buffer);
  return key;
}

/**
 * Retrieves a file's binary data and content type from object storage or local filesystem.
 */
export async function getFile(filename: string): Promise<{ buffer: Buffer; contentType?: string } | null> {
  const key = normalizeKey(filename);

  if (isS3Configured) {
    try {
      const client = getS3Client();
      const res = await client.send(
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
        })
      );
      if (!res.Body) return null;
      const byteArray = await res.Body.transformToByteArray();
      return {
        buffer: Buffer.from(byteArray),
        contentType: res.ContentType,
      };
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "NoSuchKey") {
        return null;
      }
      // If S3 fetch fails, also attempt local fallback in case file was stored before migration
      const localPath = resolveLocalPath(filename);
      if (fs.existsSync(localPath)) {
        return { buffer: fs.readFileSync(localPath) };
      }
      return null;
    }
  }

  // Local filesystem
  const localPath = resolveLocalPath(filename);
  if (!fs.existsSync(localPath)) {
    return null;
  }
  return { buffer: fs.readFileSync(localPath) };
}

/**
 * Deletes a file from storage. Non-fatal if missing.
 */
export async function deleteFile(filename: string): Promise<void> {
  const key = normalizeKey(filename);

  if (isS3Configured) {
    try {
      const client = getS3Client();
      await client.send(
        new DeleteObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
        })
      );
    } catch {
      // non-fatal
    }
  }

  // Check and delete local file as well if present
  const localPath = resolveLocalPath(filename);
  if (fs.existsSync(localPath)) {
    try {
      fs.unlinkSync(localPath);
    } catch {
      // non-fatal
    }
  }
}

/**
 * Returns a public CDN or serving URL if configured, otherwise null.
 */
export function getPublicUrl(filename: string): string | null {
  if (S3_PUBLIC_URL) {
    const base = S3_PUBLIC_URL.replace(/\/$/, "");
    const key = normalizeKey(filename);
    return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
  return null;
}

export interface CleanupResult {
  scanned: number;
  deleted: number;
  freedBytes: number;
  errors: number;
}

/**
 * Scans storage for orphaned photos that are no longer referenced by any
 * item or user avatar in the database, and deletes them to reclaim disk space.
 */
export async function cleanupOrphanedPhotos(): Promise<CleanupResult> {
  const d = getDb();
  const itemPhotos = d
    .prepare("SELECT photo_path FROM items WHERE photo_path IS NOT NULL")
    .all() as { photo_path: string }[];
  const userAvatars = d
    .prepare("SELECT avatar_path FROM users WHERE avatar_path IS NOT NULL")
    .all() as { avatar_path: string }[];

  const activeBasenames = new Set<string>();
  for (const row of itemPhotos) {
    if (row.photo_path) activeBasenames.add(path.basename(row.photo_path));
  }
  for (const row of userAvatars) {
    if (row.avatar_path) activeBasenames.add(path.basename(row.avatar_path));
  }

  let scanned = 0;
  let deleted = 0;
  let freedBytes = 0;
  let errors = 0;

  if (fs.existsSync(UPLOAD_DIR)) {
    const files = fs.readdirSync(UPLOAD_DIR);
    for (const f of files) {
      if (f.startsWith(".")) continue;
      scanned++;
      if (!activeBasenames.has(f)) {
        try {
          const filePath = path.join(UPLOAD_DIR, f);
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            freedBytes += stat.size;
            fs.unlinkSync(filePath);
            deleted++;
          }
        } catch {
          errors++;
        }
      }
    }
  }

  return { scanned, deleted, freedBytes, errors };
}

