import { DEFAULT_ADMIN_PATH } from "../config/define.js";
/** Contents of the files `monti init` creates (developer-facing, so English). A starting point the app edits right away. */
/** Defaults `monti init` writes into a new config. Sign-in and UI text follow the site default locale. */
export const DEFAULT_INIT_LOCALE = "en";
export const DEFAULT_INIT_TIME_ZONE = "UTC";
/** The language's name in that language for a locale code (e.g. `ko` -> `한국어`). Falls back to the code itself. */
function languageName(code) {
    try {
        return new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
    }
    catch {
        return code;
    }
}
export function configTemplate(adminPath, options = {}) {
    const locale = options.locale ?? DEFAULT_INIT_LOCALE;
    const timeZone = options.timeZone ?? DEFAULT_INIT_TIME_ZONE;
    const admin = adminPath === DEFAULT_ADMIN_PATH
        ? ""
        : `\t// Admin screen path. Must match the admin route folder ((admin)${adminPath}/).\n\tadmin: { path: "${adminPath}" },\n`;
    return `import { defineCollection, defineConfig, fields } from "@monti-cms/core";
// Optional: block extensions (callouts, tabs, Mermaid, charts, ...) and the SEO extension. Install the package, then uncomment.
// import { blocks } from "@monti-cms/blocks";
// import { seo, seoFields } from "@monti-cms/seo";

/**
 * Site config. The server and the admin screen both read it, so keep secrets out (they go in cms.server.ts).
 * The collection name (\`post\` below) is stored in the database, so don't rename it in production. Add and edit fields freely.
 */
const post = defineCollection({
	label: "Post",
	kind: "document", // body, draft and publish. Use "item" for small entries like tags
	path: "/posts/:slug", // public URL shape. Used for internal links in the body and preview URLs
	icon: "file-text",
	fields: {
		// The title field is named \`title\` (the label is up to you).
		title: fields.text({ label: "Title", required: true, max: 200 }),
		slug: fields.slug({ label: "Slug", from: "title", required: true }),
		summary: fields.text({ label: "Summary", role: "summary", multiline: true, fillFromBody: true }),
		// ...seoFields(), // SEO tab: search title and description, share image, hide from search
	},
});

export default defineConfig({
	collections: { post },
	// The admin screen language and date format follow the default locale (override with admin.locale).
	locales: [{ code: ${JSON.stringify(locale)}, name: ${JSON.stringify(languageName(locale))} }],
	defaultLocale: ${JSON.stringify(locale)},
	site: { name: "My site" },
	timeZone: ${JSON.stringify(timeZone)},
${admin}	// plugins: [...blocks(), seo()],
});
`;
}
export const SERVER_TEMPLATE = `import { defineServerConfig, githubAuth, postgres } from "@monti-cms/core/server";

/**
 * Server config. The database and sign-in connections and the secrets are read from environment variables (.env.local).
 * Only the server reads it. The admin API route also serves the sign-in API (/api/cms/auth/*). The callback URL of the
 * GitHub OAuth app is <site URL>/api/cms/auth/callback/github.
 */
export default defineServerConfig({
	database: postgres({ connectionString: process.env.CMS_DATABASE_URL, schema: process.env.CMS_SCHEMA }),
	auth: githubAuth({
		clientId: process.env.AUTH_GITHUB_ID,
		clientSecret: process.env.AUTH_GITHUB_SECRET,
		adminIds: [process.env.CMS_ADMIN_GITHUB_ID], // numeric GitHub ID of the admin
		devBypass: process.env.CMS_DEV_AUTH_BYPASS === "1", // only in next dev: treat everyone as admin without signing in
		secret: process.env.AUTH_SECRET, // signs the sign-in session
	}),
	// Encryption key for stored values (AI service keys). If you change it, enter the stored keys again. Keep it separate from the sign-in secret.
	secret: process.env.CMS_SECRET,
	// media: r2Storage({ ... }), // image and file uploads (S3-compatible storage), imported from @monti-cms/core/s3
});
`;
export const ADMIN_PAGE_TEMPLATE = `export { CmsAdminPage as default } from "@monti-cms/admin/next";
`;
export const ADMIN_LAYOUT_TEMPLATE = `import { CmsAdminLayout } from "@monti-cms/admin/next";
import type { ReactNode } from "react";

export { cmsAdminMetadata as metadata } from "@monti-cms/admin/next";

/** Admin screen (@monti-cms/admin). Pass site components with CmsAdminComponentsProvider (see the admin README). */
export default function AdminLayout({ children }: { children: ReactNode }) {
	return <CmsAdminLayout>{children}</CmsAdminLayout>;
}
`;
export const API_ROUTE_TEMPLATE = `import { createCmsRouteHandler } from "@monti-cms/core/next/route-handler";

/** Admin API (/api/cms/v1/*) and sign-in (/api/cms/auth/*). */
export const { GET, POST, PATCH, PUT, DELETE } = createCmsRouteHandler();
`;
export function nextConfigTemplate(config, server) {
    return `import { withCms } from "@monti-cms/core/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default withCms(nextConfig, { config: "${config}", server: "${server}" });
`;
}
/** Style lines the admin screen needs. Put them in the app's Tailwind input CSS after `@import "tailwindcss";`. */
export const CSS_LINES = [
    '@import "tw-animate-css";',
    '@import "@monti-cms/admin/styles.css";',
    '@plugin "@tailwindcss/typography";',
];
/** Packages the app installs (including those the admin package must share with the app). */
export const INSTALL_COMMANDS = [
    "pnpm add @monti-cms/core @monti-cms/admin next-auth@5.0.0-beta.32 next-themes @tanstack/react-query sonner @tiptap/core @tiptap/pm @tiptap/react",
    "pnpm add -D tw-animate-css @tailwindcss/typography",
];
/** Values for `.env.local`. */
export const ENV_VARS = [
    { name: "CMS_DATABASE_URL", note: "Postgres connection URL" },
    { name: "CMS_SCHEMA", note: "Optional. Schema name when sharing the database (public if empty)" },
    { name: "AUTH_SECRET", note: "A long random value. Signs the sign-in session" },
    {
        name: "CMS_SECRET",
        note: "A long random value (different from AUTH_SECRET). Encrypts stored values (AI service keys)",
    },
    { name: "AUTH_GITHUB_ID", note: "Client ID of the GitHub OAuth app" },
    { name: "AUTH_GITHUB_SECRET", note: "Client secret of the GitHub OAuth app" },
    { name: "CMS_ADMIN_GITHUB_ID", note: "Numeric GitHub ID of the admin" },
    { name: "CMS_DEV_AUTH_BYPASS", note: "Optional. 1 treats everyone as admin in next dev without signing in" },
];
