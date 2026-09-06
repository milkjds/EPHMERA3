// PNG luminance preview + region stats — verifies composition without an image viewer.
// Usage: node tools/pngstat.mjs <file.png> [cols] [rows]
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const [,, file, colsArg, rowsArg] = process.argv;
const buf = readFileSync(file);
let off = 8;
const chunks = [];
while (off < buf.length) {
  const len = buf.readUInt32BE(off);
  const type = buf.toString("ascii", off + 4, off + 8);
  chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) });
  off += 12 + len;
}
const ihdr = chunks.find((c) => c.type === "IHDR").data;
const w = ihdr.readUInt32BE(0);
const h = ihdr.readUInt32BE(4);
const depth = ihdr[8];
const ctype = ihdr[9];
if (depth !== 8 || (ctype !== 2 && ctype !== 6 && ctype !== 0)) {
  console.error(`unsupported png: depth=${depth} ctype=${ctype}`);
  process.exit(1);
}
const bpp = ctype === 6 ? 4 : ctype === 2 ? 3 : 1;
const idat = Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data));
const raw = inflateSync(idat);
const stride = w * bpp;
const out = Buffer.alloc(h * stride);
let p = 0;
const paeth = (a, b, c) => {
  const pp = a + b - c;
  const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
for (let y = 0; y < h; y++) {
  const filter = raw[p++];
  const row = out.subarray(y * stride, (y + 1) * stride);
  const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
  for (let x = 0; x < stride; x++) {
    const cur = raw[p];
    const a = x >= bpp ? row[x - bpp] : 0;
    const b = prev ? prev[x] : 0;
    const c = x >= bpp && prev ? prev[x - bpp] : 0;
    let v = cur;
    if (filter === 1) v = cur + a;
    else if (filter === 2) v = cur + b;
    else if (filter === 3) v = cur + ((a + b) >> 1);
    else if (filter === 4) v = cur + paeth(a, b, c);
    row[x] = v & 0xff;
  }
}
const at = (x, y) => {
  const i = (y * w + x) * bpp;
  if (ctype === 0) return [out[i], out[i], out[i]];
  return [out[i], out[i + 1], out[i + 2]];
};
const lum = (x, y) => {
  const [r, g, b] = at(x, y);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};
const cols = parseInt(colsArg || "100", 10);
const rows = parseInt(rowsArg || "36", 10);
const ramp = " .:-=+*#%@";
console.log(`png ${w}x${h} (buf ${buf.length})`);
let avg = 0;
for (let ry = 0; ry < rows; ry++) {
  let line = "";
  for (let rx = 0; rx < cols; rx++) {
    const x = Math.min(w - 1, Math.floor(((rx + 0.5) / cols) * w));
    const y = Math.min(h - 1, Math.floor(((ry + 0.5) / rows) * h));
    const l = lum(x, y) / 255;
    avg += l;
    line += ramp[Math.min(ramp.length - 1, Math.floor(l * ramp.length))];
  }
  console.log(line);
}
avg /= cols * rows;
// region stats: bars / picture quadrants (1920x1080 with 2.35:1 picture)
const stats = (label, x0, y0, x1, y1) => {
  let s = 0, n = 0, max = 0;
  for (let y = Math.round(y0); y < Math.round(y1); y += 3)
    for (let x = Math.round(x0); x < Math.round(x1); x += 3) {
      const l = lum(x, y);
      s += l; n++; max = Math.max(max, l);
    }
  console.log(`${label}: mean ${(s / n).toFixed(0)} max ${max.toFixed(0)}`);
};
console.log(`overall mean ${(avg * 255).toFixed(0)}`);
stats("top-bar", 0, 0, 1920, 140);
stats("bottom-bar", 0, 950, 1920, 1080);
stats("pic-upper-left", 0, 150, 400, 550);
stats("pic-upper-right", 1400, 150, 1920, 500);
stats("pic-center", 700, 200, 1220, 550);
stats("pic-lower", 0, 600, 1920, 940);
