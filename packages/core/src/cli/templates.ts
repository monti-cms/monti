import { DEFAULT_ADMIN_PATH } from "../config/define";
import { SCHEMA_LINK } from "./schema-types";

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

/**
 * The schema file `monti init` creates (`monti.schema.json`): one `post` collection, the default locale and time zone, and the admin path when it is not the default.
 * It holds the plain data of the site; `cms.config.ts` loads it. `link` is the path of the JSON Schema from the schema file (editors use it for autocomplete).
 */
export function schemaTemplate(adminPath: string, options: ConfigTemplateOptions = {}, link = SCHEMA_LINK): string {
	const locale = options.locale ?? DEFAULT_INIT_LOCALE;
	const timeZone = options.timeZone ?? DEFAULT_INIT_TIME_ZONE;
	const schema = {
		$schema: link,
		collections: {
			post: {
				label: "Post",
				// body, draft and publish. Use "item" for small entries like tags
				kind: "document",
				// public URL shape (a sample; use your own). Used for internal links in the body and preview URLs
				path: "/posts/:slug",
				icon: "file-text",
				fields: {
					// the title field is named `title` (the label is up to you)
					title: { kind: "text", label: "Title", required: true, max: 200 },
					slug: { kind: "slug", label: "Slug", from: "title", required: true },
					summary: { kind: "text", label: "Summary", role: "summary", multiline: true, fillFromBody: true },
				},
			},
		},
		locales: [{ code: locale, name: languageName(locale) }],
		defaultLocale: locale,
		timeZone,
		site: { name: "My site" },
		...(adminPath === DEFAULT_ADMIN_PATH ? {} : { admin: { path: adminPath } }),
	};
	return `${JSON.stringify(schema, null, "\t")}\n`;
}

/** The site config `monti init` creates: it loads the schema file and adds what needs code. */
export const configTemplate = (): string => `import { defineConfig } from "@monti-cms/core";
// Optional: block extensions (callouts, tabs, Mermaid, charts, ...) and the SEO extension. Install the package, then uncomment.
// import { blocks } from "@monti-cms/blocks";
// import { seo } from "@monti-cms/seo";
import schema from "./monti.schema.json";

/**
 * Site config. The collections, fields, locales, time zone and admin path are data and live in monti.schema.json (edit them there: editors autocomplete it, and
 * \`monti schema:types\` writes the types, so \`cms.read\` and the admin know your collections without you writing types). This file adds what needs code.
 * The CMS instance (cms.server.ts) holds the config and the admin screen gets it from there, so keep secrets out (they go in cms.server.ts).
 */
export default defineConfig({
	schema,
	// Site settings that differ per environment override the file's: site: { url: process.env.HOST_URL },
	// plugins: [...blocks(), seo()],
});
`;

export const SERVER_TEMPLATE = `import { createCms, defineServerConfig, postgres } from "@monti-cms/core/server";
import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { nextHost } from "@monti-cms/nextjs/auth";
import config from "./cms.config";

/**
 * The CMS instance. It holds the site config (cms.config.ts) and owns the database, sign-in and media connections and the secrets, which are read from environment variables (.env.local).
 * Everything on the server uses it: the admin API route, the admin screens, and your site's pages (cms.read.getEntry(...)).
 * Only the server imports this file. The admin API route also serves the sign-in API (/api/cms/auth/*). The callback URL of the
 * GitHub OAuth app is <site URL>/api/cms/auth/callback/github.
 */
export const cms = createCms({
	config,
	server: defineServerConfig({
		database: postgres({ connectionString: process.env.CMS_DATABASE_URL, schema: process.env.CMS_SCHEMA }),
		auth: auth({
			// Ways to sign in. Another provider (GitLab, Google, ...) goes in this list; admins are matched per provider as "<provider>:<id>".
			providers: [
				github({
					clientId: process.env.AUTH_GITHUB_ID,
					clientSecret: process.env.AUTH_GITHUB_SECRET,
					admins: [process.env.CMS_ADMIN_GITHUB_ID], // numeric GitHub ID of the admin
				}),
			],
			host: nextHost, // lets the sign-in read the headers of the request Next.js is handling
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
import { CmsAdminLayout, cmsAdminMetadata } from "@monti-cms/nextjs/admin";
import type { ReactNode } from "react";
import { cms } from ${JSON.stringify(serverImport)};

export const generateMetadata = () => cmsAdminMetadata(cms);

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

export function nextConfigTemplate(): string {
	return `import { withCms } from "@monti-cms/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default withCms(nextConfig);
`;
}

/** Packages the app installs (including those the admin package must share with the app). */
export const INSTALL_COMMANDS = [
	"pnpm add @monti-cms/core @monti-cms/admin @monti-cms/auth @monti-cms/nextjs next-themes @tanstack/react-query sonner @tiptap/core @tiptap/pm @tiptap/react",
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
