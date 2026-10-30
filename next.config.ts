import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // GitHub Pages serves directory indexes. Trailing slashes emit /zeit/index.html
  // so a refresh on /zeit/ resolves without a rewrite server. No basePath: the
  // site is the custom domain root (focus.micana.de).
  trailingSlash: true,
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
