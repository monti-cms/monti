import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { type MontiConfig, openMonti } from "../../config";
import { pendingMigrations } from "../../db/migrations";
import type { Database } from "../../db/schema";
import type { Storage } from "../../media/storage";
import { pendingChanges } from "../../schema/apply";
import { checkSchema } from "../../schema/define";
import { readChangeFiles } from "../../schema/files";
import { adminFolder, appFolder, installedPackage, layoutsOver, readJson, sourceIn } from "../site";
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
	/** The `fetch` the storage's CORS is asked with (tests replace it). */
	fetch?: typeof fetch;
	/** How long a call outside this machine (the database, the storage) may take, in milliseconds. A check that waits longer fails. */
	timeout?: number;
};

/** The packages a Next site installs itself. They are released together and must be one version. */
const PACKAGES = ["core", "admin", "next"] as const;
/** The shortest `MONTI_SECRET` that is taken for a secret: `openssl rand -base64 24` is this long. */
const SECRET_LENGTH = 32;
/** Environment names that say the site runs on a host that keeps no disk between requests. */
const NO_DISK = ["VERCEL", "NETLIFY", "CF_PAGES", "AWS_LAMBDA_FUNCTION_NAME"];
const firstLine = (error: unknown) => (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "";

/** How long the database or the storage is waited for. */
const TIMEOUT = 5000;

/** A promise that fails when its answer does not come in time: an outside call (the database, the storage) may never answer. */
function within<T>(ms: number, work: Promise<T>): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const late = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(`no answer in ${ms / 1000} ${ms === 1000 ? "second" : "seconds"}`)), ms);
	});
	return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

function siteNext(cwd: string): CheckOutcome {
	const installed = installedPackage(cwd, "next")?.version;
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
		version: installedPackage(cwd, `@monti-cms/${name}`)?.version as string | undefined,
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
	return ok(`the admin is at ${admin.address} (${admin.folder}/)`);
}

function siteLayout(cwd: string): CheckOutcome {
	const app = appFolder(cwd);
	const admin = adminFolder(cwd);
	if (!app || !admin) return skip("the admin's page is not there");
	if (sourceIn(path.join(cwd, app), "layout"))
		return warn(
			`The admin is drawn inside the site's own layout (${app}/layout): its header and styles show in the admin too.`,
			{
				where: `${app}/layout.tsx`,
				fix: `move the site's pages and that layout into ${app}/(site)/, then run npx monti init again: it writes the admin's own layout`,
			},
		);
	// A layout on a route group above the admin's folder is over it as much as one in the folder.
	if (layoutsOver(cwd, admin.folder).length === 0)
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
	const address = `${options.origin ?? "<the site's address>"}${(admin?.address ?? "/admin").replace(/\/$/, "")}/api/auth/github`;
	return ok(`the admin signs in with GitHub\nthe OAuth app's callback address: ${address}`);
}

/** What the database has followed: Monti's own tables, then the schema's changes. A failure to read either is this check's failure. */
async function databaseMigrations(db: Kysely<Database>, cwd: string, limit: number): Promise<CheckOutcome> {
	let steps: string[];
	let bare: boolean;
	try {
		steps = await within(limit, pendingMigrations(db));
		const { rows } = await within(
			limit,
			sql<{ made: string | null }>`select to_regclass('monti_migration')::text as made`.execute(db),
		);
		bare = rows[0]?.made === null;
	} catch (error) {
		return fail(`What the database has followed could not be read: ${firstLine(error)}`, {
			fix: "check that the database's user may read Monti's tables",
		});
	}
	if (bare) return fail("The database has none of Monti's tables.", { fix: "npx monti db:setup" });
	if (steps.length > 0)
		return fail(
			`The database is ${steps.length} ${steps.length === 1 ? "step" : "steps"} behind this version of Monti.`,
			{ fix: "npx monti db:migrate" },
		);
	let files: Awaited<ReturnType<typeof readChangeFiles>>;
	try {
		files = await readChangeFiles(path.join(cwd, "monti", "changes"));
	} catch (error) {
		return fail(`The schema's change files do not read: ${firstLine(error)}`, { where: "monti/changes" });
	}
	try {
		const changes = await within(limit, pendingChanges(db, files));
		return changes.length > 0
			? fail(
					`The database has not followed ${changes.length === 1 ? "a change" : `${changes.length} changes`} of the schema: ${changes.map((change) => change.id).join(", ")}`,
					{ where: "monti/changes", fix: "npx monti db:migrate" },
				)
			: ok("the database is up to date");
	} catch (error) {
		return fail(`What the database has followed of the schema could not be read: ${firstLine(error)}`, {
			where: "monti/changes",
		});
	}
}

const STORAGE_CHECKS = ["storage/configured", "storage/reachable", "storage/host", "storage/cors"];

