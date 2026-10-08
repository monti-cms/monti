import { DEFAULT_ADMIN_PATH } from "../config/define";
import { CMS_STATE_KEYS, DATE_KEYS, LOCALE_KEYS, RELATION_KEYS, SUMMARY_KEYS } from "./front-matter-keys";
import type { ContentFolder, FrontMatterKey } from "./init-detect";
import { SCHEMA_LINK } from "./schema-types";

/** Contents of the files `monti init` creates (developer-facing, so English). A starting point the app edits right away. */

/** Defaults `monti init` writes into a new config. */
export const DEFAULT_INIT_LOCALE = "en";
export const DEFAULT_INIT_TIME_ZONE = "UTC";
/** The admin path `monti init` asks for and writes by default. */
export const DEFAULT_INIT_ADMIN_PATH = "/studio";
export const DEFAULT_SITE_URL = "http://localhost:3000";

/** A body block or inline mark of `@monti-cms/blocks`, as `monti init` offers it. */
export interface BlockChoice {
	/** The name used in flags (`--blocks callout,tabs`). */
	readonly id: string;
	/** The function listed in `plugins`: exported by `@monti-cms/blocks`, or by `@monti-cms/blocks/<id>` for a block with a `needs` (the heavy ones, so the barrel never loads their library). */
	readonly fn: string;
	/** One line for the list and for the comment in the config. */
	readonly description: string;
	/** An npm package the block needs besides `@monti-cms/blocks`. */
	readonly needs?: string;
	/** Why the block is not in the default set: what it adds to the app. Set only for blocks that are opt-in. */
	readonly heavy?: string;
}

/** Every block of `@monti-cms/blocks`, in the order the plugins are listed (the inline marks last: overlapping marks are stored in this order). */
export const BLOCK_CHOICES: readonly BlockChoice[] = [
	{ id: "callout", fn: "callout", description: "note, tip and warning boxes" },
	{ id: "collapsible", fn: "collapsible", description: "a section that opens and closes" },
	{ id: "tabs", fn: "tabs", description: "content split into tabs" },
	{ id: "columns", fn: "columns", description: "side-by-side columns" },
	{ id: "code-explorer", fn: "codeExplorer", description: "code with a file tree and several files" },
	{
		id: "mermaid",
		fn: "mermaid",
		description: "diagrams written in Mermaid",
		needs: "mermaid",
		heavy: "the mermaid package alone is about 26 MB in node_modules and loads a large script in the browser",
	},
	{
		id: "chart",
		fn: "chart",
		description: "bar, line and pie charts",
		needs: "recharts",
		heavy: "it adds recharts and its dependencies (d3), which is a large script for the pages that show a chart",
	},
	{ id: "tooltip", fn: "tooltip", description: "inline text with a hover explanation" },
	{ id: "code-ref", fn: "codeRef", description: "inline link from a phrase to a line of code" },
	{ id: "color", fn: "color", description: "inline text color" },
];

/**
 * The blocks `monti init` turns on when nobody chose: the light ones. The heavy ones (`mermaid`, `chart`) are opt-in (`--blocks all` or a list that names them),
 * because each adds a large package to the app. `columns`, `code-explorer` and `tooltip` are also left out: they are small, but a first blog rarely needs them.
 */
export const DEFAULT_BLOCK_IDS: readonly string[] = ["callout", "collapsible", "tabs", "code-ref", "color"];

/** What the questions of `monti init` decided. Every field has a flag. */
export interface InitAnswers {
	/** The Postgres schema for the tables (`DATABASE_SCHEMA`), if given: an example value in `.env.example`. Without it the tables go in `public`. */
	readonly databaseSchema?: string;
	/** Numeric GitHub id of the admin (`MONTI_ADMIN_GITHUB_ID`), if given: filled in `.env.example` (it is public, not a secret). */
	readonly adminGithubId?: string;
	/** Public URL of the site, for the OAuth callback URL. */
	readonly siteUrl: string;
	/** Locale codes, the default first. */
	readonly locales: readonly string[];
	readonly timeZone: string;
	readonly storage: "none" | "s3";
	readonly ai: boolean;
	readonly gitSync: boolean;
	/** Ids of {@link BLOCK_CHOICES}. */
	readonly blocks: readonly string[];
	readonly adminPath: string;
}

