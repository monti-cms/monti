import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { type MontiConfig, openMonti } from "../../config";
import { pendingMigrations } from "../../db/migrations";
import type { Database } from "../../db/schema";
import { pendingChanges } from "../../schema/apply";
import { checkSchema } from "../../schema/define";
import { readChangeFiles } from "../../schema/files";
import { type CheckOutcome, type CheckResult, type DoctorReport, fail, ok, reportOf, skip, warn } from "./report";

/**
 * `monti doctor` (docs/design/features/20-release.md): looks at what `monti init` set up and at what breaks a live site, and says for each what
 * it found. It reads only: nothing is written, to the folder, the database or the storage, and no secret is printed.
 */

export type DoctorOptions = {
	/** The site's folder. */
	cwd: string;
	/** The environment the site runs with: the real one with the site's env files read into it (`loadEnvFiles`). */
	env: Record<string, string | undefined>;
	/** The env file a value came from; a name that is not here came from the real environment. */
	envFrom?: Map<string, string>;
	/** The site's config file, when the folder has one. */
	configFile: string | null;
	/** Loads it. The `monti` command loads TypeScript; a failure to load is a finding, not a crash. */
	loadConfig: () => Promise<MontiConfig>;
	/** The site's own address (`--origin`), for what a browser must be let do from it. */
	origin?: string;
};

/** The packages a Next site installs itself. They are released together and must be one version. */
const PACKAGES = ["core", "admin", "next"] as const;
/** The shortest `MONTI_SECRET` that is taken for a secret: `openssl rand -base64 24` is this long. */
const SECRET_LENGTH = 32;
/** Environment names that say the site runs on a host that keeps no disk between requests. */
const NO_DISK = ["VERCEL", "NETLIFY", "CF_PAGES", "AWS_LAMBDA_FUNCTION_NAME"];
const SOURCES = ["tsx", "ts", "jsx", "js"];

const readJson = (file: string): Record<string, unknown> | null => {
	try {
		return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
	} catch {
		return null;
	}
};
const firstLine = (error: unknown) => (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "";
const withSource = (dir: string, name: string) =>
	SOURCES.map((extension) => path.join(dir, `${name}.${extension}`)).find((file) => existsSync(file));

/** The App Router's folder: `app`, or `src/app`. */
export function appFolder(cwd: string): string | null {
	return ["app", path.join("src", "app")].find((dir) => existsSync(path.join(cwd, dir))) ?? null;
}

/** Every file under a folder with one of these names, skipping what a site does not write. */
function filesNamed(dir: string, name: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) found.push(...filesNamed(full, name));
		else if (SOURCES.some((extension) => entry.name === `${name}.${extension}`)) found.push(full);
	}
	return found;
}

/**
 * Where the admin is mounted: the folder that holds the admin's page, with its API route under `api/[...path]`. The folder's name is the admin's
 * address (doc 16).
 */
export function adminFolder(cwd: string): { folder: string; page: string | null } | null {
	const app = appFolder(cwd);
	if (!app) return null;
	const route = filesNamed(path.join(cwd, app), "route").find((file) =>
		readFileSync(file, "utf8").includes("adminRoute"),
	);
	if (!route) return null;
	// <admin>/api/[...path]/route.ts
	const folder = path.dirname(path.dirname(path.dirname(route)));
	return { folder: path.relative(cwd, folder), page: withSource(folder, "page") ?? null };
}

function siteNext(cwd: string): CheckOutcome {
	const installed = readJson(path.join(cwd, "node_modules", "next", "package.json"))?.version;
	const manifest = readJson(path.join(cwd, "package.json"));
	const asked = (manifest?.dependencies as Record<string, string> | undefined)?.next;
	if (!manifest)
		return fail("There is no package.json in this folder.", { fix: "run monti doctor in the site's folder" });
	if (typeof installed !== "string")
		return fail(asked ? "Next is not installed." : "Next is not one of this site's packages.", {
			where: "package.json",
			fix: asked
				? "install the site's packages (npm install)"
				: "Monti goes on a Next.js site: npx create-next-app@latest",
		});
	if (Number.parseInt(installed, 10) < 16)
		return fail(`Next ${installed}: Monti needs Next 16 or later.`, {
			where: "package.json",
			fix: "npm install next@latest",
		});
	const app = appFolder(cwd);
	if (!app)
		return fail(`Next ${installed}, and no app/ folder: Monti needs the App Router.`, {
			fix: "add an app/ folder (it can stand beside pages/)",
		});
	return ok(`Next ${installed}, App Router (${app}/)`);
}

