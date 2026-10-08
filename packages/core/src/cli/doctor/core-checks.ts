import { type Dirent, existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Cms } from "../../cms";
import { type CheckOutcome, fail, ok, skip, warn } from "../../plugin/doctor";
import { formatDecision } from "../../server/decision";
import { findRootLayout, hasSuppressHydrationWarning } from "../first-run";
import { findBoundaryViolations, importsOf, sourceFiles } from "../import-boundary";
import { ignoresEnvLocal, NEXT_CONFIG_FILES } from "../init-detect";
import { findSchemaFile, generateSchemaTypes, readSchema, SCHEMA_TYPES_FILE } from "../schema-types";

/** Everything the core checks look at, gathered once before they run. */
export interface DoctorState {
	readonly cwd: string;
	readonly env: Readonly<Record<string, string | undefined>>;
	/** Env files that were read (relative to `cwd`). */
	readonly envFiles: readonly string[];
	/** Set when an env file chosen with `--env-file` does not exist. */
	readonly envError?: Error;
	/** The variables of each env file that exists, by file. Used to say where a value is set. */
	readonly envSources: ReadonlyMap<string, Readonly<Record<string, string>>>;
	/** The config file (relative to `cwd`), when one was found. */
	readonly configPath?: string;
	/** Why no config file was found. */
	readonly configError?: Error;
	/** The text of the config file. */
	readonly configText?: string;
	/** The instance, when the config file loaded. */
	readonly cms?: Cms;
	/** Why the config file did not load. */
	readonly loadError?: unknown;
}

export interface CoreCheck {
	readonly group: string;
	readonly id: string;
	readonly title: string;
	/** Needs the loaded instance. Reported as skipped when the config did not load. */
	readonly needsCms?: boolean;
	run(state: DoctorState): CheckOutcome | Promise<CheckOutcome>;
}

const posix = (file: string) => file.split(path.sep).join("/");
const exists = (state: DoctorState, file: string) => existsSync(path.join(state.cwd, file));
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Where a variable is set, for the `where` of a message: the env files that define it, else the environment. */
export function whereSet(state: DoctorState, name: string): string {
	const files = [...state.envSources].filter(([, values]) => name in values).map(([file]) => file);
	return files.length > 0 ? files.join(", ") : "the environment";
}

/** Where a variable should be set, when it is not. */
const WHERE_TO_SET = ".env.local (and the environment settings of your host)";

// ---- config ----

const envFiles: CoreCheck = {
	group: "config",
	id: "env-files",
	title: "Env files",
	run: (state) => {
		if (state.envError) {
			return fail(state.envError.message, {
				where: "the --env-file option",
				fix: "create the file or correct the path, or use --no-env-file to read none",
			});
		}
		return state.envFiles.length > 0
			? ok(`read ${state.envFiles.join(", ")}`)
			: ok("no .env.local or .env here, so only the environment of the shell is used");
	},
};

const envIgnored: CoreCheck = {
	group: "config",
	id: "env-ignored",
	title: ".env.local kept out of git",
	run: (state) => {
		if (!exists(state, ".env.local")) return skip("not checked: there is no .env.local");
		if (!exists(state, ".gitignore")) return skip("not checked: there is no .gitignore in this folder");
		const ignored = ignoresEnvLocal(readFileSync(path.join(state.cwd, ".gitignore"), "utf8"));
		return ignored
			? ok(".env.local is in .gitignore")
			: warn(".env.local holds secrets (MONTI_SECRET, the database URL) but .gitignore does not list it", {
					where: ".gitignore",
					fix: "add a line `.env.local` to .gitignore; if it was already committed, rotate the secrets in it",
				});
	},
};

const configFile: CoreCheck = {
	group: "config",
	id: "file",
	title: "Config file",
	run: (state) =>
		state.configPath
			? ok(state.configPath)
			: fail("no monti.config.ts found", {
					where: `${state.cwd} (also looked under src/)`,
					fix: "run `monti` from the folder of your Next app; `monti init` creates the config file in an app that has none. If it lives elsewhere, pass --config <path> or set MONTI_CONFIG_PATH",
				}),
};

/** The first `Cannot find package 'x'` of a load error. */
const missingPackage = (error: unknown): string | undefined =>
	/Cannot find (?:package|module) '([^']+)'/.exec(messageOf(error))?.[1];

