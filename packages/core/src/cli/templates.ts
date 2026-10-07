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

/** The config file `monti init` creates: the one place the site is set up. It loads the schema file and lists the database, login and plugins, one line each. */
export const MONTI_CONFIG_TEMPLATE = `import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { defineConfig, postgres } from "@monti-cms/core/server";
import schema from "./monti.schema.json";

/**
 * The one config of the site, and the CMS instance it makes. Everything on the server uses it: the admin API route, the admin screens, the monti command,
 * and your site's pages (cms.read.getEntry(...)). Only the server imports this file: it is never part of a client bundle (the admin gets the site as data).
 *
 * The data (collections, fields, locales, time zone, admin path) is in monti.schema.json: edit it there (editors autocomplete it, and \`monti schema:types\` writes
 * the types, so \`cms.read\` and the admin know your collections without you writing types). This file has what needs code. Values come from the environment
 * (.env.local) unless you pass them here: see .env.example.
 */
export const cms = defineConfig({
	schema,
	// The public site URL is read from SITE_URL. Other site settings that differ per environment override the file's: site: { name: "..." },

	// One line per feature, each works with no arguments. Install the package, import it above, add it here, for example:
	//   mdx()      from @monti-cms/mdx      MDX bodies
	//   seo()      from @monti-cms/seo      SEO fields
	//   callout()  from @monti-cms/blocks   a body block (one function per block: tabs(), columns(), mermaid(), ...)
	plugins: [],

	// The content database. Reads DATABASE_URL (and DATABASE_SCHEMA when the database is shared).
	database: postgres(),

	// Who can log in. github() reads AUTH_GITHUB_ID and AUTH_GITHUB_SECRET (the OAuth app) and MONTI_ADMIN_GITHUB_ID (the admin's numeric GitHub id). Another provider
	// (GitLab, Google, ...) goes in the same list.
	// In next dev you are signed in as the admin automatically (only from this machine); production never does that.
	auth: auth({ providers: [github()] }),

	// Image and file uploads: an adapter from a storage package. pnpm add @monti-cms/storage-s3, import { s3Storage } from it, and it reads its settings
	// from the environment (S3_* in .env.local; Cloudflare R2 and MinIO too). Without one, the admin hides the media menu.
	// storage: s3Storage(),

	// The one secret (MONTI_SECRET) signs the login session and encrypts stored values (AI service keys, tokens): each use gets its own key derived from it.
	// To change it without losing stored values: previousSecrets: [oldSecret].
});
`;

/** The generated files import the CMS instance from the config file. \`configImport\` is its import path from the generated file, without an extension. */
export const adminPageTemplate = (
	configImport: string,
) => `import { CmsAdminPage, type CmsAdminPageProps } from "@monti-cms/nextjs/admin";
import { cms } from ${JSON.stringify(configImport)};

export default function AdminPage(props: CmsAdminPageProps) {
	return <CmsAdminPage cms={cms} {...props} />;
}
`;

export const adminLayoutTemplate = (configImport: string) => `import "@monti-cms/admin/styles.css";
import { CmsAdminLayout, cmsAdminMetadata } from "@monti-cms/nextjs/admin";
import type { ReactNode } from "react";
import { cms } from ${JSON.stringify(configImport)};

export const generateMetadata = () => cmsAdminMetadata(cms);

/**
 * Admin screen (@monti-cms/admin). The stylesheet is prebuilt, so the app needs no Tailwind for it. This layout stays apart from the page on purpose: it keeps the
 * admin (navigation, data, theme) mounted while you move between screens. Your own admin components are a plugin (see "Admin extensions" in the admin README).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
	return <CmsAdminLayout cms={cms}>{children}</CmsAdminLayout>;
}
`;

export const apiRouteTemplate = (configImport: string) => `import { createRouteHandler } from "@monti-cms/nextjs";
import { cms } from ${JSON.stringify(configImport)};

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

/** The environment variables of `.env.example`, in order. `required` ones are needed to run; the others have a default or only matter in some setups. */
export const ENV_VARS: readonly { readonly name: string; readonly note: string; readonly required: boolean }[] = [
	{ name: "DATABASE_URL", note: "Postgres connection URL", required: true },
	{
		name: "DATABASE_SCHEMA",
		note: "Schema name when the database is shared (public if empty)",
		required: false,
	},
	{
		name: "MONTI_SECRET",
		note: "A long random value, for example from `openssl rand -base64 32`. Signs the login session and encrypts stored values (AI service keys, tokens)",
		required: true,
	},
	{
		name: "AUTH_GITHUB_ID",
		note: "Client ID of the GitHub OAuth app (callback URL: <site URL>/api/cms/auth/callback/github). Not needed in next dev",
		required: false,
	},
	{
		name: "AUTH_GITHUB_SECRET",
		note: "Client secret of the GitHub OAuth app. Not needed in next dev",
		required: false,
	},
	{ name: "MONTI_ADMIN_GITHUB_ID", note: "Numeric GitHub id of the admin. Not needed in next dev", required: false },
	{
		name: "AUTH_TRUST_HOST",
		note: "Only behind a proxy you run yourself (nginx, a load balancer): true. Vercel, Netlify and Cloudflare Pages are detected",
		required: false,
	},
];