/** The language's name in that language for a locale code (e.g. `ko` -> `한국어`). Falls back to the code itself. */
function languageName(code: string): string {
	try {
		return new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
	} catch {
		return code;
	}
}

const sentenceCase = (key: string): string => {
	const words = key
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[-_]+/g, " ")
		.trim()
		.toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The field names the starter collection always has. */
const STARTER_FIELDS = new Set(["title", "slug"]);
const IMAGE_KEYS = ["image", "cover", "coverimage", "thumbnail", "heroimage", "ogimage", "banner", "featuredimage"];

/** A key from front matter as a field name: kept as it is when it is one word of letters and digits, else camel-cased. `undefined` if nothing usable is left. */
export function fieldNameOf(key: string): string | undefined {
	if (/^[A-Za-z][A-Za-z0-9]*$/.test(key)) return key;
	const words = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
	if (words.length === 0 || !/^[A-Za-z]/.test(words[0] ?? "")) return undefined;
	return words.map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))).join("");
}

type SchemaField = Record<string, unknown>;

/** What the starter schema holds, and what was decided on the way (for the init report). */
export interface StarterSchema {
	/** `post` first, then the collections its relations point to. */
	readonly collections: Record<string, { readonly fields: Record<string, SchemaField> } & Record<string, unknown>>;
	/** Plain-words lines about front matter keys that got a relation, or that need no field. */
	readonly notes: string[];
}

const itemCollection = (label: string, icon: string, multiLocale: boolean) => ({
	label,
	// small entries that posts point to (see "item" in the collection docs)
	kind: "item",
	icon,
	fields: {
		title: { kind: "text", label: "Name", required: true, ...(multiLocale ? { localized: true } : {}), max: 200 },
		slug: { kind: "slug", label: "Address", required: true, from: "title" },
	} as Record<string, SchemaField>,
});

/**
 * The collections of the starter schema: `post` with the fields every blog has, then (when a content folder was found) one field per front matter key, read by the
 * table in `front-matter-keys.ts`:
 *
 * - `date` and the other publish date keys get no field: the entry has its own publish date.
 * - `description`, `summary`, `excerpt` and the like become the field with the `summary` role.
 * - `tags` (also `keywords`, `topics`) become the collection `tag` and a relation `tagIds`. `category` becomes `category` and `categoryId`, and `categories` (a list)
 *   `categoryIds`.
 * - `draft`, `published` and the language keys are the CMS's own and get no field.
 */
export function starterCollections(keys: readonly FrontMatterKey[], multiLocale: boolean): StarterSchema {
	const localized = multiLocale ? { localized: true } : {};
	const fields: Record<string, SchemaField> = {
		// the title field is named `title` (the label is up to you)
		title: { kind: "text", label: "Title", required: true, ...localized, max: 200 },
		slug: {
			kind: "slug",
			label: "Slug",
			required: true,
			...(multiLocale ? { localized: "inherit" } : {}),
			from: "title",
		},
	};
	const notes: string[] = [];
	const relationKeys = new Map<string, string>();
	let summaryName: string | undefined;
	const extra: Record<string, SchemaField> = {};
	for (const key of keys.slice(0, 16)) {
		const name = fieldNameOf(key.name);
		const lower = key.name.toLowerCase();
		if (!name || STARTER_FIELDS.has(name) || STARTER_FIELDS.has(lower) || CMS_STATE_KEYS.has(lower) || name in extra)
			continue;
		if (DATE_KEYS.has(lower)) {
			notes.push(
				`"${key.name}" is the publish date of an entry, so it has no field of its own (import fills the date).`,
			);
			continue;
		}
		if (LOCALE_KEYS.has(lower)) continue;
		const target = RELATION_KEYS[lower];
		if (target === "tag" || target === "category") {
			if (relationKeys.has(target)) {
				notes.push(
					`"${key.name}" also means ${target}, which "${relationKeys.get(target)}" already fills, so import skips it.`,
				);
				continue;
			}
			const many = target === "tag" || key.type === "list";
			relationKeys.set(target, key.name);
			extra[`${target}${many ? "Ids" : "Id"}`] = {
				kind: "relation",
				label: target === "tag" ? "Tags" : many ? "Categories" : "Category",
				to: target,
				...(many ? { many: true } : {}),
				createInline: true,
			};
			continue;
		}
		if (summaryName === undefined && SUMMARY_KEYS.has(lower)) {
			summaryName = name;
			extra[name] = {
				kind: "text",
				label: sentenceCase(key.name),
				role: "summary",
				multiline: true,
				fillFromBody: true,
				...localized,
			};
		} else if (IMAGE_KEYS.includes(lower) && key.type === "string") {
			extra[name] = { kind: "media", label: sentenceCase(key.name), accept: "image" };
		} else {
			const note =
				key.type === "list"
					? "A list in your front matter; kept as text (one value per line) until you model it"
					: key.type === "date"
						? "A date in your front matter; kept as text (YYYY-MM-DD)"
						: undefined;
			extra[name] = { kind: "text", label: sentenceCase(key.name), ...(note ? { description: note } : {}) };
		}
	}
	if (summaryName === undefined) {
		fields.summary = {
			kind: "text",
			label: "Summary",
			role: "summary",
			multiline: true,
			fillFromBody: true,
			...localized,
		};
	}
	const collections: StarterSchema["collections"] = { post: { fields: { ...fields, ...extra } } };
	if (relationKeys.has("tag")) collections.tag = itemCollection("Tag", "tag", multiLocale);
	if (relationKeys.has("category")) collections.category = itemCollection("Category", "shapes", multiLocale);
	for (const [target, key] of relationKeys) {
		notes.push(`"${key}" becomes the ${target} collection and a relation field on post.`);
	}
	return { collections, notes };
}

