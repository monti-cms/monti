import { DEFAULT_ADMIN_PATH, isLocalUrl } from "../config/rules.js";
import { printSchemaFile } from "../schema-file/print.js";
import { blockEntry, chosenBlocks } from "./block-choices.js";
import { pathFor, starterCollections } from "./field-mapping.js";
import { DEFAULT_INIT_LOCALE } from "./init-answers.js";
import { languageLabel } from "./locale-names.js";
/** Contents of the files `monti init` creates (developer-facing, so English). A starting point the app edits right away. */
/**
 * The schema file `monti init` creates (`monti.schema.ts`): the `post` collection (and the tag and category collections its front matter asks for), the locales and
 * time zone, the site name and the admin path when it is not the default. It holds the plain data of the site;
 * `monti.config.ts` imports it. It is the text `printSchemaFile` writes, so the admin can rewrite it. With `folder` (a content folder the app
 * already has) the fields follow its front matter, and `path` follows its name.
 */
export function schemaTemplate(answers, options = {}) {
    const [defaultLocale = DEFAULT_INIT_LOCALE] = answers.locales;
    const { collections } = starterCollections(options.folder?.keys ?? [], answers.locales.length > 1);
    const { post, ...related } = collections;
    const schema = {
        schemaVersion: 1,
        collections: {
            post: {
                label: "Post",
                // body, draft and publish. Use "item" for small entries like tags
                kind: "document",
                // public URL shape (a sample; use your own). Used for internal links in the body and preview URLs
                path: pathFor(options.folder),
                icon: "file-text",
                fields: post?.fields,
            },
            ...related,
        },
        locales: answers.locales.map((code) => ({ code, name: languageLabel(code) })),
        defaultLocale,
        timeZone: answers.timeZone,
        site: { name: options.siteName || "My site" },
        ...(answers.adminPath === DEFAULT_ADMIN_PATH ? {} : { admin: { path: answers.adminPath } }),
    };
    return printSchemaFile(schema);
}
/**
 * The config file `monti init` creates: the one place the site is set up. It loads the schema file and lists the plugins, the database and the login, one line each
 * with a short comment. Nothing here is a preset: every line is a feature that is on, and deleting the line turns it off.
 */
