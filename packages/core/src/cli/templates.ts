import { DEFAULT_ADMIN_PATH } from "../config/define";

/** Contents of the files `monti init` creates (developer-facing, so English). A starting point the app edits right away. */

/** Defaults `monti init` writes into a new config. Sign-in and UI text follow the site default locale. */
export const DEFAULT_INIT_LOCALE = "en";
export const DEFAULT_INIT_TIME_ZONE = "UTC";

export interface ConfigTemplateOptions {
	/** Site default locale code (e.g. `en`, `ko`). */
	readonly locale?: string;
	/** Date/time zone (IANA, e.g. `UTC`, `Asia/Seoul`). */
	readonly timeZone?: string;
}

/** The language's name in that language for a locale code (e.g. `ko` -> `한국어`). Falls back to the code itself. */
function languageName(code: string): string {
	try {
		return new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
	} catch {
		return code;
	}
}

export function configTemplate(adminPath: string, options: ConfigTemplateOptions = {}): string {
	const locale = options.locale ?? DEFAULT_INIT_LOCALE;
	const timeZone = options.timeZone ?? DEFAULT_INIT_TIME_ZONE;
	const admin =
		adminPath === DEFAULT_ADMIN_PATH
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
	path: "/posts/:slug", // public URL shape (a sample; use your own). Used for internal links in the body and preview URLs
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

export const SERVER_TEMPLATE = `import { createCms, defineServerConfig, postgres } from "@monti-cms/core/server";
import { githubAuth } from "@monti-cms/nextjs/auth";

/**
 * The CMS instance. It owns the database, sign-in and media connections and the secrets, which are read from environment variables (.env.local).
 * Everything on the server uses it: the admin API route, the admin screens, and your site's pages (cms.read.getEntry(...)).
 * Only the server imports this file. The admin API route also serves the sign-in API (/api/cms/auth/*). The callback URL of the
 * GitHub OAuth app is <site URL>/api/cms/auth/callback/github.
 */
export const cms = createCms({
	server: defineServerConfig({
		database: postgres({ connectionString: process.env.CMS_DATABASE_URL, schema: process.env.CMS_SCHEMA }),
		auth: githubAuth({
			clientId: process.env.AUTH_GITHUB_ID,
			clientSecret: process.env.AUTH_GITHUB_SECRET,
			adminIds: [process.env.CMS_ADMIN_GITHUB_ID], // numeric GitHub ID of the admin
			devBypass: process.env.CMS_DEV_AUTH_BYPASS === "1", // only in next dev, only for requests from this machine: treat the visitor as admin without signing in
			secret: process.env.AUTH_SECRET, // signs the sign-in session
		}),
		// Master secret for stored values (AI service keys). Plugins get keys derived from it, never the secret itself. Keep it separate from the sign-in secret.
		// To change it, move the old value to "previousSecrets: [oldSecret]" so stored values stay readable.
		secret: process.env.CMS_SECRET,
		// media: r2Storage({ ... }), // image and file uploads (S3-compatible storage), imported from @monti-cms/core/s3
	}),
});
`;

/** The generated files import the CMS instance from the server file. \`serverImport\` is its import path from the generated file, without an extension. */
export const adminPageTemplate = (
	serverImport: string,
) => `import { CmsAdminPage, type CmsAdminPageProps } from "@monti-cms/nextjs/admin";
import { cms } from ${JSON.stringify(serverImport)};

export default function AdminPage(props: CmsAdminPageProps) {
	return <CmsAdminPage cms={cms} {...props} />;
}
`;

export const adminLayoutTemplate = (serverImport: string) => `import "@monti-cms/admin/styles.css";
import { CmsAdminLayout } from "@monti-cms/nextjs/admin";
import type { ReactNode } from "react";
import { cms } from ${JSON.stringify(serverImport)};

export { cmsAdminMetadata as metadata } from "@monti-cms/nextjs/admin";

/** Admin screen (@monti-cms/admin). The stylesheet is prebuilt, so the app needs no Tailwind for it. Pass site components with CmsAdminComponentsProvider (see the admin README). */
export default function AdminLayout({ children }: { children: ReactNode }) {
	return <CmsAdminLayout cms={cms}>{children}</CmsAdminLayout>;
}
`;

export const apiRouteTemplate = (serverImport: string) => `import { createRouteHandler } from "@monti-cms/nextjs";
import { cms } from ${JSON.stringify(serverImport)};

/** Admin API (/api/cms/v1/*) and sign-in (/api/cms/auth/*). */
export const { GET, POST, PATCH, PUT, DELETE } = createRouteHandler(cms);
`;

export function nextConfigTemplate(config: string): string {
	return `import { withCms } from "@monti-cms/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default withCms(nextConfig, { config: "${config}" });
`;
}

/** Packages the app installs (including those the admin package must share with the app). */
export const INSTALL_COMMANDS = [
	"pnpm add @monti-cms/core @monti-cms/admin @monti-cms/nextjs next-auth@5.0.0-beta.32 next-themes @tanstack/react-query sonner @tiptap/core @tiptap/pm @tiptap/react",
] as const;

/** Values for `.env.local`. */
export const ENV_VARS: readonly { readonly name: string; readonly note: string }[] = [
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
	{
		name: "CMS_DEV_AUTH_BYPASS",
		note: "Optional. 1 treats requests from this machine as admin in next dev without signing in",
	},
	{
		name: "AUTH_TRUST_HOST",
		note: "Optional. true behind a proxy or on a platform such as Vercel that sets Host and X-Forwarded-Host (needed for login in production)",
	},
];