/** The public address shape for a content folder: its last folder name (`content/blog` -> `/blog/:slug`), else `/posts/:slug`. */
export function pathFor(folder: ContentFolder | undefined): string {
	const last = folder?.dir.split("/").at(-1) ?? "";
	return /^[A-Za-z][\w-]*$/.test(last) && !["content", "data", "src", "_posts"].includes(last)
		? `/${last}/:slug`
		: "/posts/:slug";
}

/**
 * The schema file `monti init` creates (`monti.schema.json`): the `post` collection (and the tag and category collections its front matter asks for), the locales and
 * time zone, the site name and the admin path when it is not the default. It holds the plain data of the site;
 * `monti.config.ts` loads it. `link` is the path of the JSON Schema from the schema file (editors use it for autocomplete). With `folder` (a content folder the app
 * already has) the fields follow its front matter, and `path` follows its name.
 */
export function schemaTemplate(
	answers: Pick<InitAnswers, "adminPath" | "locales" | "timeZone">,
	options: { readonly siteName?: string; readonly folder?: ContentFolder; readonly link?: string } = {},
): string {
	const [defaultLocale = DEFAULT_INIT_LOCALE] = answers.locales;
	const { collections } = starterCollections(options.folder?.keys ?? [], answers.locales.length > 1);
	const { post, ...related } = collections;
	const schema = {
		$schema: options.link ?? SCHEMA_LINK,
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
		locales: answers.locales.map((code) => ({ code, name: languageName(code) })),
		defaultLocale,
		timeZone: answers.timeZone,
		site: { name: options.siteName || "My site" },
		...(answers.adminPath === DEFAULT_ADMIN_PATH ? {} : { admin: { path: answers.adminPath } }),
	};
	return `${JSON.stringify(schema, null, "\t")}\n`;
}

/** The module a block's function is imported from. */
export const blockEntry = (block: BlockChoice): string =>
	block.needs ? `@monti-cms/blocks/${block.id}` : "@monti-cms/blocks";

const unique = <T>(values: readonly T[]) => [...new Set(values)];

/** The block choices for the ids, in the order of {@link BLOCK_CHOICES}. */
export const chosenBlocks = (ids: readonly string[]): readonly BlockChoice[] =>
	BLOCK_CHOICES.filter((block) => ids.includes(block.id));

/**
 * The config file `monti init` creates: the one place the site is set up. It loads the schema file and lists the plugins, the database and the login, one line each
 * with a short comment. Nothing here is a preset: every line is a feature that is on, and deleting the line turns it off.
 */
