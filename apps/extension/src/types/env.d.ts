interface ImportMetaEnv {
  VITE_CLERK_PUBLISHABLE_KEY?: string;
  VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