function sitePackages(cwd: string): CheckOutcome {
	const versions = PACKAGES.map((name) => ({
		name: `@monti-cms/${name}`,
		version: readJson(path.join(cwd, "node_modules", "@monti-cms", name, "package.json"))?.version as
			| string
			| undefined,
	}));
	const missing = versions.filter((each) => each.version === undefined).map((each) => each.name);
	if (missing.length > 0)
		return fail(`${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not installed.`, {
			where: "package.json",
			fix: "install them from the same release as the others (the release's notes give the line)",
		});
	if (new Set(versions.map((each) => each.version)).size > 1)
		return fail(
			`The packages are of different releases: ${versions.map((each) => `${each.name} ${each.version}`).join(", ")}.`,
			{
				where: "package.json",
				fix: "install all three from one release",
			},
		);
	return ok(`@monti-cms/core, admin, next ${versions[0]?.version}`);
}

function filesAdmin(cwd: string): CheckOutcome {
	const admin = adminFolder(cwd);
	if (!admin)
		return fail("No route of the site exports the admin's API (adminRoute).", {
			where: `${appFolder(cwd) ?? "app"}/<admin>/api/[...path]/route.ts`,
			fix: "npx monti init",
		});
	if (!admin.page || !readFileSync(admin.page, "utf8").includes("AdminPage"))
		return fail(
			`The admin's API is under ${admin.folder}/api, and ${admin.folder} has no page that draws the admin (AdminPage).`,
			{
				where: `${admin.folder}/page.tsx`,
				fix: "npx monti init",
			},
		);
	return ok(`the admin is at /${path.basename(admin.folder)} (${admin.folder}/)`);
}

function siteLayout(cwd: string): CheckOutcome {
	const app = appFolder(cwd);
	const admin = adminFolder(cwd);
	if (!app || !admin) return skip("the admin's page is not there");
	const own = withSource(path.join(cwd, admin.folder), "layout");
	if (withSource(path.join(cwd, app), "layout"))
		return warn(
			`The admin is drawn inside the site's own layout (${app}/layout): its header and styles show in the admin too.`,
			{
				where: `${app}/layout.tsx`,
				fix: `move the site's pages and that layout into ${app}/(site)/, then run npx monti init again: it writes the admin's own layout`,
			},
		);
	if (!own)
		return fail("The admin's page has no layout over it.", {
			where: `${admin.folder}/layout.tsx`,
			fix: "npx monti init",
		});
	return ok("the admin has its own layout");
}

function filesGitignore(cwd: string): CheckOutcome {
	const file = path.join(cwd, ".gitignore");
	const lines = existsSync(file)
		? readFileSync(file, "utf8")
				.split(/\r?\n/)
				.map((line) => line.trim())
		: [];
	const covered = lines.some((line) => [".env.local", ".env*", ".env*.local", ".env.*", "/.env.local"].includes(line));
	return covered
		? ok(".env.local is kept out of git")
		: warn(".env.local is not in .gitignore: its secrets would be committed.", {
				where: ".gitignore",
				fix: "add a line: .env.local",
			});
}