export function configTemplate(answers: InitAnswers): string {
	const blocks = chosenBlocks(answers.blocks);
	const imports: { from: string; names: string[] }[] = [
		{ from: "@monti-cms/auth", names: ["auth"] },
		{ from: "@monti-cms/auth/github", names: ["github"] },
		{ from: "@monti-cms/core/server", names: ["defineConfig", "postgres"] },
		{ from: "@monti-cms/mdx", names: ["mdx"] },
	];
	if (answers.ai) imports.push({ from: "@monti-cms/ai", names: ["aiPlugin"] });
	if (answers.gitSync) imports.push({ from: "@monti-cms/git-sync", names: ["gitSync"] });
	if (answers.storage === "s3") imports.push({ from: "@monti-cms/storage-s3", names: ["s3Storage"] });
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
		'import schema from "./monti.schema.json";',
	];

	const plugins: string[] = [
		"// Bodies as MDX (and Markdown) text: read, write and export. Also the source panel in the editor.",
		"mdx(),",
	];
	if (blocks.length > 0) {
		plugins.push(
			"// The body blocks, one line each: delete a line and the block is gone. The inline marks (tooltip, code-ref, color) are stored in this order when they overlap.",
		);
		for (const block of blocks) plugins.push(`${block.fn}(), // ${block.description}`);
	}
	if (answers.ai) {
		plugins.push(
			"// AI writing: polish, draft and translate buttons, and the AI screen. It renders without a key; a connection is saved on the admin AI screen.",
			"aiPlugin(),",
		);
	}
	if (answers.gitSync) {
		plugins.push(
			"// Two-way sync of published entries with files in a GitHub repo. It syncs nothing until `targets` names a repo:",
			'//   gitSync({ targets: [{ repo: "you/content", branch: "main", folder: "content", collections: ["post"], mode: "commit" }] })',
			"gitSync(),",
		);
	}
	const pluginLines = plugins.map((line) => `\t\t${line}`);

	const storage =
		answers.storage === "s3"
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
		" * The data (collections, fields, locales, time zone, admin path) is in monti.schema.json: edit it there. This file keeps what needs code. Values come from the",
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
		"\t// The admin login: AUTH_GITHUB_ID and AUTH_GITHUB_SECRET (your GitHub OAuth app) and MONTI_ADMIN_GITHUB_ID (the admin's numeric GitHub id).",
		"\t// Under `next dev` you are signed in as the admin without any of them, from this machine only; production never does that.",
		"\tauth: auth({ providers: [github()] }),",
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
export const adminPageTemplate = (
	configImport: string,
	options: { readonly instant?: boolean } = {},
) => `import { CmsAdminPage, type CmsAdminPageProps } from "@monti-cms/nextjs/admin";
import { cms } from ${JSON.stringify(configImport)};

${
	options.instant
		? `// The admin is a per-request app (the session, the database, the current time), never an instant navigation: this keeps Next's instant validation
// (Cache Components, development) from checking it. A segment setting has to be written here; it cannot be re-exported from a package.
export const instant = false;

`
		: ""
}export default function StudioPage(props: CmsAdminPageProps) {
	return <CmsAdminPage cms={cms} {...props} />;
}
`;

export const adminLayoutTemplate = (
	configImport: string,
	options: { readonly blocks?: boolean } = {},
) => `// The admin stylesheets are prebuilt, so the app needs no Tailwind for them, and only the admin pages load them.
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

export const apiRouteTemplate = (configImport: string) => `import { createRouteHandler } from "@monti-cms/nextjs";
import { cms } from ${JSON.stringify(configImport)};

// The admin API (/api/cms/v1/*) and the sign-in routes (/api/cms/auth/*).
export const { GET, POST, PATCH, PUT, DELETE } = createRouteHandler(cms);
`;

export function nextConfigTemplate(): string {
	return `import { withCms } from "@monti-cms/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default withCms(nextConfig);
