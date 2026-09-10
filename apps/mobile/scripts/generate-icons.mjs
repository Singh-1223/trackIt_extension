// Generates the app icon assets from an inline SVG using sharp.
// Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, "..", "assets");
mkdirSync(assetsDir, { recursive: true });

const BG = "#b9552f";       // colors.accent
const BG_DARK = "#8e3e21";  // colors.accentStrong
const WARM = "#edb263";     // colors.accentWarm
const CREAM = "#fffaf2";    // colors.surfaceStrong
const INK = "#3a231a";      // dark brown for features
const PINK = "#f2b8a6";     // nose / inner ear / cheeks
const SPLASH_BG = "#f5efe5";// colors.bg

// A sweet, rounded cat face. Coordinates are on a 0..s canvas.
// Drawn centered so it can be reused for full-bleed icon, adaptive foreground,
// and splash.
function catFace(s) {
  const cx = s / 2;
  const cy = s * 0.54;
  const headR = s * 0.30;

  // Ears (triangles with rounded feel) sitting on top of the head
  const earH = s * 0.20;
  const earW = s * 0.20;
  const earY = cy - headR * 0.72;
  const leftEarX = cx - headR * 0.62;
  const rightEarX = cx + headR * 0.62;

  const ear = (x, dir) => {
    const tipX = x + dir * earW * 0.15;
    const tipY = earY - earH;
    const baseIn = x + dir * earW * 0.55;
    const baseOut = x - dir * earW * 0.55;
    return `
      <path d="M ${baseOut} ${earY + earH * 0.15} L ${tipX} ${tipY} L ${baseIn} ${earY + earH * 0.15} Z"
            fill="${CREAM}" stroke="${CREAM}" stroke-width="${s * 0.02}" stroke-linejoin="round"/>
      <path d="M ${x - dir * earW * 0.22} ${earY + earH * 0.05} L ${tipX} ${tipY + earH * 0.28} L ${x + dir * earW * 0.28} ${earY + earH * 0.05} Z"
            fill="${PINK}" stroke-linejoin="round"/>`;
  };

  // Eyes
  const eyeY = cy - headR * 0.10;
  const eyeDX = headR * 0.42;
  const eyeRX = headR * 0.15;
  const eyeRY = headR * 0.19;

  // Nose
  const noseY = cy + headR * 0.20;
  const noseW = headR * 0.16;

  // Whiskers
  const whY = cy + headR * 0.24;
  const whInner = headR * 0.42;
  const whLen = headR * 0.72;

  return `
    ${ear(leftEarX, -1)}
    ${ear(rightEarX, 1)}

    <!-- Head -->
    <circle cx="${cx}" cy="${cy}" r="${headR}" fill="${CREAM}"/>

    <!-- Cheeks -->
    <circle cx="${cx - headR * 0.55}" cy="${cy + headR * 0.30}" r="${headR * 0.16}" fill="${PINK}" opacity="0.75"/>
    <circle cx="${cx + headR * 0.55}" cy="${cy + headR * 0.30}" r="${headR * 0.16}" fill="${PINK}" opacity="0.75"/>

    <!-- Eyes (happy, closed-ish curves) -->
    <ellipse cx="${cx - eyeDX}" cy="${eyeY}" rx="${eyeRX}" ry="${eyeRY}" fill="${INK}"/>
    <ellipse cx="${cx + eyeDX}" cy="${eyeY}" rx="${eyeRX}" ry="${eyeRY}" fill="${INK}"/>
    <circle cx="${cx - eyeDX + eyeRX * 0.35}" cy="${eyeY - eyeRY * 0.35}" r="${eyeRX * 0.35}" fill="${CREAM}"/>
    <circle cx="${cx + eyeDX + eyeRX * 0.35}" cy="${eyeY - eyeRY * 0.35}" r="${eyeRX * 0.35}" fill="${CREAM}"/>

    <!-- Nose -->
    <path d="M ${cx - noseW} ${noseY} L ${cx + noseW} ${noseY} L ${cx} ${noseY + noseW * 0.9} Z"
          fill="${PINK}" stroke="${INK}" stroke-width="${s * 0.006}" stroke-linejoin="round"/>

    <!-- Mouth (sweet :3) -->
    <path d="M ${cx} ${noseY + noseW * 0.9}
             Q ${cx - headR * 0.14} ${cy + headR * 0.42} ${cx - headR * 0.24} ${cy + headR * 0.30}
             M ${cx} ${noseY + noseW * 0.9}
             Q ${cx + headR * 0.14} ${cy + headR * 0.42} ${cx + headR * 0.24} ${cy + headR * 0.30}"
          fill="none" stroke="${INK}" stroke-width="${s * 0.011}" stroke-linecap="round"/>

    <!-- Whiskers -->
    <g stroke="${INK}" stroke-width="${s * 0.009}" stroke-linecap="round" opacity="0.85">
      <path d="M ${cx - whInner} ${whY - headR * 0.06} L ${cx - whLen} ${whY - headR * 0.14}" fill="none"/>
      <path d="M ${cx - whInner} ${whY + headR * 0.04} L ${cx - whLen} ${whY + headR * 0.02} " fill="none"/>
      <path d="M ${cx + whInner} ${whY - headR * 0.06} L ${cx + whLen} ${whY - headR * 0.14}" fill="none"/>
      <path d="M ${cx + whInner} ${whY + headR * 0.04} L ${cx + whLen} ${whY + headR * 0.02} " fill="none"/>
    </g>`;
}

function iconSvg(size, { bleed = true } = {}) {
  const s = size;
  const r = s * 0.22;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${WARM}"/>
      <stop offset="0.45" stop-color="${BG}"/>
      <stop offset="1" stop-color="${BG_DARK}"/>
    </linearGradient>
  </defs>
  ${bleed ? `<rect width="${s}" height="${s}" rx="${r}" fill="url(#bg)"/>` : ""}
  ${catFace(s)}
</svg>`;
}

// Adaptive icon foreground: cat centered within the Android safe zone,
// transparent background.
function adaptiveForegroundSvg(size) {
  const s = size;
  const inner = s * 0.66;
  const offset = (s - inner) / 2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <g transform="translate(${offset} ${offset})">
    ${catFace(inner)}
  </g>
</svg>`;
}

async function render(svg, out, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(assetsDir, out));
  console.log("wrote", out);
}

async function main() {
  // App icon (iOS + general): full-bleed rounded square with cat
  await render(iconSvg(1024), "icon.png", 1024);

  // Adaptive icon foreground (Android): centered cat, transparent bg
  await render(adaptiveForegroundSvg(1024), "adaptive-icon.png", 1024);

  // Splash: cat on the app background color
  const splash = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${SPLASH_BG}"/>
  <g transform="translate(272 272)">
    ${iconSvg(480, { bleed: false }).replace(/^\s*<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")}
  </g>
</svg>`;
  await render(splash, "splash.png", 1024);

  // Favicon for web
  await render(iconSvg(256), "favicon.png", 48);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