export function configTemplate(answers) {
    const blocks = chosenBlocks(answers.blocks);
    const imports = [
        { from: "@monti-cms/auth", names: ["auth"] },
        {
            from: answers.login === "github" ? "@monti-cms/auth/github" : "@monti-cms/auth/password",
            names: [answers.login],
        },
        { from: "@monti-cms/core/server", names: ["defineConfig", "postgres"] },
        { from: "@monti-cms/mdx", names: ["mdx"] },
    ];
    if (answers.directiveSyntax)
        imports.push({ from: "@monti-cms/syntax-directive", names: ["directiveSyntax"] });
    if (answers.ai)
        imports.push({ from: "@monti-cms/ai", names: ["ai"] });
    if (answers.gitSync)
        imports.push({ from: "@monti-cms/git-sync", names: ["gitSync"] });
    if (answers.storage === "s3")
        imports.push({ from: "@monti-cms/storage-s3", names: ["s3Storage"] });
    const light = blocks.filter((block) => !block.needs);
    if (light.length > 0) {
        imports.push({
            from: "@monti-cms/blocks",
            names: light.map((block) => block.fn).sort((a, b) => a.localeCompare(b)),
        });
    }
    // A block that needs a library of its own has its own entry point, so the app that does not choose it never loads that library.
    for (const block of blocks.filter((block) => block.needs))
        imports.push({ from: blockEntry(block), names: [block.fn] });
    imports.sort((a, b) => a.from.localeCompare(b.from));
    const importLines = [
        ...imports.map(({ from, names }) => {
            const line = `import { ${names.join(", ")} } from "${from}";`;
            return line.length <= 100 ? line : `import {\n${names.map((name) => `\t${name},`).join("\n")}\n} from "${from}";`;
        }),
        'import schema from "./monti.schema";',
    ];
    const plugins = answers.directiveSyntax
        ? [
            "// Bodies as MDX (and Markdown) text: read, write and export. Also the source panel in the editor.",
            "// directiveSyntax() reads and writes the ::: blocks (:::callout, :::tabs) your posts use. Without it they are read as code and kept as source.",
            "mdx({ syntax: [directiveSyntax()] }),",
        ]
        : ["// Bodies as MDX (and Markdown) text: read, write and export. Also the source panel in the editor.", "mdx(),"];
    if (blocks.length > 0) {
        plugins.push("// The body blocks, one line each: delete a line and the block is gone. The inline marks (tooltip, code-ref, color) are stored in this order when they overlap.");
        for (const block of blocks)
            plugins.push(`${block.fn}(), // ${block.description}`);
    }
    if (answers.ai) {
        plugins.push("// AI writing: polish, draft and translate buttons, and the AI screen. It renders without a key; a connection is saved on the admin AI screen.", "ai(),");
    }
    if (answers.gitSync) {
        plugins.push("// Two-way sync of published entries with files in a GitHub repo. It syncs nothing until `targets` names a repo:", '//   gitSync({ targets: [{ repo: "you/content", branch: "main", folder: "content", collections: ["post"], mode: "commit" }] })', "gitSync(),");
    }
    const pluginLines = plugins.map((line) => `\t\t${line}`);
    const storage = answers.storage === "s3"
        ? [
            "\t// Image and file uploads on the S3 API (AWS S3, Cloudflare R2, MinIO). It reads the S3_* values from the environment: see .env.example.",
            "\tstorage: s3Storage(),",
        ]
        : [
            "\t// Image and file uploads: none yet, so the admin hides the media menu. pnpm add @monti-cms/storage-s3, import { s3Storage } from it, then:",
            "\t// storage: s3Storage(),",
        ];
    return `${[
        ...importLines,
        "",
        "/**",
        " * The one config of the site, and the CMS instance it makes. The admin API route, the admin screens, your pages (cms.read.getEntry(...)) and the `monti` command all use it.",
        " * It is server-only (it holds the database and login settings): never import it from a client component. `monti doctor` checks that.",
        " *",
        " * The data (collections, fields, locales, time zone, admin path) is in monti.schema.ts: edit it there. This file keeps what needs code. Values come from the",
        " * environment (.env.local); .env.example lists them.",
        " */",
        "export const cms = defineConfig({",
        "\tschema,",
        "\t// The public site URL is read from SITE_URL.",
        "",
        "\tplugins: [",
        ...pluginLines,
        "\t],",
        "",
        "\t// The content database: DATABASE_URL, and DATABASE_SCHEMA when the database is shared.",
        "\tdatabase: postgres(),",
        "",
        ...(answers.login === "github"
            ? [
                "\t// Sign in with GitHub: the OAuth app and the admin come from AUTH_GITHUB_ID, AUTH_GITHUB_SECRET and MONTI_ADMIN_GITHUB_ID (see .env.example).",
                "\t// Under `next dev` you are the admin without signing in, from this machine only.",
                "\tauth: auth({ providers: [github()] }),",
            ]
            : [
                "\t// Sign in with an email and a password, kept in the database above. The first admin is created on the admin screen the first time you open it.",
                "\t// Under `next dev` you are the admin without signing in, from this machine only. A forgotten password: `monti admin:reset-password`.",
                "\tauth: auth({ providers: [password()] }),",
            ]),
        "",
        ...storage,
        "",
        "\t// The one secret, MONTI_SECRET, signs the login session and encrypts stored values (AI keys, git-sync tokens).",
        "});",
    ].join("\n")}\n`;
}
/**
 * The generated files import the CMS instance from the config file. `configImport` is its import path from the generated file, without an extension.
 * `instant`: the app turns on Next's `cacheComponents`, so the page opts out of the development-only instant navigation validation. The export is only valid with that
 * option (Next fails the build on it otherwise), which is why the template writes it only then.
 */
export const adminPageTemplate = (configImport, options = {}) => `import { CmsAdminPage, type CmsAdminPageProps } from "@monti-cms/nextjs/admin";
import { cms } from ${JSON.stringify(configImport)};

${options.instant
    ? `// The admin is a per-request app (the session, the database, the current time), never an instant navigation: this keeps Next's instant validation
// (Cache Components, development) from checking it. A segment setting has to be written here; it cannot be re-exported from a package.
export const instant = false;

`
    : ""}export default function StudioPage(props: CmsAdminPageProps) {
	return <CmsAdminPage cms={cms} {...props} />;
}
`;
export const adminLayoutTemplate = (configImport, options = {}) => `// The admin stylesheets are prebuilt, so the app needs no Tailwind for them, and only the admin pages load them.
import "@monti-cms/admin/styles.css";
${options.blocks ? 'import "@monti-cms/blocks/styles.css";\n' : ""}import { CmsAdminLayout, cmsAdminMetadata } from "@monti-cms/nextjs/admin";
import type { ReactNode } from "react";
import { cms } from ${JSON.stringify(configImport)};

export const generateMetadata = () => cmsAdminMetadata(cms);

// The layout stays apart from the page on purpose: it keeps the admin (navigation, data, theme) mounted while you move between screens.
export default function StudioLayout({ children }: { children: ReactNode }) {
	return <CmsAdminLayout cms={cms}>{children}</CmsAdminLayout>;
}
`;
export const apiRouteTemplate = (configImport) => `import { createRouteHandler } from "@monti-cms/nextjs";
import { cms } from ${JSON.stringify(configImport)};

// The admin API (/api/monti/v1/*) and the sign-in routes (/api/monti/auth/*).
export const { GET, POST, PATCH, PUT, DELETE } = createRouteHandler(cms);
`;
export function nextConfigTemplate() {
    return `import { withCms } from "@monti-cms/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default withCms(nextConfig);
`;
}
/** The OAuth callback URL of the GitHub login for a site URL. */
export const githubCallbackUrl = (siteUrl) => `${siteUrl.replace(/\/+$/, "")}/api/monti/auth/callback/github`;
/** How to add GitHub login to a config that has none: the one how-to `monti init` and `monti doctor` both print. */
export function githubLoginHowTo(siteUrl) {
    return [
        "install @monti-cms/auth, then add `auth: auth({ providers: [github()] })` to defineConfig in monti.config.ts",
        '(import { auth } from "@monti-cms/auth" and { github } from "@monti-cms/auth/github"),',
        "set AUTH_GITHUB_ID and AUTH_GITHUB_SECRET (a GitHub OAuth app: GitHub > Settings > Developer settings > OAuth Apps) and MONTI_ADMIN_GITHUB_ID (your numeric GitHub id, from https://api.github.com/users/<your-login>),",
        `and register ${githubCallbackUrl(siteUrl)} as the OAuth callback URL`,
    ].join(" ");
}
/**
 * `.env.example`: every variable the chosen features read, in order, each with what it is and where to get it. Committed to git, so it holds placeholders only,
 * never a secret. The person copies it to `.env.local` (`cp .env.example .env.local`) and fills it in.
 */
