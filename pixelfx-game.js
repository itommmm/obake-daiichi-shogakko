// おばけ第一小学校： pixelfx independent transparent overlay. License in vendor/pixelfx.
import { createFrame, clearFrame, createFx, composite } from "./vendor/pixelfx/core/index.js";
import * as hit from "./vendor/pixelfx/fx/impacts/hit-spark.js";
import * as poof from "./vendor/pixelfx/fx/spawn/poof.js";
import * as pickup from "./vendor/pixelfx/fx/pickups/collect-burst.js";

const modules = { hit, poof, pickup };
const palettes = {
  hit: ["#0c1d37","#15477b","#246ca6","#329ccf","#5fe3ff","#b8f6ff","#ffffff"],
  poof: ["#211039","#493074","#7e58ac","#b497d9","#e4d9f5","#ffffff"],
  pickup: ["#130c31","#36205e","#65318d","#9e4bc0","#d66be8","#f4a5ff","#ffdcff","#ffffff"]
};
const overlay = document.createElement("canvas");
overlay.id = "pixelfx-overlay";
overlay.setAttribute("aria-hidden", "true");
Object.assign(overlay.style, {
  position: "fixed", inset: "0", width: "100%", height: "100%",
  pointerEvents: "none", zIndex: "1", imageRendering: "pixelated"
});
document.body.appendChild(overlay);
const ctx = overlay.getContext("2d", { alpha: true });
const MAX_ACTIVE = 7;
const MIN_FRAME = 1 / 30;
let active = [], serial = 0, carry = 0, dirty = false;
let viewW = 0, viewH = 0, viewDpr = 0;

function syncSize() {
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (w === viewW && h === viewH && dpr === viewDpr) return;
  viewW = w; viewH = h; viewDpr = dpr;
  overlay.width = Math.max(1, Math.round(w * dpr));
  overlay.height = Math.max(1, Math.round(h * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  dirty = false;
}
function clear() {
  active.length = 0;
  if (dirty) ctx.clearRect(0, 0, viewW, viewH);
  dirty = false; carry = 0;
}
function emit(kind, x, y, size = 50) {
  if (!ctx || !modules[kind] || document.hidden ||
      !Number.isFinite(x) || !Number.isFinite(y)) return;
  const mod = modules[kind];
  const [w, h] = mod.meta.size, [ox, oy] = mod.meta.origin;
  const frame = createFrame(w, h), img = ctx.createImageData(w, h);
  const sprite = document.createElement("canvas");
  sprite.width = w; sprite.height = h;
  const spriteCtx = sprite.getContext("2d", { alpha: true });
  if (!spriteCtx) return;
  const scale = Math.max(kind === "pickup" ? 0.48 : 0.42,
    Math.min(kind === "poof" ? 1.7 : 1.25, size / (kind === "poof" ? 82 : 68)));
  const fx = createFx(mod, {
    x: ox, y: oy, seed: (++serial % 9999) + 1,
    palette: palettes[kind], light: 0.75
  });
  if (active.length >= MAX_ACTIVE) active.shift();
  active.push({ fx, frame, img, sprite, spriteCtx, x, y, ox, oy, w, h, scale });
  carry = MIN_FRAME;
}
function draw(dt, { enabled = true, paused = false } = {}) {
  if (!ctx) return;
  syncSize();
  if (!enabled) { clear(); return; }
  if (paused || document.hidden) return;
  if (!active.length) {
    if (dirty) { ctx.clearRect(0, 0, viewW, viewH); dirty = false; }
    return;
  }
  carry += Math.max(0, Math.min(0.05, dt || 0));
  if (carry < MIN_FRAME) return;
  const step = Math.min(0.05, carry);
  carry = 0;
  ctx.clearRect(0, 0, viewW, viewH);
  for (const a of active) {
    // Render the first flash at t=0; updating first would skip hit-spark's keyframe.
    if (a.fx.done()) continue;
    clearFrame(a.frame);
    a.fx.draw(a.frame);
    composite(a.frame, a.img.data, null, 0.75);
    a.spriteCtx.putImageData(a.img, 0, 0);
    ctx.drawImage(a.sprite,
      Math.round(a.x - a.ox * a.scale), Math.round(a.y - a.oy * a.scale),
      a.w * a.scale, a.h * a.scale);
    a.fx.update(step);
  }
  active = active.filter(a => !a.fx.done());
  dirty = true;
}
window.ObakePixelFX = Object.freeze({ emit, draw, clear });
