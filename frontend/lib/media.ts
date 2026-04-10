const FALLBACK_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

const bucket = process.env.NEXT_PUBLIC_MINIO_BUCKET ?? "images";
const minioBaseUrl =
  process.env.NEXT_PUBLIC_MINIO_URL ?? "http://localhost:9000";

function buildEncodedUrl(objectKey?: string | null) {
  if (!objectKey) {
    return null;
  }

  const sanitizedBase = minioBaseUrl.endsWith("/")
    ? minioBaseUrl.slice(0, -1)
    : minioBaseUrl;

  const encodedKey = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${sanitizedBase}/${bucket}/${encodedKey}`;
}

export function resolveMediaUrl(
  url?: string | null,
  objectKey?: string | null,
) {
  const fallback = buildEncodedUrl(objectKey);

  if (url?.includes("X-Amz-Signature=")) {
    return url;
  }

  return fallback ?? url;
}

export function getFallbackImageUrl() {
  return FALLBACK_DATA_URL;
}
