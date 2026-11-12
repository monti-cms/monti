import type { NextConfig } from "next";

const config: NextConfig = {
	// Inside the Monti repo the packages are TypeScript sources; a site that installs them from npm needs none of this line.
	transpilePackages: ["@monti-cms/core", "@monti-cms/admin", "@monti-cms/ui", "@monti-cms/next"],
	// The database driver and the config loader run as they are on the server.
	serverExternalPackages: ["pg", "jiti"],
	// Two servers of this one folder (the repo's flow tests run a site with a storage and one without) each keep their own build.
	distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default config;
