export const mileageCameraConstraints: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: "environment" }, width: { ideal: 1280, max: 1600 }, height: { ideal: 720, max: 1200 }, frameRate: { ideal: 15, max: 15 } },
};
export function photoFrameSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("Aguarde a câmera ficar pronta.");
  const scale = Math.min(1, 1280 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export function stopMileageCamera(stream: Pick<MediaStream,"getTracks"> | null) { stream?.getTracks().forEach(track => track.stop()); }
export async function captureMileageFrame(video: HTMLVideoElement) {
  const size = photoFrameSize(video.videoWidth, video.videoHeight);
  const canvas = document.createElement("canvas");
  canvas.width = size.width; canvas.height = size.height;
  try {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Não foi possível preparar a foto. Use a Galeria.");
    context.drawImage(video, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Não foi possível capturar a foto. Tente novamente.")), "image/jpeg", 0.82));
    return new File([blob], `painel-${Date.now()}.jpg`, { type: "image/jpeg" });
  } finally { canvas.width = 0; canvas.height = 0; }
}