const configLoads: CoreCheck = {
	group: "config",
	id: "loads",
	title: "Config loads",
	run: (state) => {
		if (!state.configPath) return skip("not checked: no config file (see above)");
		if (state.cms) {
			return ok(`${state.configPath} loads and exports the CMS instance (${state.cms.site.plugins.length} plugins)`);
		}
		const message = messageOf(state.loadError);
		const missing = missingPackage(state.loadError);
		return fail(`${state.configPath} did not load: ${message.split("\n")[0]}`, {
			where: state.configPath,
			fix: missing
				? `install the package it imports (\`${missing.startsWith(".") ? "check the path of the import" : `add ${missing} with your package manager`}\`), then run \`monti doctor\` again`
				: "fix the error above in the config file (the full message is printed by `monti migrate`), then run `monti doctor` again",
		});
	},
};

/** Provenance: every value Monti picked on its own, with where it came from (`set in monti.config.ts`, `from env X`, or `auto-detected (reason)`). */
const automatic: CoreCheck = {
	group: "config",
	id: "automatic",
	title: "What Monti decided on its own",
	needsCms: true,
	run: (state) => {
		const decisions = state.cms?.decisions(state.env) ?? [];
		return ok(decisions.map((decision) => `${formatDecision(decision)}`).join("\n"));
	},
};

const boundary: CoreCheck = {
	group: "config",
	id: "boundary",
	title: "No client code imports the config",
	run: (state) => {
		let violations: ReturnType<typeof findBoundaryViolations>;
		try {
			violations = findBoundaryViolations(state.cwd);
		} catch (error) {
			return fail(`could not read the source files: ${messageOf(error)}`, {
				where: state.cwd,
				fix: "run `monti doctor` in the folder of your app",
			});
		}
		if (violations.length === 0) return ok('no "use client" file imports monti.config.ts or server-only code');
		const shown = violations.slice(0, 6).map((violation) => `${violation.chain.join(" -> ")}`);
		const more = violations.length > shown.length ? [`... and ${violations.length - shown.length} more`] : [];
		return fail(
			`${violations.length} import chain${violations.length === 1 ? "" : "s"} from a client component reach${violations.length === 1 ? "es" : ""} server-only code:\n${[...shown, ...more].join("\n")}`,
			{
				where: [...new Set(violations.map((violation) => violation.client))].slice(0, 4).join(", "),
				fix: "monti.config.ts holds the database and login settings and must stay on the server. Import it from a server file instead (a server component, a route file, a script); a client component gets data as props or through the API route",
			},
		);
	},
};

// ---- schema ----

const schemaFileOf = (state: DoctorState): string | undefined => {
	const fromCms = state.cms?.schemaFile();
	if (fromCms) return posix(path.relative(state.cwd, fromCms));
	try {
		return findSchemaFile(state.cwd);
	} catch {
		return undefined;
	}
};

const schemaFile: CoreCheck = {
	group: "schema",
	id: "file",
	title: "Schema file",
	run: (state) => {
		const file = schemaFileOf(state);
		if (!file) {
			if (state.cms && state.cms.site.COLLECTIONS.length > 0) {
				return ok(
					`no monti.schema.json: the collections (${state.cms.site.COLLECTIONS.join(", ")}) are written in the config file`,
				);
			}
			return warn("no monti.schema.json found", {
				where: state.cwd,
				fix: "`monti init` writes one; or `monti schema:extract` makes it from collections written in code",
			});
		}
		try {
			const schema = readSchema(state.cwd, file);
			const collections = Object.keys(schema.collections ?? {});
			return ok(
				`${file} is valid (${collections.length} collection${collections.length === 1 ? "" : "s"}: ${collections.join(", ") || "none"})`,
			);
		} catch (error) {
			return fail(messageOf(error), {
				where: file,
				fix: `correct the lines above in ${file}; the "$schema" link at the top of the file gives your editor autocomplete and shows these errors as you type`,
			});
		}
	},
};

const schemaTypes: CoreCheck = {
	group: "schema",
	id: "types",
	title: "Generated types are fresh",
	run: (state) => {
		const file = schemaFileOf(state);
		if (!file) return skip("not checked: no schema file");
		try {
			const result = generateSchemaTypes({ cwd: state.cwd, schema: file, check: true });
			return result.changed
				? warn(
						`${result.out} is ${exists(state, result.out) ? "out of date" : "missing"}, so collection names and fields are not typed from ${file}`,
						{
							where: result.out,
							fix: `run \`monti schema:types\` (\`next dev\` also keeps ${SCHEMA_TYPES_FILE} fresh while it runs); commit the result`,
						},
					)
				: ok(`${result.out} matches ${file}`);
		} catch {
			return skip("not checked: the schema file is not valid (see above)");
		}
	},
};

