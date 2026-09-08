import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @electric-sql/pglite loads a WASM binary via internal path/URL handling
  // that breaks under Next's bundler — run it as plain Node instead.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Lets phones/other devices on the LAN load dev-mode JS chunks and HMR —
  // without this, Next silently blocks them and the page renders but never
  // hydrates (buttons render but do nothing).
  allowedDevOrigins: ["192.168.4.68", "*.trycloudflare.com"],
};

export default nextConfig;
