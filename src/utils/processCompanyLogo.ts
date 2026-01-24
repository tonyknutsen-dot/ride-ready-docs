export type ProcessCompanyLogoResult = {
  processedFile: File;
  previewDataUrl: string;
  inputWidth: number;
  inputHeight: number;
  outputSize: number;
  outputType: string;
};

type ProcessCompanyLogoOptions = {
  minPx?: number;
  outputSize?: number;
  outputType?: "image/png" | "image/webp";
  outputQuality?: number; // Only used for webp
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

async function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = dataUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Failed to export image"));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}

/**
 * Produces a guaranteed-renderable square logo file + preview.
 * - Validates minimum input dimensions (default 200x200)
 * - Fits the image inside a square canvas (no cropping), centered
 * - Exports as PNG (default) so it renders everywhere
 */
export async function processCompanyLogo(
  file: File,
  opts: ProcessCompanyLogoOptions = {},
): Promise<ProcessCompanyLogoResult> {
  const minPx = opts.minPx ?? 200;
  const outputSize = opts.outputSize ?? 512;
  const outputType = opts.outputType ?? "image/png";
  const outputQuality = opts.outputQuality ?? 0.9;

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImageFromDataUrl(dataUrl);

  const inputWidth = img.naturalWidth || img.width;
  const inputHeight = img.naturalHeight || img.height;

  if (inputWidth < minPx || inputHeight < minPx) {
    throw new Error(`Image is ${inputWidth}×${inputHeight}px. Minimum is ${minPx}×${minPx}px.`);
  }

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Fit-inside (contain), centered, no crop
  const scale = Math.min(outputSize / inputWidth, outputSize / inputHeight);
  const drawW = Math.round(inputWidth * scale);
  const drawH = Math.round(inputHeight * scale);
  const dx = Math.round((outputSize - drawW) / 2);
  const dy = Math.round((outputSize - drawH) / 2);

  ctx.clearRect(0, 0, outputSize, outputSize);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, dx, dy, drawW, drawH);

  // Preview as a data URL for maximum reliability (no blob URL lifecycle issues)
  const previewDataUrl = canvas.toDataURL("image/png");

  const blob = await canvasToBlob(
    canvas,
    outputType,
    outputType === "image/webp" ? outputQuality : undefined,
  );

  const ext = outputType === "image/webp" ? "webp" : "png";
  const processedFile = new File([blob], `company-logo.${ext}`, { type: outputType });

  return {
    processedFile,
    previewDataUrl,
    inputWidth,
    inputHeight,
    outputSize,
    outputType,
  };
}
