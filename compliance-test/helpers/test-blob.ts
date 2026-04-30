import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { sha256Hex } from "./crypto.ts";
import { randomBytes } from "./crypto.ts";
import { join } from "path";

let logoImage: Awaited<ReturnType<typeof loadImage>> | null = null;

async function getLogo() {
  if (logoImage) return logoImage;
  try {
    logoImage = await loadImage(join(import.meta.dir, "..", "blossom-logo.svg"));
  } catch {
    logoImage = null;
  }
  return logoImage;
}

export interface TestBlob {
  data: Uint8Array;
  sha256: string;
  size: number;
  type: string;
  ext: string;
}

let imageCounter = 0;

export async function generateTestImage(serverUrl: string): Promise<TestBlob> {
  imageCounter++;
  const width = 800;
  const height = 400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#1a1a2e");
  gradient.addColorStop(1, "#16213e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const rng = randomBytes(16);
  const hue1 = (rng[0] / 255) * 360;
  const hue2 = (rng[1] / 255) * 360;
  const hue3 = (rng[2] / 255) * 360;
  const uid = Array.from(rng).map((b) => b.toString(16).padStart(2, "0")).join("");

  for (let i = 0; i < 5; i++) {
    const cx = rng[(i * 2 + 3) % 16] / 255 * width;
    const cy = rng[(i * 2 + 4) % 16] / 255 * height;
    const r = 20 + rng[(i + 5) % 16] / 255 * 60;
    const hue = (rng[(i + 8) % 16] / 255) * 360;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.25)`;
    ctx.fill();
  }

  const barY = 150;
  const barH = 8;
  for (let x = 30; x < 770; x += 6) {
    const hue = hue1 + (x / 770) * 120;
    ctx.fillStyle = `hsl(${hue}, 80%, 55%)`;
    const h = barH + rng[x % 16] / 255 * 6;
    ctx.fillRect(x, barY - h / 2, 4, h);
  }

  ctx.fillStyle = `hsl(${hue2}, 60%, 70%)`;
  ctx.fillRect(30, 155 + barH, 740, 2);

  const logo = await getLogo();
  if (logo) {
    ctx.drawImage(logo, 30, 30, 120, 120);
  }

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText("Blossom Compliance Test", logo ? 170 : 30, 80);

  ctx.fillStyle = `hsl(${hue3}, 70%, 75%)`;
  ctx.font = "bold 48px monospace";
  ctx.fillText(`#${imageCounter}`, logo ? 170 : 30, 130);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "20px sans-serif";
  ctx.fillText(`Server: ${serverUrl}`, 30, 195);

  const ts = new Date().toISOString();
  ctx.fillStyle = "#94a3b8";
  ctx.font = "16px monospace";
  ctx.fillText(`Timestamp: ${ts}`, 30, 225);
  ctx.fillText(`UID: ${uid}`, 30, 250);

  ctx.fillStyle = "#22c55e";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("This image was uploaded by the Blossom compliance test suite", 30, 320);
  ctx.fillStyle = "#64748b";
  ctx.font = "14px sans-serif";
  ctx.fillText("It can be safely deleted at any time", 30, 350);

  for (let i = 0; i < 3; i++) {
    const sx = rng[(i * 3 + 10) % 16] / 255 * 700 + 50;
    const sy = 260 + rng[(i * 3 + 11) % 16] / 255 * 40;
    ctx.fillStyle = `hsla(${(hue1 + i * 40) % 360}, 60%, 50%, 0.4)`;
    ctx.fillRect(sx, sy, rng[(i * 3 + 12) % 16] / 255 * 60 + 20, 3);
  }

  const pngData = canvas.toBuffer("image/png");
  const sha256 = await sha256Hex(pngData);

  return {
    data: new Uint8Array(pngData),
    sha256,
    size: pngData.byteLength,
    type: "image/png",
    ext: "png",
  };
}