function envSecret(options: DoctorOptions, config: MontiConfig | null): CheckOutcome {
	const inConfig = config?.secret !== undefined && config.secret.trim() !== "";
	const secret = inConfig ? config?.secret : options.env.MONTI_SECRET;
	const where = inConfig ? "monti.config.ts (secret)" : (options.envFrom?.get("MONTI_SECRET") ?? "the environment");
	if (secret === undefined || secret.trim() === "")
		return fail("MONTI_SECRET is not set.", {
			where: ".env.local, or the host's environment",
			fix: "add MONTI_SECRET with a long random value (openssl rand -base64 32)",
		});
	if (secret === "change-me" || secret.length < SECRET_LENGTH)
		return fail(
			secret === "change-me"
				? "MONTI_SECRET is still the example's value."
				: `MONTI_SECRET is ${secret.length} characters: too short to be a secret.`,
			{ where, fix: "set it to a long random value (openssl rand -base64 32)" },
		);
	return ok(`MONTI_SECRET is set (${where})`);
}

/** The database's host and name, for a message: never the address itself, which holds the password. */
function databaseName(address: string): string {
	try {
		const url = new URL(address);
		return `${url.hostname}${url.pathname}`;
	} catch {
		return "the database";
	}
}

function authLogin(options: DoctorOptions, config: MontiConfig, admin: ReturnType<typeof adminFolder>): CheckOutcome {
	const github = config.auth?.github;
	if (!github) return ok("the admin signs in with a password");
	const blank = (["clientId", "clientSecret", "admin"] as const).filter(
		(name) => !github[name] || github[name].trim() === "",
	);
	if (blank.length > 0)
		return fail(`The GitHub sign-in has no ${blank.join(", ")}.`, {
			where: "monti.config.ts (auth.github), and the environment values it reads",
			fix: "set them from the site's GitHub OAuth app",
		});
	const address = `${options.origin ?? "<the site's address>"}/${admin ? path.basename(admin.folder) : "admin"}/api/auth/github`;
	return ok(`the admin signs in with GitHub\nthe OAuth app's callback address: ${address}`);
}