/** The CORS setting a bucket needs for a browser at `origin` to send it a file, as S3, R2 and MinIO take it. */
const corsSetting = (origin: string, headers: string[]) =>
	JSON.stringify(
		[{ AllowedOrigins: [origin], AllowedMethods: ["PUT"], AllowedHeaders: headers, MaxAgeSeconds: 3600 }],
		null,
		2,
	);

/**
 * Whether a storage that takes files straight from the browser lets the site's address send them (doc 20). It asks what a browser asks
 * before a `PUT` from another address (the preflight), at an address signed for a key nothing has: nothing is written.
 */
async function storageCors(storage: Storage, options: DoctorOptions, limit: number): Promise<CheckOutcome> {
	if (!storage.ticket) return skip("files go up through the site, not straight to the storage");
	if (!options.origin)
		return warn("Whether the storage takes uploads from the site's address was not checked: no address was given.", {
			fix: "npx monti doctor --origin https://your.site (or set SITE_URL)",
		});
	const origin = options.origin;
	try {
		const ticket = await within(limit, storage.ticket(`${randomUUID()}.png`, { mime: "image/png", size: 1 }));
		const headers = Object.keys(ticket.headers);
		const answer = await within(
			limit,
			(options.fetch ?? fetch)(ticket.url, {
				method: "OPTIONS",
				headers: {
					origin,
					"access-control-request-method": "PUT",
					"access-control-request-headers": headers.join(","),
				},
			}),
		);
		const allowed = answer.headers.get("access-control-allow-origin");
		if (answer.ok && (allowed === "*" || allowed === origin)) return ok(`the storage takes uploads from ${origin}`);
		return fail(`The storage does not take uploads from ${origin}: a file sent from the admin would be refused.`, {
			where: "the bucket's CORS setting",
			fix: `set it to:\n${corsSetting(origin, headers)}`,
		});
	} catch (error) {
		return fail(`The storage's CORS setting could not be asked: ${firstLine(error)}`, {
			where: "monti.config.ts (the storage's settings)",
			fix: "check its address and keys",
		});
	}
}

/** The storage's checks, by id. The storage is the site's own (a plugin's): it is asked through the site, on the pool that is open. */
async function storageChecks(
	options: DoctorOptions,
	config: MontiConfig,
	db: Kysely<Database>,
	limit: number,
): Promise<[string, CheckOutcome][]> {
	let storage: Storage | null | undefined;
	try {
		storage = openMonti(config, options.cwd, { db }).site.storage;
	} catch (error) {
		return [
			["storage/configured", fail(`The site does not open: ${firstLine(error)}`, { where: "monti.config.ts" })],
			["storage/reachable", skip("the site did not open")],
			["storage/host", skip("the site did not open")],
			["storage/cors", skip("the site did not open")],
		];
	}
	if (!storage)
		return [
			[
				"storage/configured",
				warn("The site has no storage: no file can be uploaded.", {
					where: "monti.config.ts (plugins)",
					fix: "give it one: localFolderStorage on a server with a disk, an S3-compatible storage elsewhere",
				}),
			],
			["storage/reachable", skip("there is no storage")],
			["storage/host", skip("there is no storage")],
			["storage/cors", skip("there is no storage")],
		];
	let reachable: CheckOutcome;
	try {
		// A key nothing has: the answer "no such file" shows the storage is there and lets the site in. Nothing is written.
		await within(limit, storage.stat(`${randomUUID()}.png`));
		reachable = ok("the storage answers");
	} catch (error) {
		reachable = fail(`The storage does not answer: ${firstLine(error)}`, {
			where: "monti.config.ts (the storage's settings)",
			fix: "check its address and keys",
		});
	}
	const host = NO_DISK.find((name) => options.env[name]);
	return [
		[
			"storage/configured",
			ok(
				storage.kind === "folder"
					? "files go to a folder on this machine"
					: storage.ticket
						? "the site has a storage, and files go straight to it from the browser"
						: "the site has a storage",
			),
		],
		["storage/reachable", reachable],
		[
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
		],
		["storage/cors", await storageCors(storage, options, limit)],
	];
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
		const limit = options.timeout ?? TIMEOUT;
		const db = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: new Pool({ connectionString: address, connectionTimeoutMillis: limit, max: 2 }),
			}),
		});
		try {
			let reached = false;
			try {
				await within(limit, sql`select 1`.execute(db));
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
			if (reached) say("database/migrations", await databaseMigrations(db, cwd, limit));
			if (!config) for (const id of STORAGE_CHECKS) say(id, noConfig);
			else for (const [id, outcome] of await storageChecks(options, config, db, limit)) say(id, outcome);
		} finally {
			// A pool whose server never answers never closes: it is not waited for past the limit.
			await within(limit, db.destroy()).catch(() => {});
		}
	}
	if (!address || address.trim() === "")
		for (const id of STORAGE_CHECKS)
			say(id, config ? skip("the site cannot open without a database address") : noConfig);

	say("auth/login", config ? authLogin(options, config, adminFolder(cwd)) : noConfig);
	return reportOf(cwd, checks);
}
