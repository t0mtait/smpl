import fs from "node:fs";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { UPLOAD_DIR } from "./db";

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
  const safeFilename = path.basename(filename);

  if (isS3Configured) {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: safeFilename,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return safeFilename;
  }

  // Fallback to local filesystem
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const localPath = path.join(UPLOAD_DIR, safeFilename);
  fs.writeFileSync(localPath, buffer);
  return safeFilename;
}

/**
 * Retrieves a file's binary data and content type from object storage or local filesystem.
 */
export async function getFile(filename: string): Promise<{ buffer: Buffer; contentType?: string } | null> {
  const safeFilename = path.basename(filename);

  if (isS3Configured) {
    try {
      const client = getS3Client();
      const res = await client.send(
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: safeFilename,
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
      const localPath = path.join(UPLOAD_DIR, safeFilename);
      if (fs.existsSync(localPath)) {
        return { buffer: fs.readFileSync(localPath) };
      }
      return null;
    }
  }

  // Local filesystem
  const localPath = path.join(UPLOAD_DIR, safeFilename);
  if (!fs.existsSync(localPath)) {
    return null;
  }
  return { buffer: fs.readFileSync(localPath) };
}

/**
 * Deletes a file from storage. Non-fatal if missing.
 */
export async function deleteFile(filename: string): Promise<void> {
  const safeFilename = path.basename(filename);

  if (isS3Configured) {
    try {
      const client = getS3Client();
      await client.send(
        new DeleteObjectCommand({
          Bucket: S3_BUCKET,
          Key: safeFilename,
        })
      );
    } catch {
      // non-fatal
    }
  }

  // Check and delete local file as well if present
  const localPath = path.join(UPLOAD_DIR, safeFilename);
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
    return `${base}/${encodeURIComponent(path.basename(filename))}`;
  }
  return null;
}
