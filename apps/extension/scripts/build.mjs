import { cp, mkdir, rm, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { build, context } from "esbuild";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const publicDir = path.join(rootDir, "public");
const watchMode = process.argv.includes("--watch");

/** Read .env file and return VITE_* variables as esbuild define entries */
async function loadEnvDefines() {
  const defines = {};
  try {
    const envPath = path.join(rootDir, ".env");
    const content = await readFile(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (key.startsWith("VITE_")) {
        defines[`import.meta.env.${key}`] = JSON.stringify(value);
      }
    }
  } catch {
    // No .env file — use defaults
  }
  // Also define import.meta.env as a fallback object
  defines["import.meta.env"] = "{}";
  defines["import.meta"] = '{"env":{}}';
  return defines;
}

async function prepareDistDirectory() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await cp(publicDir, distDir, { recursive: true });
}

function createBuildOptions(defines) {
  return {
    entryPoints: {
      options: path.join(rootDir, "src/options/main.tsx"),
      popup: path.join(rootDir, "src/popup/main.tsx")
    },
    outdir: distDir,
    entryNames: "[name]",
    bundle: true,
    format: "iife",
    jsx: "automatic",
    legalComments: "none",
    define: defines,
    loader: {
      ".css": "css"
    },
    minify: !watchMode,
    platform: "browser",
    sourcemap: watchMode,
    target: ["chrome102"]
  };
}

async function run() {
  await prepareDistDirectory();
  const defines = await loadEnvDefines();

  if (watchMode) {
    const ctx = await context(createBuildOptions(defines));
    await ctx.watch();
    console.log("Watching TrackIt source files...");
    return;
  }

  await build(createBuildOptions(defines));
  console.log("Built TrackIt into dist/.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
