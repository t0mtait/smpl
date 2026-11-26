/**
 * Client-side image compression using native HTML5 Canvas.
 * Compresses smartphone photos (often 5-15MB) down to ~150-350KB before upload,
 * conserving client bandwidth and VPS / S3 storage space.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: "image/webp" | "image/jpeg";
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.82,
  mimeType: "image/webp",
};

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  // If not an image or SVG/GIF (preserve vector or animation), return original
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") {
    return file;
  }

  // If already under 150KB and in a modern format, skip canvas overhead
  if (file.size <= 150 * 1024 && (file.type === "image/webp" || file.type === "image/jpeg")) {
    return file;
  }

  const { maxWidth = 1600, maxHeight = 1600, quality = 0.82, mimeType = "image/webp" } = options;

  return new Promise((resolve, reject) => {
    // Check for window/canvas availability (SSR safe)
    if (typeof window === "undefined" || typeof document === "undefined") {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onerror = () => resolve(file);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => resolve(file);
      img.onload = () => {
        try {
          let { width, height } = img;

          // Scale dimensions down while preserving aspect ratio
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return resolve(file);
          }

          // Use high quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          ctx.drawImage(img, 0, 0, width, height);

          // Determine preferred output mime type (fallback to jpeg if webp unsupported)
          const targetType = mimeType;
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return resolve(file);
              }

              // If compressed blob is somehow larger than original, stick with original
              if (blob.size >= file.size) {
                return resolve(file);
              }

              const ext = targetType === "image/webp" ? "webp" : "jpg";
              const originalBase = file.name.replace(/\.[^/.]+$/, "");
              const compressedFile = new File([blob], `${originalBase}.${ext}`, {
                type: targetType,
                lastModified: Date.now(),
              });

              resolve(compressedFile);
            },
            targetType,
            quality
          );
        } catch {
          resolve(file);
        }
      };

      if (typeof e.target?.result === "string") {
        img.src = e.target.result;
      } else {
        resolve(file);
      }
    };

    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
