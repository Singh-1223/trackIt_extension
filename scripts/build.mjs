import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { build, context } from "esbuild";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const publicDir = path.join(rootDir, "public");
const watchMode = process.argv.includes("--watch");

async function prepareDistDirectory() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await cp(publicDir, distDir, { recursive: true });
}

function createBuildOptions() {
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
    loader: {
      ".css": "css"
    },
    minify: !watchMode,
    platform: "browser",
    sourcemap: watchMode,
    target: ["chrome114"]
  };
}

async function run() {
  await prepareDistDirectory();

  if (watchMode) {
    const ctx = await context(createBuildOptions());
    await ctx.watch();
    console.log("Watching TrackIt source files...");
    return;
  }

  await build(createBuildOptions());
  console.log("Built TrackIt into dist/.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
