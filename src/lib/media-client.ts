export interface WatermarkMeta {
  fullName: string;
  employeeCode: string;
  timestampText: string;
  distanceMeters: number;
  insideRadius: boolean;
  lat: number;
  lng: number;
  actionLabel: "MASUK" | "PULANG";
}

export function captureWatermarkedSelfie(
  video: HTMLVideoElement,
  meta: WatermarkMeta
): string {
  const sourceWidth = video.videoWidth || 640;
  const sourceHeight = video.videoHeight || 480;
  const targetWidth = Math.min(640, sourceWidth);
  const targetHeight = Math.round((sourceHeight / sourceWidth) * targetWidth);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas browser tidak tersedia untuk mengambil foto.");
  }

  // Mirror selfie horizontally so captured face matches live camera preview.
  ctx.save();
  ctx.translate(targetWidth, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
  ctx.restore();

  // Paint anti-tamper watermark bar on the bottom edge.
  const barHeight = Math.max(66, Math.round(targetHeight * 0.16));
  const yStart = targetHeight - barHeight;
  ctx.fillStyle = "rgba(22, 26, 22, 0.78)";
  ctx.fillRect(0, yStart, targetWidth, barHeight);

  const padX = 14;
  const radiusStatus = meta.insideRadius ? "Dalam Radius" : "Luar Radius";
  ctx.fillStyle = "#F6FAF6";
  ctx.font = "600 13px sans-serif";
  ctx.fillText(
    `${meta.actionLabel} | ${meta.fullName} (${meta.employeeCode})`,
    padX,
    yStart + 21
  );

  ctx.fillStyle = "#D4E8D4";
  ctx.font = "500 11.5px sans-serif";
  ctx.fillText(
    `${meta.timestampText} | Jarak: ${meta.distanceMeters} m (${radiusStatus})`,
    padX,
    yStart + 39
  );
  ctx.fillText(
    `GPS: ${meta.lat.toFixed(6)}, ${meta.lng.toFixed(6)}`,
    padX,
    yStart + 55
  );

  // Target ~40-75 KB JPEG so Neon storage remains compact.
  let quality = 0.72;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > 110_000 && quality > 0.45) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  return dataUrl;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Gagal membaca file."));
    };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("File gambar rusak atau tidak didukung."));
    img.src = src;
  });
}

export async function compressAttachmentFile(file: File): Promise<{
  name: string;
  mime: string;
  dataUrl: string;
}> {
  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");

  if (!isPdf && !isImage) {
    throw new Error("Lampiran harus berupa gambar (JPG/PNG/WebP) atau dokumen PDF.");
  }

  if (isPdf) {
    if (file.size > 1_000_000) {
      throw new Error("Ukuran file PDF maksimal 1 MB agar penyimpanan tetap ringan.");
    }
    const dataUrl = await readFileAsDataUrl(file);
    return { name: file.name, mime: file.type, dataUrl };
  }

  if (file.size > 10_000_000) {
    throw new Error("Ukuran file gambar terlalu besar (maksimal 10 MB sebelum kompresi).");
  }

  const rawUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawUrl);
  const maxWidth = 1100;
  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas browser tidak tersedia.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let quality = 0.78;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > 350_000 && quality > 0.45) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  return {
    name: file.name,
    mime: "image/jpeg",
    dataUrl,
  };
}

export async function compressLogoOrAvatar(
  file: File,
  maxSize = 320,
  preservePng = false
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar (PNG/JPG/WebP).");
  }
  const rawUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawUrl);
  const scale = Math.max(img.width, img.height) > maxSize
    ? maxSize / Math.max(img.width, img.height)
    : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas browser tidak tersedia.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  if (preservePng && file.type === "image/png") {
    const pngUrl = canvas.toDataURL("image/png");
    if (pngUrl.length <= 220_000) return pngUrl;
  }
  return canvas.toDataURL("image/jpeg", 0.82);
}
