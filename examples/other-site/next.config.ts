import { withCms } from "@monti-cms/core/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	// This example lives inside a larger repo, so keep Next from picking the repo root as the app root.
	turbopack: { root: import.meta.dirname },
};

export default withCms(nextConfig, { config: "./cms.config.ts", server: "./cms.server.ts" });
