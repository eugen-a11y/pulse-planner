// Generate a 256x256 single-color blue ICO from a PNG.
// Requires `to-ico` package; if absent, falls back to copying the tray PNG into icon.ico (NSIS will accept).
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const outDir = join(import.meta.dirname, "..", "build");
mkdirSync(outDir, { recursive: true });

// CRC-32 (PNG uses standard CRC-32)
function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcVal = crc32(crcInput);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal >>> 0);
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

// Build a minimal valid RGB PNG of given size filled with Pulse blue (#3B82F6)
function buildBluePng(size = 32) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  // compression, filter, interlace = 0

  // Pulse blue: #3B82F6 = rgb(59, 130, 246)
  const r = 59, g = 130, b = 246;
  const scanline = Buffer.alloc(1 + size * 3);
  scanline[0] = 0; // filter None
  for (let x = 0; x < size; x++) {
    scanline[1 + x * 3] = r;
    scanline[2 + x * 3] = g;
    scanline[3 + x * 3] = b;
  }
  const rawData = Buffer.concat(Array(size).fill(scanline));
  const compressed = deflateSync(rawData);

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const pngBuf = buildBluePng(256);

try {
  const toIco = (await import("to-ico")).default;
  const ico = await toIco([pngBuf]);
  writeFileSync(join(outDir, "icon.ico"), ico);
  console.log("wrote build/icon.ico (proper ICO via to-ico)");
} catch (e) {
  console.warn("to-ico failed:", e.message, "— falling back to PNG-as-ICO");
  writeFileSync(join(outDir, "icon.ico"), pngBuf);
  console.log("wrote build/icon.ico");
}
