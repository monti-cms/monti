import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, vi } from "vitest";
import type { DoctorReport, DoctorResult } from "../doctor";
import { generateSchemaTypes } from "../schema-types";

/** Shared by the tests of `monti doctor`: fixture Next apps in temp folders whose config file is the real thing, and a way to set the environment they read. */

/** `packages/core/src`. */
export const CORE_SRC = path.resolve(import.meta.dirname, "../..");
/** `packages/auth/src`: the fixtures log in with the real `auth()` and `github()`. */
const AUTH_SRC = path.resolve(CORE_SRC, "../../auth/src");

/** Every variable doctor looks at. Each test starts with all of them empty. */
const VARIABLES = [
	"DATABASE_URL",
	"DATABASE_SCHEMA",
	"MONTI_SECRET",
	"CMS_SECRET",
	"AUTH_SECRET",
	"AUTH_GITHUB_ID",
	"AUTH_GITHUB_SECRET",
	"MONTI_ADMIN_GITHUB_ID",
	"SITE_URL",
	"AUTH_URL",
	"NEXTAUTH_URL",
	"AUTH_TRUST_HOST",
	"CMS_DATABASE_URL",
	"CMS_SCHEMA",
	"CMS_ADMIN_GITHUB_ID",
	"CMS_DEV_AUTH_BYPASS",
	"CMS_CONFIG_PATH",
	"HOST_URL",
	"MONTI_CONFIG_PATH",
	"VERCEL",
	"NETLIFY",
	"CF_PAGES",
	"RENDER",
	"RAILWAY_ENVIRONMENT",
	"FLY_APP_NAME",
	"K_SERVICE",
];

/** Empties the variables doctor looks at, then sets the given ones, for the rest of the test. */
export function setEnv(values: Record<string, string> = {}): void {
	for (const name of VARIABLES) vi.stubEnv(name, "");
	for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

let dirs: string[] = [];
afterEach(() => {
	vi.unstubAllEnvs();
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});

/** A schema file with one collection; `admin.path` is `/studio`. */
export const SCHEMA_TEXT = `${JSON.stringify(
	{
		collections: {
			post: {
				label: "Post",
				kind: "document",
				path: "/posts/:slug",
				fields: {
					title: { kind: "text", label: "Title", required: true },
					slug: { kind: "slug", label: "Slug", from: "title" },
				},
			},
		},
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
		admin: { path: "/studio" },
	},
	null,
	"\t",
)}\n`;

/** A config file made of the real `defineConfig`, `postgres()`, `auth()` and `github()`, loaded from their sources. `plugins` is source text for the list. */
export const configText = (
	plugins = "",
	imports = "",
): string => `import { defineConfig, postgres } from ${JSON.stringify(path.join(CORE_SRC, "server/index.ts"))};
import { auth } from ${JSON.stringify(path.join(AUTH_SRC, "index.ts"))};
import { github } from ${JSON.stringify(path.join(AUTH_SRC, "github.ts"))};
${imports}
import schema from "./monti.schema.json";

export const cms = defineConfig({
	schema,
	plugins: [${plugins}],
	database: postgres(),
	auth: auth({ providers: [github()] }),
});
`;

/** The three Next files `monti init` writes, plus the Next config and package.json. */
export const NEXT_FILES: Record<string, string> = {
	"package.json": JSON.stringify({ name: "blog", dependencies: { next: "16.3.8" } }),
	"next.config.ts": 'import { withCms } from "@monti-cms/nextjs/config";\nexport default withCms({});\n',
	"app/studio/layout.tsx": "export default function L() { return <CmsAdminLayout cms={cms} />; }\n",
	"app/studio/[[...path]]/page.tsx": "export default function P() { return <CmsAdminPage cms={cms} />; }\n",
	"app/api/cms/[...path]/route.ts": "export const { GET } = createRouteHandler(cms);\n",
	".gitignore": "node_modules\n.env*\n",
};

/** A healthy app folder: config, schema, generated types, the Next files. Extra files replace or (with `null`) remove these. */
export function project(files: Record<string, string | null> = {}): string {
	const dir = mkdtempSync(path.join(tmpdir(), "monti-doctor-"));
	dirs.push(dir);
	const all: Record<string, string | null> = {
		"monti.config.ts": configText(),
		"monti.schema.json": SCHEMA_TEXT,
		...NEXT_FILES,
		...files,
	};
	for (const [file, content] of Object.entries(all)) {
		if (content === null) continue;
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), content);
	}
	if (all["monti.schema.json"] !== null) generateSchemaTypes({ cwd: dir });
	return dir;
}

export const byId = (report: DoctorReport, id: string): DoctorResult => {
	const found = report.checks.find((check) => check.id === id);
	if (!found) throw new Error(`no check ${id}; there are: ${report.checks.map((check) => check.id).join(", ")}`);
	return found;
};

export const statusesOf = (report: DoctorReport): Record<string, string> =>
	Object.fromEntries(report.checks.map((check) => [check.id, check.status]));
