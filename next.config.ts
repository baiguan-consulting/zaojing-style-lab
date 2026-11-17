import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce the minimal runtime bundle used by the production Docker image.
  output: "standalone",
  // Template data is mutable local storage in the prototype, so pages render per request.
  cacheComponents: false,
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
