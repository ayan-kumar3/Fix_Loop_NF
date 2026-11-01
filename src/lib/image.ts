// Client-side image helpers. Uses browser-only APIs (FileReader, canvas), so
// only call these from client components. Compressing/downscaling before
// upload keeps payload sizes small enough for server actions and storage.

export const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB source cap

export interface ImageValidation {
  ok: boolean;
  error?: string;
}

export function validateImageFile(file: File): ImageValidation {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { ok: false, error: "Unsupported format. Use JPG, JPEG, PNG or WEBP." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "Image is too large (max 8MB)." };
  }
  return { ok: true };
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export interface CompressedImage {
  dataUrl: string;
  base64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
}

/**
 * Downscale and re-encode an image to JPEG to minimise size while keeping it
 * clear enough for AI analysis and previews.
 */
export async function compressImage(
  dataUrl: string,
  { maxDim = 1280, quality = 0.82 } = {}
): Promise<CompressedImage> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const mimeType = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,/i)?.[1]?.toLowerCase();
    if (mimeType !== "image/jpeg" && mimeType !== "image/png" && mimeType !== "image/webp") {
      throw new Error("Could not determine the photo format.");
    }
    return {
      dataUrl,
      base64: dataUrl.split(",")[1] ?? "",
      mimeType,
      width: img.width,
      height: img.height,
    };
  }
  ctx.drawImage(img, 0, 0, width, height);

  const out = canvas.toDataURL("image/jpeg", quality);
  const base64 = out.split(",")[1] ?? "";
  return { dataUrl: out, base64, mimeType: "image/jpeg", width, height };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image."));
    img.src = src;
  });
}