// ---- secrets ----

const WEAK_SECRETS = /^(secret|password|changeme|change-me|test|example|your[-_ ]?secret|xxx+|0+|1234)/i;

const montiSecret: CoreCheck = {
	group: "secrets",
	id: "monti-secret",
	title: "MONTI_SECRET",
	run: (state) => {
		const value = state.env.MONTI_SECRET?.trim();
		const available = state.cms ? state.cms.secrets("doctor").available : Boolean(value);
		if (!available) {
			return fail("MONTI_SECRET is not set, so login sessions cannot be signed and no key or token can be stored", {
				where: WHERE_TO_SET,
				fix: "generate one with `openssl rand -base64 32` and put it in MONTI_SECRET. Use the same value wherever the site runs, and keep it: values encrypted with it (AI keys, git-sync tokens) cannot be read without it",
			});
		}
		if (!value) return ok("set by the `secret` option of monti.config.ts (its strength is not checked)");
		const distinct = new Set(value).size;
		if (value.length < 32 || distinct < 8 || WEAK_SECRETS.test(value)) {
			return warn(`MONTI_SECRET is easy to guess (${value.length} characters, ${distinct} different)`, {
				where: whereSet(state, "MONTI_SECRET"),
				fix: "use a long random value: `openssl rand -base64 32`. Changing it signs everyone out once; to keep stored AI keys and tokens readable, move the old value to `previousSecrets` in monti.config.ts",
			});
		}
		return ok(`set (${value.length} characters)`, { where: whereSet(state, "MONTI_SECRET") });
	},
};

const legacySecrets: CoreCheck = {
	group: "secrets",
	id: "old-secrets",
	title: "Old secret names",
	run: (state) => {
		const found = (["CMS_SECRET", "AUTH_SECRET"] as const).filter((name) => state.env[name]?.trim());
		if (found.length === 0) return ok("CMS_SECRET and AUTH_SECRET are not set");
		const usedByConfig = state.configText?.includes("CMS_SECRET") === true;
		const unused = found.filter((name) => !(name === "CMS_SECRET" && usedByConfig));
		if (unused.length === 0)
			return ok("CMS_SECRET is read by `previousSecrets` in the config, to keep old stored values readable");
		const steps: string[] = [];
		if (unused.includes("CMS_SECRET")) {
			steps.push(
				state.env.MONTI_SECRET?.trim()
					? "CMS_SECRET: if values were stored under it (AI keys, git-sync tokens), add `previousSecrets: [process.env.CMS_SECRET]` to defineConfig, and delete the variable once they are saved again; if not, delete it"
					: "CMS_SECRET: rename it to MONTI_SECRET, keeping the same value, so the AI keys and git-sync tokens stored with it still decrypt",
			);
		}
		if (unused.includes("AUTH_SECRET")) {
			steps.push(
				"AUTH_SECRET: delete it; the login session key now comes from MONTI_SECRET (everyone signs in once more)",
			);
		}
		return warn(
			`${unused.join(" and ")} ${unused.length === 1 ? "is" : "are"} still set but nothing reads ${unused.length === 1 ? "it" : "them"} any more`,
			{
				where: [...new Set(unused.map((name) => whereSet(state, name)))].join(", "),
				fix: steps.join("\n"),
			},
		);
	},
};

// ---- storage ----

const noStorage: CoreCheck = {
	group: "storage",
	id: "none",
	title: "Media storage",
	needsCms: true,
	run: (state) =>
		state.cms?.isMediaConfigured
			? ok("a media storage is configured")
			: ok(
					"no media storage: image upload is off and the admin hides the media menu. Add `storage: s3Storage()` (@monti-cms/storage-s3) to turn it on",
				),
};

// ---- next ----

const FILE_EXTENSIONS = ["tsx", "ts", "jsx", "js"] as const;

const packageDeps = (state: DoctorState): Record<string, string> | undefined => {
	try {
		const pkg = JSON.parse(readFileSync(path.join(state.cwd, "package.json"), "utf8")) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
		};
		return { ...pkg.dependencies, ...pkg.devDependencies };
	} catch {
		return undefined;
	}
};

