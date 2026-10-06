import { createCms, defineServerConfig, githubAuth, postgres } from "@monti-cms/core/server";

/**
 * The CMS instance (the shape `monti init` generates). The store and admin login are read from environment variables (`.env.local`). No media storage is set up.
 * The admin API route, the admin screens and the site's pages all use this one `cms`. The admin API route also handles the login API
 * (`/api/cms/auth/*`, no separate login route file). The GitHub OAuth app's callback URL is `<site URL>/api/cms/auth/callback/github`.
 */
export const cms = createCms({
	server: defineServerConfig({
		database: postgres({ connectionString: process.env.CMS_DATABASE_URL, schema: process.env.CMS_SCHEMA }),
		auth: githubAuth({
			clientId: process.env.AUTH_GITHUB_ID,
			clientSecret: process.env.AUTH_GITHUB_SECRET,
			adminIds: [process.env.CMS_ADMIN_GITHUB_ID],
			// Only in local development (`next dev`), treat the visitor as admin without logging in.
			devBypass: process.env.CMS_DEV_AUTH_BYPASS === "1",
			secret: process.env.AUTH_SECRET,
		}),
		secret: process.env.CMS_SECRET,
	}),
});
