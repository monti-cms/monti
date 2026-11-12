import path from "node:path";
import type { Answers } from "./answers";
import type { Site } from "./detect";

/** The files `monti init` writes for a site, with their text: new files only. What an answer changes is in the text. */

/** A language's own name (Korean in Korean for `ko`), for the schema's language list. */
function languageName(code: string): string {
	try {
		return new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
	} catch {
		return code;
	}
}

const posix = (file: string) => file.split(path.sep).join("/");
/** How one file of the site imports another, without its extension: no alias of the site's is assumed. */
function importPath(from: string, to: string): string {
	const relative = posix(path.relative(path.dirname(from), to)).replace(/\.tsx?$/, "");
	return relative.startsWith(".") ? relative : `./${relative}`;
}

const schemaFile = (answers: Answers) => `import { defineSchema } from "@monti-cms/core";

// The site's structure: its languages, its collections and their fields. The admin's settings write this file on the dev server, so it holds
// values only, no code.
export default defineSchema({
	locales: {
		source: ${JSON.stringify(answers.locale)},
		list: [{ code: ${JSON.stringify(answers.locale)}, name: ${JSON.stringify(languageName(answers.locale))} }],
		prefix: "exceptSource",
	},
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
			},
		},
	},
});
`;

function configFile(answers: Answers): string {
	const imports = ["defineConfig"];
	const lines: string[] = [];
	let storage = "";
	if (answers.storage === "local") {
		imports.push("definePlugin", "localFolderStorage");
		lines.push('import path from "node:path";');
		storage = `	// Media files in a folder on this machine, served by the admin's API. A host that keeps no disk needs a storage plugin instead.
	plugins: [
		definePlugin({
			name: "files",
			storage: localFolderStorage({ dir: path.join(process.cwd(), ".monti", "files"), base: "${answers.adminPath}/api" }),
		}),
	],
`;
	} else if (answers.storage === "s3") {
		imports.push("definePlugin");
		storage = `	// Media files in an S3-compatible storage: its values are the S3_* names in the environment.
	plugins: [definePlugin({ name: "files", storage: s3Storage() })],
`;
	} else
		storage =
			"	// No storage: the media library says so, and no file can be uploaded until a plugin brings one.\n	plugins: [],\n";
	const auth =
		answers.login === "github"
			? `	// The admin signs in with GitHub: the OAuth app's id and secret, and the one GitHub account that is the admin.
	auth: {
		password: false,
		github: {
			clientId: process.env.GITHUB_CLIENT_ID ?? "",
			clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
			admin: process.env.GITHUB_ADMIN ?? "",
		},
	},
`
			: "	// The admin signs in with an email and a password. The first visit to the live site makes the admin.\n	auth: { password: true },\n";
	return `${lines.join("\n")}${lines.length > 0 ? "\n" : ""}import { ${imports.sort().join(", ")} } from "@monti-cms/core";
${answers.storage === "s3" ? 'import { s3Storage } from "@monti-cms/storage-s3";\n' : ""}import schema from "./monti.schema";

// How the site runs Monti: its database, how the admin signs in, where media files go.
export default defineConfig({
	schema,
	database: process.env.DATABASE_URL,
${auth}${storage}});
`;
}

const ENV_EXAMPLE: Record<string, string> = {
	DATABASE_URL:
		"# Postgres. Make Monti's tables once with `monti db:setup`, and follow changes on deploy with `monti db:migrate`.",
	MONTI_SECRET: "# Signs preview links and seals stored keys. Any long random text (openssl rand -base64 32).",
	GITHUB_CLIENT_ID: "# The GitHub OAuth app the admin signs in with, and the GitHub account that is the admin.",
	S3_BUCKET:
		"# The S3-compatible storage for media files (S3_ENDPOINT for a storage that is not AWS, S3_PUBLIC_URL for where files are read).",
};

/** The environment values a site with these answers reads, in the order they are written, with what `.env.local` gets when the value is new. */
export function envValues(site: Site, answers: Answers, secret: string): { name: string; value: string }[] {
	const database = site.name.replace(/^@[^/]+\//, "").replace(/[^a-zA-Z0-9_]/g, "_");
	return [
		{ name: "DATABASE_URL", value: `postgres://localhost/${database}` },
		{ name: "MONTI_SECRET", value: secret },
		...(answers.login === "github"
			? [
					{ name: "GITHUB_CLIENT_ID", value: "" },
					{ name: "GITHUB_CLIENT_SECRET", value: "" },
					{ name: "GITHUB_ADMIN", value: "" },
				]
			: []),
		...(answers.storage === "s3"
			? ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PUBLIC_URL"].map((name) => ({
					name,
					value: "",
				}))
			: []),
	];
}

const envExample = (site: Site, answers: Answers) =>
	`${envValues(site, answers, "")
		.map(
			({ name, value }) =>
				`${ENV_EXAMPLE[name] ? `${ENV_EXAMPLE[name]}\n` : ""}${name}=${name === "MONTI_SECRET" ? "" : value}`,
		)
		.join("\n")}\n`;

/**
 * Every file `monti init` would write, by its path in the site. The admin gets a layout of its own only where the site has no top-level one:
 * under a top-level layout the admin's page is drawn inside it, and a second layout with its own `<html>` would be wrong there.
 */
export function planFiles(site: Site, answers: Answers): { file: string; text: string }[] {
	const app = site.app ?? "app";
	const root = site.src ? "src" : "";
	const admin = path.join(app, answers.adminPath.slice(1));
	const lib = path.join(root, "lib", "monti.ts");
	const page = path.join(admin, "page.tsx");
	const route = path.join(admin, "api", "[...path]", "route.ts");
	const files = [
		{ file: "monti.schema.ts", text: schemaFile(answers) },
		{ file: "monti.config.ts", text: configFile(answers) },
		{
			file: lib,
			text: `import { openSite } from "@monti-cms/next";
import config from "${importPath(lib, "monti.config.ts")}";

// Opens Monti once: \`monti\` for the admin's API, \`reader\` for the site's own pages to read published entries with.
export const { monti, reader } = openSite(config);
`,
		},
		{
			file: page,
			text: `import { AdminPage } from "@monti-cms/next/admin";

// The admin. This folder's name is its address: \`${answers.adminPath}\`.
export default function Admin() {
	return <AdminPage siteName=${JSON.stringify(site.name)} />;
}
`,
		},
		{
			file: route,
			text: `import { adminRoute } from "@monti-cms/next";
import { monti } from "${importPath(route, lib)}";

// The admin's API, the media files it serves, and the preview's on and off.
export const { GET, POST, PUT } = adminRoute(monti);
`,
		},
		...(site.topLayout
			? []
			: [
					{
						file: path.join(admin, "layout.tsx"),
						text: `import type { ReactNode } from "react";

export const metadata = { title: "Monti" };

// The admin's own frame: nothing of the site's layout or styles is loaded here.
export default function Layout({ children }: { children: ReactNode }) {
	return (
		<html lang=${JSON.stringify(answers.locale)}>
			<body>{children}</body>
		</html>
	);
}
`,
					},
				]),
		{ file: ".env.example", text: envExample(site, answers) },
	];
	return files.map(({ file, text }) => ({ file: posix(file), text }));
}
