import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16/Turbopack may otherwise pick /home/minhanee as the workspace
  // root because that directory also has a package-lock.json.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