/** Runs every check, in the order a person reads them: the site, its files, its environment, the database, the storage, the sign-in. */
export async function runDoctor(options: DoctorOptions): Promise<DoctorReport> {
	const { cwd } = options;
	const checks: CheckResult[] = [];
	const say = (id: string, outcome: CheckOutcome) => checks.push({ id, ...outcome });

	say("site/next", siteNext(cwd));
	say("site/packages", sitePackages(cwd));
	say("site/layout", siteLayout(cwd));

	let config: MontiConfig | null = null;
	if (!options.configFile)
		say("files/config", fail("There is no monti.config.ts in this folder.", { fix: "npx monti init" }));
	else
		try {
			config = await options.loadConfig();
			say("files/config", ok(`${path.basename(options.configFile)} loads`));
		} catch (error) {
			say(
				"files/config",
				fail(`${path.basename(options.configFile)} does not load: ${firstLine(error)}`, {
					where: path.basename(options.configFile),
				}),
			);
		}
	const noConfig = skip("monti.config.ts did not load");

	if (!config) say("files/schema", noConfig);
	else {
		const problems = checkSchema(config.schema);
		const named = problems
			.slice(0, 3)
			.map((problem) => [problem.collection, problem.field, problem.code].filter(Boolean).join(" · "));
		say(
			"files/schema",
			problems.length > 0
				? fail(
						`The schema has ${problems.length === 1 ? "a problem" : `${problems.length} problems`}: ${named.join("; ")}${problems.length > 3 ? "; …" : ""}`,
						{
							where: "monti.schema.ts",
							fix: "fix the schema file (the admin's settings name each problem on the dev server)",
						},
					)
				: ok(
						`the schema checks: ${Object.keys(config.schema.collections).length} ${Object.keys(config.schema.collections).length === 1 ? "collection" : "collections"}`,
					),
		);
	}
	say("files/admin", filesAdmin(cwd));
	say("files/gitignore", filesGitignore(cwd));
	say("env/secret", envSecret(options, config));

	// The database: the address, then a connection, then what it has followed. Each waits on the one before.
	const address = config ? config.database : options.env.DATABASE_URL;
	if (!address || address.trim() === "") {
		say(
			"database/url",
			fail("The site has no database address.", {
				where: ".env.local, or the host's environment",
				fix: "set DATABASE_URL to the Postgres address",
			}),
		);
		say("database/reachable", skip("there is no database address"));
		say("database/migrations", skip("there is no database address"));
	} else {
		say("database/url", ok(`DATABASE_URL is set (${options.envFrom?.get("DATABASE_URL") ?? "the environment"})`));
		const db = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: new Pool({ connectionString: address, connectionTimeoutMillis: 5000, max: 2 }),
			}),
		});
		try {
			let reached = false;
			try {
				await sql`select 1`.execute(db);
				reached = true;
				say("database/reachable", ok(`the database answers (${databaseName(address)})`));
			} catch (error) {
				say(
					"database/reachable",
					fail(`The database does not answer (${databaseName(address)}): ${firstLine(error)}`, {
						where: "DATABASE_URL",
						fix: "check the address, and that the database is running and lets this machine in",
					}),
				);
				say("database/migrations", skip("the database is not reachable"));
			}
			if (reached) {
				const steps = await pendingMigrations(db);
				const { rows } = await sql<{
					made: string | null;
				}>`select to_regclass('monti_migration')::text as made`.execute(db);
				if (rows[0]?.made === null)
					say("database/migrations", fail("The database has none of Monti's tables.", { fix: "npx monti db:setup" }));
				else if (steps.length > 0)
					say(
						"database/migrations",
						fail(
							`The database is ${steps.length} ${steps.length === 1 ? "step" : "steps"} behind this version of Monti.`,
							{ fix: "npx monti db:migrate" },
						),
					);
				else {
					const changes = await pendingChanges(db, await readChangeFiles(path.join(cwd, "monti", "changes")));
					say(
						"database/migrations",
						changes.length > 0
							? fail(
									`The database has not followed ${changes.length === 1 ? "a change" : `${changes.length} changes`} of the schema: ${changes.map((change) => change.id).join(", ")}`,
									{ where: "monti/changes", fix: "npx monti db:migrate" },
								)
							: ok("the database is up to date"),
					);
				}
			}

			// The storage is the site's own (a plugin's): it is asked through the site, on the pool that is already open.
			if (!config) for (const id of ["storage/configured", "storage/reachable", "storage/host"]) say(id, noConfig);
			else {
				const storage = openMonti(config, cwd, { db }).site.storage;
				if (!storage) {
					say(
						"storage/configured",
						warn("The site has no storage: no file can be uploaded.", {
							where: "monti.config.ts (plugins)",
							fix: "give it one: localFolderStorage on a server with a disk, an S3-compatible storage elsewhere",
						}),
					);
					say("storage/reachable", skip("there is no storage"));
					say("storage/host", skip("there is no storage"));
				} else {
					say(
						"storage/configured",
						ok(storage.kind === "folder" ? "files go to a folder on this machine" : "the site has a storage"),
					);
					try {
						// A key nothing has: the answer "no such file" shows the storage is there and lets the site in. Nothing is written.
						await storage.stat(`${randomUUID()}.png`);
						say("storage/reachable", ok("the storage answers"));
					} catch (error) {
						say(
							"storage/reachable",
							fail(`The storage does not answer: ${firstLine(error)}`, {
								where: "monti.config.ts (the storage's settings)",
								fix: "check its address and keys",
							}),
						);
					}
					const host = NO_DISK.find((name) => options.env[name]);
					say(
						"storage/host",
						storage.kind === "folder" && host
							? fail(`Files go to a folder on disk, and this host (${host}) keeps no disk: uploads would be lost.`, {
									where: "monti.config.ts (plugins)",
									fix: "use an S3-compatible storage on this host",
								})
							: ok(
									storage.kind === "folder"
										? "a folder on disk: keep it when the server moves"
										: "the storage is not this machine's disk",
								),
					);
				}
			}
		} finally {
			await db.destroy();
		}
	}
	if (!address || address.trim() === "")
		for (const id of ["storage/configured", "storage/reachable", "storage/host"])
			say(id, config ? skip("the site cannot open without a database address") : noConfig);

	say("auth/login", config ? authLogin(options, config, adminFolder(cwd)) : noConfig);
	return reportOf(cwd, checks);
}
