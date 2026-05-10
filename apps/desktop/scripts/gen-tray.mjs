// Run with: node apps/desktop/scripts/gen-tray.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// 32x32 blue square PNG (raw bytes, hex-encoded). Created via a known minimal PNG.
const png = Buffer.from(
  "89504E470D0A1A0A0000000D49484452000000200000002008060000007394F2D70000004949444154789CEDD2C10D003008C04A4FB6FFC1B95FB14D8F0184F25E2902020202020202020202020202020202020202020202020202028281BE9F00BC04CB30D6028A0000000049454E44AE426082",
  "hex",
);
mkdirSync(join(import.meta.dirname, "..", "assets"), { recursive: true });
writeFileSync(join(import.meta.dirname, "..", "assets", "tray-default.png"), png);
console.log("wrote tray-default.png");