`;
}

/** The OAuth callback URL of the GitHub login for a site URL. */
export const githubCallbackUrl = (siteUrl: string) => `${siteUrl.replace(/\/+$/, "")}/api/cms/auth/callback/github`;

/**
 * `.env.example`: every variable the chosen features read, in order, each with what it is and where to get it. Committed to git, so it holds placeholders only,
 * never a secret. The person copies it to `.env.local` (`cp .env.example .env.local`) and fills it in.
 */
export function envExampleTemplate(answers: InitAnswers): string {
	const site = answers.siteUrl.replace(/\/+$/, "");
	const lines: string[] = [
		"# Copy this file to .env.local and fill it in:  cp .env.example .env.local",
		"# .env.local is for this machine only: keep it out of git. This example file is safe to commit, so never put a real secret in it.",
		"",
		"# --- Database ---",
		"",
		"# Postgres connection URL. Get it from your database host's dashboard (Neon, Supabase, Vercel Postgres, RDS, ...),",
		"# or use a local Postgres: postgres://postgres:postgres@localhost:5432/monti (create the database first: createdb monti).",
		"DATABASE_URL=postgres://user:password@localhost:5432/monti",
		"",
		"# Postgres schema for the tables. Optional: empty means public. Use one when the database is shared with other apps.",
		answers.databaseSchema ? `DATABASE_SCHEMA=${answers.databaseSchema}` : "# DATABASE_SCHEMA=monti",
		"",
		"# --- Secret ---",
		"",
		"# A long random value that signs login sessions and encrypts stored values (AI keys, git-sync tokens).",
		"# Generate one:  openssl rand -base64 32",
		"# or, without openssl:  node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
		"# Keep the same value on every server of the site; changing it signs everyone out and makes stored values unreadable.",
		"MONTI_SECRET=",
		"",
		"# --- Admin login (GitHub) ---",
		"",
		"# Under `next dev` you are signed in as the admin without these, from this machine only. A deployed site needs them.",
		"# Create a GitHub OAuth app:  GitHub > Settings > Developer settings > OAuth Apps > New OAuth App",
		`#   Homepage URL:               ${site}`,
		`#   Authorization callback URL: ${githubCallbackUrl(site)}`,
		"# For the deployed site make a second OAuth app (or add its URL the same way), e.g. https://your-domain.com/api/cms/auth/callback/github",
		"# Then copy the app's Client ID here, and generate a new client secret and copy it to AUTH_GITHUB_SECRET.",
		"AUTH_GITHUB_ID=",
		"AUTH_GITHUB_SECRET=",
		"",
		'# Your numeric GitHub id: the only account that may sign in as admin. Open https://api.github.com/users/<your-login> and copy the "id" field.',
		`MONTI_ADMIN_GITHUB_ID=${answers.adminGithubId ?? ""}`,
		"",
		"# --- Site ---",
		"",
		"# Public URL of the site. Links in bodies written as full URLs to it count as internal links.",
		`# SITE_URL=${site}`,
		"",
		"# Set to true only behind a proxy you run yourself (nginx, a load balancer). Vercel, Netlify and Cloudflare Pages are detected.",
		"# AUTH_TRUST_HOST=true",
	];
	if (answers.storage === "s3") {
		lines.push(
			"",
			"# --- Image storage (S3, Cloudflare R2, MinIO) ---",
			"",
			"# Where the S3 API lives. AWS S3: leave empty. Cloudflare R2: https://<account-id>.r2.cloudflarestorage.com (R2 dashboard > bucket > Settings). MinIO: http://localhost:9000.",
			"S3_ENDPOINT=",
			"# The bucket's region (AWS: e.g. us-east-1). Cloudflare R2: auto.",
			"S3_REGION=",
			"# The bucket name; create the bucket in your storage dashboard first.",
			"S3_BUCKET=",
			"# An access key with read and write on that bucket. AWS: IAM > Users > Security credentials. R2: R2 > Manage API tokens. MinIO: the console's Access Keys.",
			"S3_ACCESS_KEY_ID=",
			"S3_SECRET_ACCESS_KEY=",
			"# The start of the public address of uploaded files: a CDN in front of the bucket, or the bucket's public URL (R2: Settings > Public access).",
			"S3_PUBLIC_URL=",
			"# MinIO and some other S3-compatible stores need path-style addresses: true.",
			"# S3_FORCE_PATH_STYLE=true",
		);
	}
	return `${lines.join("\n")}\n`;
}

/** The npm packages the answers need, besides what the app already lists. */
export function packagesFor(answers: InitAnswers): string[] {
	const blocks = chosenBlocks(answers.blocks);
	return unique([
		"@monti-cms/core",
		"@monti-cms/admin",
		"@monti-cms/auth",
		"@monti-cms/nextjs",
		"@monti-cms/mdx",
		"next-themes",
		"@tanstack/react-query",
		"sonner",
		"@tiptap/core",
		"@tiptap/pm",
		"@tiptap/react",
		...(blocks.length > 0 ? ["@monti-cms/blocks", "lucide-react"] : []),
		...blocks.flatMap((block) => (block.needs ? [block.needs] : [])),
		...(answers.ai ? ["@monti-cms/ai"] : []),
		...(answers.gitSync ? ["@monti-cms/git-sync"] : []),
		...(answers.storage === "s3" ? ["@monti-cms/storage-s3"] : []),
	]);
}
