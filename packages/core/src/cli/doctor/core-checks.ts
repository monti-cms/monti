import { type Dirent, existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Cms } from "../../cms";
import { parseSchemaLiteral } from "../../schema-file/literal";
import { findSchemaFile, loadSchemaFile } from "../../schema-file/locate";
import { formatDecision } from "../../server/decision";
import { findRootLayout, hasSuppressHydrationWarning } from "../first-run";
import { findBoundaryViolations } from "../import-boundary";
import { detectAppDir, ignoresEnvLocal, NEXT_CONFIG_FILES } from "../init-detect";
import { usesWithCms } from "../init-edit";
import { AUTH_CHECKS } from "./auth-checks";
import { DATABASE_CHECKS } from "./database-checks";
import { type CheckOutcome, fail, ok, skip, warn } from "./outcome";

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
				: "fix the error above in the config file (the full message is printed by `monti db:migrate`), then run `monti doctor` again",
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

/**
 * The media storage settings. The public pages hide a storage problem on purpose (an image whose address cannot be made is drawn as "unavailable", the page
 * still renders), so a missing `S3_*` value would otherwise show up only as images that are gone. This builds the store the way the first upload or read does.
 */
const storageConfigured: CoreCheck = {
	group: "config",
	id: "storage",
	title: "Media storage",
	needsCms: true,
	run: (state) => {
		if (!state.cms?.server.media)
			return ok("no `storage` in the config, so uploads are off and the media menu is hidden");
		try {
			state.cms.mediaStore().getPublicUrl("monti-doctor");
		} catch (error) {
			const problem = (error as { problem?: { what?: string; where?: string; fix?: string } }).problem;
			return fail(problem?.what ?? messageOf(error).split("\n")[0] ?? "the media storage cannot be set up", {
				where: problem?.where ?? "`storage` in monti.config.ts",
				fix: `${problem?.fix ?? "fix the storage settings"}\nuntil then every image on the public pages is drawn as unavailable`,
			});
		}
		return ok("the media storage is set up, and public file addresses can be made");
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
	run: async (state) => {
		const file = schemaFileOf(state);
		if (!file) {
			if (state.cms && state.cms.site.COLLECTIONS.length > 0) {
				return ok(
					`no monti.schema.ts: the collections (${state.cms.site.COLLECTIONS.join(", ")}) are written in the config file`,
				);
			}
			return warn("no monti.schema.ts found", {
				where: state.cwd,
				fix: "`monti init` writes one; or `monti schema:extract` makes it from collections written in code",
			});
		}
		try {
			const schema = await loadSchemaFile(state.cwd, file);
			const collections = Object.keys(schema.collections ?? {});
			const summary = `${file} is valid (${collections.length} collection${collections.length === 1 ? "" : "s"}: ${collections.join(", ") || "none"})`;
			// The admin rewrites the file only when it is plain data; say when it will not.
			const literal = parseSchemaLiteral(readFileSync(path.join(state.cwd, file), "utf8"));
			return literal.ok
				? ok(summary)
				: ok(
						`${summary}; it contains code (${literal.message}), so the schema settings in the admin (Settings) are read-only for it`,
					);
		} catch (error) {
			return fail(messageOf(error), {
				where: file,
				fix: `correct the lines above in ${file}; the types of \`defineSchema\` show most of them in your editor as you type`,
			});
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

const appDirOf = (state: DoctorState): string | undefined => {
	const found = detectAppDir(state.cwd);
	return found.exists ? found.dir : undefined;
};

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
			const folder = detectAppDir(state.cwd).dir;
			return fail(`there is no ${folder}/ folder, so there are no Next files`, {
				where: state.cwd,
				fix: `Monti needs the App Router: add a ${folder}/ folder (it can sit next to pages/) and run \`monti init\``,
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
				segments: ["api", "monti", "[...path]"],
				marker: "createRouteHandler",
				route: "/api/monti/[...path]",
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
						`the ${item.what} is at ${elsewhere.file}, which serves ${elsewhere.route}, but the admin path in your config is ${adminPath}. Either set admin: { path: "${elsewhere.route}" } in monti.schema.ts, or move the folder to ${appDir}${adminPath}`,
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
				fix: "run `monti init`, which creates next.config.ts with the withCms wrapper (withCms comes from the package @monti-cms/nextjs/config)",
			});
		}
		return usesWithCms(readFileSync(path.join(state.cwd, file), "utf8"))
			? ok(`${file} wraps the config in withCms`)
			: fail(`${file} does not use withCms, so the build cannot transpile Monti's packages`, {
					where: file,
					fix: "run `monti init`, which wraps the export for you. By hand: import withCms from @monti-cms/nextjs/config and export `withCms(nextConfig)` instead of `nextConfig`",
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
						fix: `run \`monti init\`, which adds it for you. By hand: <html lang="en" suppressHydrationWarning>`,
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
			where: 'admin.path in monti.schema.ts (default "/admin")',
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
	storageConfigured,
	schemaFile,
	...DATABASE_CHECKS,
	montiSecret,
	...AUTH_CHECKS,
	nextFiles,
	nextWithCms,
	nextHydration,
	adminPathCheck,
];

/** The order the groups are printed in. */
export const GROUP_ORDER = ["config", "schema", "database", "secrets", "auth", "next"] as const;
