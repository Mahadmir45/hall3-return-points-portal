import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const useLocal = process.env.USE_LOCAL_STORAGE === "true" || !process.env.S3_ENDPOINT;
const localDir = join(process.cwd(), "uploads");

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION ?? "us-east-1";
export const bucket = process.env.S3_BUCKET ?? "hall3-uploads";

export const s3Client = useLocal
  ? null
  : new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
      },
    });

export function buildStorageKey(
  hallSlug: string,
  kind: string,
  filename: string,
): string {
  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
  return `${hallSlug}/${kind}/${randomUUID()}.${ext}`;
}

function localPath(storageKey: string) {
  return join(localDir, storageKey);
}

export async function saveLocalFile(storageKey: string, buffer: Buffer) {
  const path = localPath(storageKey);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, buffer);
}

export async function getPresignedUploadUrl(
  storageKey: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  if (useLocal) {
    return `/api/local-upload?key=${encodeURIComponent(storageKey)}&contentType=${encodeURIComponent(contentType)}`;
  }
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client!, command, { expiresIn });
}

export async function getPresignedDownloadUrl(
  storageKey: string,
  expiresIn = 3600,
): Promise<string> {
  if (useLocal) {
    return `/api/local-download?key=${encodeURIComponent(storageKey)}`;
  }
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });
  return getSignedUrl(s3Client!, command, { expiresIn });
}

export async function getObjectBuffer(storageKey: string): Promise<Buffer> {
  if (useLocal) {
    const path = localPath(storageKey);
    if (!existsSync(path)) throw new Error(`Local file not found: ${storageKey}`);
    return readFileSync(path);
  }
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });
  const response = await s3Client!.send(command);
  const stream = response.Body;
  if (!stream) throw new Error("Empty object body");

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export { bucket as s3Bucket };
