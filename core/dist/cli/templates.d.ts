/** Contents of the files `monti init` creates (developer-facing, so English). A starting point the app edits right away. */
/** Defaults `monti init` writes into a new config. Sign-in and UI text follow the site default locale. */
export declare const DEFAULT_INIT_LOCALE = "en";
export declare const DEFAULT_INIT_TIME_ZONE = "UTC";
export interface ConfigTemplateOptions {
    /** Site default locale code (e.g. `en`, `ko`). */
    readonly locale?: string;
    /** Date/time zone (IANA, e.g. `UTC`, `Asia/Seoul`). */
    readonly timeZone?: string;
}
export declare function configTemplate(adminPath: string, options?: ConfigTemplateOptions): string;
export declare const SERVER_TEMPLATE = "import { defineServerConfig, githubAuth, postgres } from \"@monti-cms/core/server\";\n\n/**\n * Server config. The database and sign-in connections and the secrets are read from environment variables (.env.local).\n * Only the server reads it. The admin API route also serves the sign-in API (/api/cms/auth/*). The callback URL of the\n * GitHub OAuth app is <site URL>/api/cms/auth/callback/github.\n */\nexport default defineServerConfig({\n\tdatabase: postgres({ connectionString: process.env.CMS_DATABASE_URL, schema: process.env.CMS_SCHEMA }),\n\tauth: githubAuth({\n\t\tclientId: process.env.AUTH_GITHUB_ID,\n\t\tclientSecret: process.env.AUTH_GITHUB_SECRET,\n\t\tadminIds: [process.env.CMS_ADMIN_GITHUB_ID], // numeric GitHub ID of the admin\n\t\tdevBypass: process.env.CMS_DEV_AUTH_BYPASS === \"1\", // only in next dev: treat everyone as admin without signing in\n\t\tsecret: process.env.AUTH_SECRET, // signs the sign-in session\n\t}),\n\t// Encryption key for stored values (AI service keys). If you change it, enter the stored keys again. Keep it separate from the sign-in secret.\n\tsecret: process.env.CMS_SECRET,\n\t// media: r2Storage({ ... }), // image and file uploads (S3-compatible storage), imported from @monti-cms/core/s3\n});\n";
export declare const ADMIN_PAGE_TEMPLATE = "export { CmsAdminPage as default } from \"@monti-cms/admin/next\";\n";
export declare const ADMIN_LAYOUT_TEMPLATE = "import { CmsAdminLayout } from \"@monti-cms/admin/next\";\nimport type { ReactNode } from \"react\";\n\nexport { cmsAdminMetadata as metadata } from \"@monti-cms/admin/next\";\n\n/** Admin screen (@monti-cms/admin). Pass site components with CmsAdminComponentsProvider (see the admin README). */\nexport default function AdminLayout({ children }: { children: ReactNode }) {\n\treturn <CmsAdminLayout>{children}</CmsAdminLayout>;\n}\n";
export declare const API_ROUTE_TEMPLATE = "import { createCmsRouteHandler } from \"@monti-cms/core/next/route-handler\";\n\n/** Admin API (/api/cms/v1/*) and sign-in (/api/cms/auth/*). */\nexport const { GET, POST, PATCH, PUT, DELETE } = createCmsRouteHandler();\n";
export declare function nextConfigTemplate(config: string, server: string): string;
/** Style lines the admin screen needs. Put them in the app's Tailwind input CSS after `@import "tailwindcss";`. */
export declare const CSS_LINES: readonly ['@import "tw-animate-css";', '@import "@monti-cms/admin/styles.css";', '@plugin "@tailwindcss/typography";'];
/** Packages the app installs (including those the admin package must share with the app). */
export declare const INSTALL_COMMANDS: readonly ["pnpm add @monti-cms/core @monti-cms/admin next-auth@5.0.0-beta.32 next-themes @tanstack/react-query sonner @tiptap/core @tiptap/pm @tiptap/react", "pnpm add -D tw-animate-css @tailwindcss/typography"];
/** Values for `.env.local`. */
export declare const ENV_VARS: readonly {
    readonly name: string;
    readonly note: string;
}[];