export function envExampleTemplate(answers) {
    const site = answers.siteUrl.replace(/\/+$/, "");
    // A local address is no example of a deployed site.
    const deployedSite = isLocalUrl(site) ? "https://example.com" : site;
    const lines = [
        "# Copy this file to .env.local and fill it in:  cp .env.example .env.local",
        "# .env.local is for this machine only: keep it out of git. This example file is safe to commit, so never put a real secret in it.",
        "# The values right below are the ones you need to run the app on your computer.",
        "",
        "# --- Database ---",
        "",
        "# Any Postgres connection URL: copy it from your database host's dashboard (Neon, Supabase, Vercel Postgres, RDS, ...) or point it at a local Postgres.",
        "# A local Postgres often has no password and uses your computer user name, so after `createdb monti` the URL can be as short as postgres://localhost/monti.",
        "# Neon/Supabase-style URLs with sslmode=require: use sslmode=verify-full instead (same security, no warning from the database driver).",
        "DATABASE_URL=postgres://user:password@host:5432/monti",
        "",
        "# --- Secret ---",
        "",
        "# A long random value that signs login sessions and encrypts stored values (AI keys, git-sync tokens).",
        "# Generate one:  openssl rand -base64 32",
        "# or, without openssl:  node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
        "# Keep the same value on every server of the site; changing it signs everyone out and makes stored values unreadable.",
        "MONTI_SECRET=",
    ];
    if (answers.login === "github") {
        lines.push("", "# --- Login with GitHub ---", "", "# A GitHub OAuth app: GitHub > Settings > Developer settings > OAuth Apps > New OAuth App.", `# Homepage URL: ${site}`, `# Authorization callback URL: ${githubCallbackUrl(site)}`, "# Register one app per address (the local one and the deployed one), or one callback URL per app.", "# Its Client ID, then a client secret you generate on the same page:", "AUTH_GITHUB_ID=", "AUTH_GITHUB_SECRET=", "", "# Who is an admin: your numeric GitHub id, not your login (a login can be renamed and then taken by someone else).", '# Open https://api.github.com/users/<your-github-login> in a browser and copy the number after "id". Several ids go in one value, separated by commas.', "MONTI_ADMIN_GITHUB_ID=");
    }
    if (answers.storage === "s3") {
        lines.push("", "# --- Image storage (S3, Cloudflare R2, MinIO) ---", "", "# Where the S3 API lives. AWS S3: leave empty. Cloudflare R2: https://<account-id>.r2.cloudflarestorage.com (R2 dashboard > bucket > Settings). MinIO: http://localhost:9000.", "S3_ENDPOINT=", "# The bucket's region (AWS: e.g. us-east-1). Cloudflare R2: auto.", "S3_REGION=", "# The bucket name; create the bucket in your storage dashboard first.", "S3_BUCKET=", "# An access key with read and write on that bucket. AWS: IAM > Users > Security credentials. R2: R2 > Manage API tokens. MinIO: the console's Access Keys.", "S3_ACCESS_KEY_ID=", "S3_SECRET_ACCESS_KEY=", "# The start of the public address of uploaded files: a CDN in front of the bucket, or the bucket's public URL (R2: Settings > Public access).", "S3_PUBLIC_URL=", "# MinIO and some other S3-compatible stores need path-style addresses: true.", "# S3_FORCE_PATH_STYLE=true");
    }
    lines.push("", "# --- When you deploy (not needed on your computer) ---", "# Leave these commented out while you work locally. Remove the # when your deployed site needs one.", "", "# Your site's public address, e.g. https://example.com. Used for login links and to recognise links to your own site.", `# SITE_URL=${deployedSite}`, "", "# Only if you run your own proxy such as nginx. Not needed on Vercel, Netlify or Cloudflare.", "# AUTH_TRUST_HOST=true", "", "# Only if the database is shared with other apps: Monti's tables then live in their own schema instead of public.", "# DATABASE_SCHEMA=monti");
    return `${lines.join("\n")}\n`;
}
