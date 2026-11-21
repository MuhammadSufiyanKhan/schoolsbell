import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Embedded Postgres (local dev fallback) must not be bundled.
  // Chromium (PDF export) must stay external too, and its binaries + the Arabic font must be shipped with that route.
  serverExternalPackages: ["@electric-sql/pglite", "@sparticuz/chromium", "puppeteer-core", "unpdf"],
  outputFileTracingIncludes: {
    "/api/exam/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*", "./node_modules/@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-*-normal.woff2"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
