"use client";

// -----------------------------------------------------------------------------
// Client-side image preparation: downscale large phone photos and re-encode as
// JPEG so the base64 payload stays small enough for localStorage (~5 MB cap) and
// for Gemini (fewer tokens, lower latency). Shared by the page upload and the
// "attach a photo of your work" answer flow.
// -----------------------------------------------------------------------------

const MAX_DIMENSION = 1600; // plenty for OCR; keeps the upload well under limits.

/** Read a File as a base64 data URL. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function stripPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

/**
 * Downscale a photo (if large) and re-encode as JPEG so the base64 payload stays
 * comfortably under storage/request limits. Falls back to the original file's
 * bytes if the browser can't decode/encode the image (e.g. a PDF).
 */
export async function prepareImage(
  file: File
): Promise<{ base64: string; mimeType: string }> {
  const dataUrl = await readFileAsDataUrl(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = dataUrl;
    });

    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas context");
    ctx.drawImage(img, 0, 0, width, height);

    // ~0.7 quality keeps the base64 small enough for localStorage (~5 MB cap)
    // while staying legible for OCR and figure reading.
    const jpeg = canvas.toDataURL("image/jpeg", 0.7);
    return { base64: stripPrefix(jpeg), mimeType: "image/jpeg" };
  } catch {
    return {
      base64: stripPrefix(dataUrl),
      mimeType: file.type || "image/jpeg",
    };
  }
}
