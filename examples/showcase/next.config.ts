import type { NextConfig } from "next";

const config: NextConfig = {
	// Inside the Monti repo the packages are TypeScript sources; a site that installs them from npm needs none of this line.
	transpilePackages: [
		"@monti-cms/core",
		"@monti-cms/admin",
		"@monti-cms/ui",
		"@monti-cms/next",
		"@monti-cms/ai",
		"@monti-cms/seo",
		"@monti-cms/mdx",
		"@monti-cms/storage-s3",
	],
	// The database driver and the config loader run as they are on the server.
	serverExternalPackages: ["pg", "jiti"],
	// The dev server's pages run in the browser only for the hosts Next knows: `localhost`, and here this machine's other name. A site opened
	// in development by a LAN address or a tunnel names that host here too, or the admin (drawn in the browser) stays blank.
	allowedDevOrigins: ["127.0.0.1"],
	// Two servers of this one folder (the repo's flow tests run a site with a storage and one without) each keep their own build.
	distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default config;