const isNextApp = (state: DoctorState): boolean => Boolean(packageDeps(state)?.next);

const appDirOf = (state: DoctorState): string | undefined =>
	exists(state, "src/app") ? "src/app" : exists(state, "app") ? "app" : undefined;

const isGroup = (name: string) => /^\(.+\)$/.test(name);

/** The file for a route (`segments` after the app folder, route groups are transparent), or `undefined`. `base` is the file name without extension. */
function findRouteFile(
	state: DoctorState,
	appDir: string,
	segments: readonly string[],
	base: string,
): string | undefined {
	const walk = (dir: string, rest: readonly string[]): string | undefined => {
		if (rest.length === 0) {
			for (const extension of FILE_EXTENSIONS) {
				if (exists(state, `${dir}/${base}.${extension}`)) return `${dir}/${base}.${extension}`;
			}
		}
		let entries: Dirent[];
		try {
			entries = readdirSync(path.join(state.cwd, dir), { withFileTypes: true });
		} catch {
			return undefined;
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			if (isGroup(entry.name)) {
				const found = walk(`${dir}/${entry.name}`, rest);
				if (found) return found;
			} else if (rest[0] === entry.name) {
				const found = walk(`${dir}/${entry.name}`, rest.slice(1));
				if (found) return found;
			}
		}
		return undefined;
	};
	return walk(appDir, segments);
}

