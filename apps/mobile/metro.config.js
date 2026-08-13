const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const clerkHeadless = path.resolve(
  __dirname,
  "node_modules/@clerk/clerk-js/dist/clerk.headless.js"
);

// Redirect @clerk/clerk-js to its headless (non-browser) build.
// extraNodeModules works in dev but is unreliable in standalone APK builds —
// resolveRequest intercepts at the module graph level and works in both.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@clerk/clerk-js" || moduleName.startsWith("@clerk/clerk-js/")) {
    return { filePath: clerkHeadless, type: "sourceFile" };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
