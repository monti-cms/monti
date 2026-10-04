import { DEFAULT_ADMIN_PATH } from "../config/define";

/** `monti init`이 만드는 파일 내용(개발자가 읽는 글이라 영어다). 앱이 바로 고쳐 쓰는 시작점이다. */

/** `monti init`이 새 설정에 적는 기본값. 로그인·화면 글은 사이트 기본 언어를 따른다(M15). */
export const DEFAULT_INIT_LOCALE = "en";
export const DEFAULT_INIT_TIME_ZONE = "UTC";

export interface ConfigTemplateOptions {
	/** 사이트 기본 언어 코드(예: `en`, `ko`). */
	readonly locale?: string;
	/** 날짜·시각 시간대(IANA, 예: `UTC`, `Asia/Seoul`). */
	readonly timeZone?: string;
}

/** 언어 코드의 그 언어 이름(예: `ko` → `한국어`). 모르면 코드를 그대로 쓴다. */
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

export function nextConfigTemplate(config: string, server: string): string {
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
] as const;

/** Packages the app installs (including those the admin package must share with the app). */
export const INSTALL_COMMANDS = [
	"pnpm add @monti-cms/core @monti-cms/admin next-auth@5.0.0-beta.32 next-themes @tanstack/react-query sonner @tiptap/core @tiptap/pm @tiptap/react",
	"pnpm add -D tw-animate-css @tailwindcss/typography",
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
	{ name: "CMS_DEV_AUTH_BYPASS", note: "Optional. 1 treats everyone as admin in next dev without signing in" },
];