/** The page files under the app folder that use `marker`, as the route they serve (route groups removed). */
function routesUsing(
	state: DoctorState,
	appDir: string,
	marker: string,
	base: string,
): { file: string; route: string }[] {
	const found: { file: string; route: string }[] = [];
	const walk = (dir: string, depth: number) => {
		if (depth > 6) return;
		let entries: Dirent[];
		try {
			entries = readdirSync(path.join(state.cwd, dir), { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const full = `${dir}/${entry.name}`;
			if (entry.isDirectory()) {
				if (entry.name !== "node_modules") walk(full, depth + 1);
			} else if (FILE_EXTENSIONS.some((extension) => entry.name === `${base}.${extension}`)) {
				try {
					if (readFileSync(path.join(state.cwd, full), "utf8").includes(marker)) {
						const route = path.posix
							.dirname(full)
							.slice(appDir.length)
							.split("/")
							.filter((part) => part && !isGroup(part));
						found.push({ file: full, route: `/${route.join("/")}` });
					}
				} catch {
					// unreadable: not a candidate
				}
			}
		}
	};
	walk(appDir, 0);
	return found;
}

const nextFiles: CoreCheck = {
	group: "next",
	id: "files",
	title: "The three Next files",
	needsCms: true,
	run: (state) => {
		if (!isNextApp(state)) return skip("not checked: this folder is not a Next app (no `next` in package.json)");
		const appDir = appDirOf(state);
		const adminPath = state.cms?.site.ADMIN_PATH ?? "/admin";
		const adminSegments = adminPath.split("/").filter(Boolean);
		if (!appDir) {
			return fail("there is no app/ folder, so there are no Next files", {
				where: state.cwd,
				fix: "Monti needs the App Router: add an app/ folder (it can sit next to pages/) and run `monti init`",
			});
		}
		const wanted = [
			{
				what: "admin layout",
				base: "layout",
				segments: adminSegments,
				marker: "CmsAdminLayout",
				route: `${adminPath}`,
			},
			{
				what: "admin page",
				base: "page",
				segments: [...adminSegments, "[[...path]]"],
				marker: "CmsAdminPage",
				route: `${adminPath}/[[...path]]`,
			},
			{
				what: "API route",
				base: "route",
				segments: ["api", "cms", "[...path]"],
				marker: "createRouteHandler",
				route: "/api/cms/[...path]",
			},
		];
		const problems: string[] = [];
		const fixes: string[] = [];
		const found: string[] = [];
		for (const item of wanted) {
			const file =
				adminSegments.length === 0 && item.base === "layout"
					? undefined
					: findRouteFile(state, appDir, item.segments, item.base);
			if (file) {
				if (!readFileSync(path.join(state.cwd, file), "utf8").includes(item.marker)) {
					problems.push(`${file} exists but does not use ${item.marker}`);
					fixes.push(
						`${file}: use ${item.marker} from @monti-cms/nextjs${item.base === "route" ? "" : "/admin"} (copy the file \`monti init\` writes)`,
					);
				} else found.push(file);
				continue;
			}
			problems.push(`${item.what} is missing (${appDir}${item.route})`);
			if (item.marker !== "createRouteHandler") {
				const elsewhere = routesUsing(state, appDir, item.marker, item.base)[0];
				if (elsewhere) {
					fixes.push(
						`the ${item.what} is at ${elsewhere.file}, which serves ${elsewhere.route}, but the admin path in your config is ${adminPath}. Either set "admin": { "path": "${elsewhere.route}" } in monti.schema.json, or move the folder to ${appDir}${adminPath}`,
					);
					continue;
				}
			}
			fixes.push(
				`create ${appDir}${item.route}/${item.base}.${item.base === "route" ? "ts" : "tsx"} (\`monti init\` writes all three; it keeps files you already have)`,
			);
		}
		return problems.length === 0
			? ok(`found ${found.join(", ")}`)
			: fail(problems.join("; "), { where: `${appDir}/ (admin path ${adminPath})`, fix: fixes.join("\n") });
	},
};

const nextWithCms: CoreCheck = {
	group: "next",
	id: "with-cms",
	title: "withCms in next.config",
	run: (state) => {
		if (!isNextApp(state)) return skip("not checked: this folder is not a Next app (no `next` in package.json)");
		const file = NEXT_CONFIG_FILES.find((candidate) => exists(state, candidate));
		if (!file) {
			return fail("there is no next.config.ts", {
				where: state.cwd,
				fix: "create one that exports `withCms(nextConfig)` (withCms is exported by the package @monti-cms/nextjs/config); `monti init` writes it",
			});
		}
		return readFileSync(path.join(state.cwd, file), "utf8").includes("withCms")
			? ok(`${file} wraps the config in withCms`)
			: fail(`${file} does not use withCms, so the build cannot transpile Monti's packages`, {
					where: file,
					fix: "import withCms from the package @monti-cms/nextjs/config and export `withCms(nextConfig)` instead of `nextConfig`",
				});
	},
};

const nextHydration: CoreCheck = {
	group: "next",
	id: "hydration",
	title: "suppressHydrationWarning on <html>",
	run: (state) => {
		if (!isNextApp(state)) return skip("not checked: this folder is not a Next app (no `next` in package.json)");
		const layout = findRootLayout(state.cwd);
		if (!layout) return skip("not checked: there is no root layout");
		const has = hasSuppressHydrationWarning(readFileSync(path.join(state.cwd, layout), "utf8"));
		if (has === undefined) return skip(`not checked: ${layout} has no <html> tag`);
		return has
			? ok(`${layout} has suppressHydrationWarning on <html>`)
			: warn(
					"the admin theme sets a class on <html> before React hydrates, so the first admin screen logs a hydration mismatch",
					{
						where: layout,
						fix: `add suppressHydrationWarning to the <html> tag: <html lang="en" suppressHydrationWarning>`,
					},
				);
	},
};

const adminPathCheck: CoreCheck = {
	group: "next",
	id: "admin-path",
	title: "Admin path",
	needsCms: true,
	run: (state) => {
		const adminPath = state.cms?.site.ADMIN_PATH ?? "/admin";
		const site = (state.env.SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
		return ok(`the admin is at ${adminPath} (${site}${adminPath})`, {
			where: 'admin.path in monti.schema.json (default "/admin")',
		});
	},
};

// ---- upgrade/*: migration-only checks ----
//
// For sites upgrading from the pre-overhaul setup (two config files, old env names, an `(admin)` route group, `admin-components.tsx`). They are grouped under
// `upgrade/` so they are easy to find and easy to delete: they will be removed after the owner's blog migration (#93), together with the old-data compatibility (#45).

const OLD_CONFIG_FILES = ["cms.config", "cms.server"] as const;
const OLD_EXTENSIONS = ["ts", "tsx", "js", "mjs"] as const;

const oldConfigFiles: CoreCheck = {
	group: "upgrade",
	id: "config-files",
	title: "cms.config.ts and cms.server.ts",
	run: (state) => {
		const roots = ["", "src/"];
		const present = roots
			.flatMap((root) =>
				OLD_CONFIG_FILES.flatMap((name) => OLD_EXTENSIONS.map((extension) => `${root}${name}.${extension}`)),
			)
			.filter((file) => exists(state, file));
		if (present.length === 0) return ok("no cms.config.ts or cms.server.ts left");
		const importers: string[] = [];
		try {
			for (const file of sourceFiles(state.cwd)) {
				const relative = posix(path.relative(state.cwd, file));
				if (present.includes(relative)) continue;
				const uses = importsOf(readFileSync(file, "utf8")).some((name) => /(^|[/@])cms[.-](server|config)$/.test(name));
				if (uses) importers.push(relative);
			}
		} catch {
			// the list is a help, not the check
		}
		const configFile = state.configPath ?? "monti.config.ts";
		return warn(
			`${present.join(" and ")} ${present.length === 1 ? "is" : "are"} from the earlier two-file setup and nothing reads ${present.length === 1 ? "it" : "them"} now`,
			{
				where: present.join(", "),
				fix: [
					`1. Put the site options of cms.config.ts and the server options of cms.server.ts into one \`export const cms = defineConfig({ ... })\` in ${configFile} (defineConfig and postgres come from @monti-cms/core/server).`,
					`2. Delete ${present.join(" and ")}.`,
					`3. Change every import of cms.server or cms.config to ${configFile.replace(/\.ts$/, "")}${importers.length > 0 ? `: ${importers.slice(0, 8).join(", ")}${importers.length > 8 ? ", ..." : ""}` : " (the route file, the admin layout and page, your pages, scripts)"}.`,
					'4. Run `monti doctor` again. The steps in full: "Upgrading from cms.config.ts + cms.server.ts" in the core README.',
				].join("\n"),
			},
		);
	},
};

/** Patterns of the old config that no longer work or are no longer needed, with what to do. */
const OLD_CONFIG_TEXT: readonly { readonly pattern: RegExp; readonly what: string; readonly fix: string }[] = [
	{
		pattern: /\.\.\.\s*blocks\s*\(/,
		what: "`...blocks()` is gone",
		fix: "list one line per block instead: callout(), collapsible(), tabs(), columns(), codeExplorer(), mermaid(), chart(), tooltip(), codeRef(), color() (from @monti-cms/blocks)",
	},
	{
		pattern: /defineServerConfig/,
		what: "`defineServerConfig` is removed",
		fix: "put its options straight into defineConfig({ database, auth, storage, secret })",
	},
	{
		pattern: /\bnextHost\b/,
		what: "`host: nextHost` is not needed",
		fix: "delete the `host` option and its import; the Next integration attaches it",
	},
	{
		pattern: /process\.env\.(CMS_(?!SECRET)[A-Z_]+|AUTH_SECRET|HOST_URL)/,
		what: "the old environment names are read in the config",
		fix: "delete those arguments: postgres() reads DATABASE_URL and DATABASE_SCHEMA, github() reads AUTH_GITHUB_ID, AUTH_GITHUB_SECRET and MONTI_ADMIN_GITHUB_ID, defineConfig reads SITE_URL and MONTI_SECRET",
	},
];

const oldConfigText: CoreCheck = {
	group: "upgrade",
	id: "config-text",
	title: "Old options in monti.config.ts",
	run: (state) => {
		if (!state.configText || !state.configPath) return skip("not checked: no config file");
		const code = state.configText
			.split("\n")
			.filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
			.join("\n");
		const hits = OLD_CONFIG_TEXT.filter((entry) => entry.pattern.test(code));
		if (hits.length === 0) return ok("no option of the earlier setup is left in the config");
		return warn(hits.map((hit) => hit.what).join("; "), {
			where: state.configPath,
			fix: hits.map((hit, index) => `${index + 1}. ${hit.fix}`).join("\n"),
		});
	},
};

const RENAMED_ENV: readonly (readonly [string, string | undefined])[] = [
	["CMS_DATABASE_URL", "DATABASE_URL"],
	["CMS_SCHEMA", "DATABASE_SCHEMA"],
	["CMS_ADMIN_GITHUB_ID", "MONTI_ADMIN_GITHUB_ID"],
	["HOST_URL", "SITE_URL"],
	["CMS_CONFIG_PATH", "MONTI_CONFIG_PATH"],
	["CMS_DEV_AUTH_BYPASS", undefined],
];

const oldEnv: CoreCheck = {
	group: "upgrade",
	id: "env",
	title: "Old environment names",
	run: (state) => {
		const found = RENAMED_ENV.filter(([name]) => state.env[name]?.trim());
		if (found.length === 0) return ok("no variable with an old name is set");
		const steps = found.map(([oldName, newName], index) => {
			const where = whereSet(state, oldName);
			if (!newName) {
				return `${index + 1}. In ${where} delete ${oldName}: the development login is on by itself under \`next dev\` and never in production.`;
			}
			return state.env[newName]?.trim()
				? `${index + 1}. In ${where} delete ${oldName}: ${newName} is already set and is the one that is read.`
				: `${index + 1}. In ${where} rename ${oldName} to ${newName} (keep the value).`;
		});
		steps.push(
			`${steps.length + 1}. Do the same in the environment settings of your host (Vercel: Project, Settings, Environment Variables), then redeploy.`,
		);
		return warn(
			`${found.map(([name]) => name).join(", ")} ${found.length === 1 ? "is" : "are"} from the earlier setup and nothing reads ${found.length === 1 ? "it" : "them"} now`,
			{
				where: [...new Set(found.map(([name]) => whereSet(state, name)))].join(", "),
				fix: steps.join("\n"),
			},
		);
	},
};

const routeGroups: CoreCheck = {
	group: "upgrade",
	id: "route-groups",
	title: "(admin) route folders",
	run: (state) => {
		const appDir = appDirOf(state);
		if (!appDir) return skip("not checked: there is no app/ folder");
		const groups: string[] = [];
		const walk = (dir: string, depth: number) => {
			if (depth > 2) return;
			let entries: Dirent[];
			try {
				entries = readdirSync(path.join(state.cwd, dir), { withFileTypes: true });
			} catch {
				return;
			}
			for (const entry of entries) {
				if (!entry.isDirectory()) continue;
				if (entry.name === "(admin)") groups.push(`${dir}/${entry.name}`);
				else if (entry.name !== "node_modules" && !entry.name.startsWith("_")) walk(`${dir}/${entry.name}`, depth + 1);
			}
		};
		walk(appDir, 0);
		const holding = groups.filter(
			(group) =>
				routesUsing(state, group, "CmsAdmin", "page").length + routesUsing(state, group, "CmsAdmin", "layout").length >
				0,
		);
		if (holding.length === 0) return ok("no (admin) route folder holds the Monti files");
		const steps = holding.flatMap((group) => {
			const inside = readdirSync(path.join(state.cwd, group), { withFileTypes: true }).filter((entry) =>
				entry.isDirectory(),
			);
			return inside.map((entry) => `git mv "${group}/${entry.name}" "${appDir}/${entry.name}"`);
		});
		return warn(
			`the admin lives in a route group folder (${holding.join(", ")}); route groups are optional now and the setup guide no longer uses one`,
			{
				where: holding.join(", "),
				fix: [
					"It still works. To follow the new layout:",
					...steps.map((step, index) => `${index + 1}. ${step}`),
					`${steps.length + 1}. In the moved files, change the relative import of monti.config.ts (it is one folder shallower now), then delete the empty (admin) folder.`,
				].join("\n"),
			},
		);
	},
};

const oldAdminComponents: CoreCheck = {
	group: "upgrade",
	id: "admin-components",
	title: "admin-components.tsx",
	run: (state) => {
		const found = [
			"admin-components.tsx",
			"src/admin-components.tsx",
			"app/admin-components.tsx",
			"src/app/admin-components.tsx",
		].filter((file) => exists(state, file));
		if (found.length === 0) return ok("no admin-components.tsx");
		return warn(`${found.join(", ")} is from the earlier setup; nothing loads it now`, {
			where: found.join(", "),
			fix: 'register its components as a plugin instead: `definePlugin({ name, options: {}, admin: () => import("./admin") })` whose admin module\'s default export is `defineAdminPlugin({ Provider })` (@monti-cms/admin/plugins); see plugins/word-list in examples/blog. Then delete the file',
		});
	},
};

/** The checks of core itself, in the order they are listed. */
export const CORE_CHECKS: readonly CoreCheck[] = [
	envFiles,
	envIgnored,
	configFile,
	configLoads,
	automatic,
	boundary,
	schemaFile,
	schemaTypes,
	montiSecret,
	legacySecrets,
	noStorage,
	nextFiles,
	nextWithCms,
	nextHydration,
	adminPathCheck,
	oldConfigFiles,
	oldConfigText,
	oldEnv,
	routeGroups,
	oldAdminComponents,
];

/** The order the groups are printed in. Groups not listed (plugins) follow. */
export const GROUP_ORDER = ["config", "schema", "database", "secrets", "auth", "storage", "next", "upgrade"] as const;
