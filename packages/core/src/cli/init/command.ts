import { randomBytes } from "node:crypto";
import path from "node:path";
import type { Readable, Writable } from "node:stream";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { type MontiConfig, openMonti } from "../../config";
import { migrateToLatest } from "../../db/migrations";
import type { Database } from "../../db/schema";
import { migrateContent } from "../../schema/apply";
import { readChangeFiles } from "../../schema/files";
import { formatReport } from "../doctor/report";
import { runDoctor } from "../doctor/run";
import { loadEnvFiles } from "../env-files";
import { Cancelled, terminalAsk } from "../prompt";
import { type Answers, readFlags, settle } from "./answers";
import { cannotInit, detectSite, type Site } from "./detect";
import { adminDir } from "./files";
import { WriteFailed, type Written, writeSite } from "./write";

/**
 * `monti init` (docs/design/features/20-release.md): takes a Next.js site to a running admin. It reads the site, settles four things (each has
 * a flag; `--yes` or a run with nobody at the terminal takes the defaults and asks nothing), writes the Monti files the site lacks, adds what
 * the site's own files lack, makes the tables when the database answers, runs the doctor, and ends with what is left for a person to do.
 * A file that is there is never written over, so it can be run again.
 */
export type InitOptions = {
	cwd: string;
	argv: string[];
	env: Record<string, string | undefined>;
	/** Loads the site's `monti.config.ts` once it is written (the `monti` command loads TypeScript). */
	loadConfig: () => Promise<MontiConfig>;
	/** Where questions are asked. Nobody is asked unless `input` is a terminal. */
	input?: Readable & { isTTY?: boolean };
	output?: Writable;
	out?: (line: string) => void;
	/** The check at the end (`monti doctor`'s); a test gives its own. */
	doctor?: typeof runDoctor;
	/** The database, for tests: whether it answers, and making the tables. */
	database?: {
		answers: (address: string) => Promise<boolean>;
		setUp: (config: MontiConfig, cwd: string) => Promise<void>;
	};
};

const realDatabase: NonNullable<InitOptions["database"]> = {
	async answers(address) {
		const db = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: new Pool({ connectionString: address, connectionTimeoutMillis: 3000, max: 1 }),
			}),
		});
		try {
			await sql`select 1`.execute(db);
			return true;
		} catch {
			return false;
		} finally {
			await db.destroy();
		}
	},
	async setUp(config, cwd) {
		const monti = openMonti(config, cwd);
		try {
			await migrateToLatest(monti.db);
			await migrateContent(
				monti.db,
				config.schema,
				await readChangeFiles(path.join(cwd, "monti", "changes")),
				monti.site.kit,
				monti.site.fieldSets,
			);
		} finally {
			await monti.db.destroy();
		}
	},
};

/** How this site runs one of its scripts. */
const script = (site: Site, name: string) =>
	site.packageManager === "npm" || site.packageManager === "bun"
		? `${site.packageManager} run ${name}`
		: `${site.packageManager} ${name}`;

function nextSteps(
	site: Site,
	answers: Answers,
	state: { tables: boolean; admin: string; byHand: Written["byHand"] },
): string[] {
	const steps: string[] = [];
	if (state.byHand.length > 0)
		steps.push(`Add to the scripts of package.json (it was left as it is): ${state.byHand.join(", ")}`);
	if (!state.tables)
		steps.push(
			`Set DATABASE_URL in .env.local to your Postgres database, then make Monti's tables: ${state.byHand.length > 0 ? "npx monti db:setup" : script(site, "db:setup")}`,
		);
	if (answers.login === "github")
		steps.push(
			`Fill GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and GITHUB_ADMIN in .env.local from a GitHub OAuth app. Its callback address: <the site's address>${answers.adminPath}/api/auth/github`,
		);
	if (answers.storage === "s3")
		steps.push(
			"Fill the S3_* values in .env.local: the bucket, its region (AWS) or endpoint (R2, MinIO), the keys, and the address files are read from. Then let the bucket take uploads from each address the admin is opened at (http://localhost:3000 too): `npx monti doctor --origin <address>` checks it and prints the CORS setting.",
		);
	if (site.topLayout)
		steps.push(
			`The admin is drawn inside the site's own layout (${site.topLayout}). If the site's header or styles show in the admin: move the site's pages and that layout into ${site.app}/(site)/, then run monti init again (it writes ${state.admin}/layout.tsx).`,
		);
	steps.push(`Start the site (${script(site, "dev")}) and open http://localhost:3000${answers.adminPath}`);
	steps.push(
		"On the host: set DATABASE_URL and MONTI_SECRET in its environment, and run `monti db:migrate` on every deploy. `monti doctor` checks a set-up.",
	);
	return steps;
}

export async function init(options: InitOptions): Promise<number> {
	const { cwd, env } = options;
	const out = options.out ?? ((line: string) => console.log(line));
	const input = options.input ?? process.stdin;
	const database = options.database ?? realDatabase;

	let flags: ReturnType<typeof readFlags>;
	try {
		flags = readFlags(options.argv);
	} catch (error) {
		out(error instanceof Error ? error.message : String(error));
		return 1;
	}
	const site = detectSite(cwd);
	const cannot = cannotInit(site);
	if (cannot) {
		out(`${cannot.what}\nNothing was written.\n  fix: ${cannot.fix}`);
		return 1;
	}
	out(`Monti for ${site.name}: Next ${site.next}, App Router (${site.app}/), ${site.packageManager}`);

	// Every answer first: nothing is written until all four are settled, so leaving a question leaves the site as it was.
	const ask = input.isTTY && !flags.yes ? terminalAsk(input, options.output ?? process.stdout) : null;
	let answers: Answers;
	try {
		answers = await settle(site, flags, ask);
	} catch (error) {
		out(error instanceof Error ? error.message : String(error));
		return error instanceof Cancelled ? 130 : 1;
	}
	out(
		`  admin ${answers.adminPath} · language ${answers.locale} · sign-in ${answers.login} · media files ${answers.storage}`,
	);

	let written: Written;
	try {
		written = writeSite(site, answers, { dryRun: flags.dryRun, secret: randomBytes(32).toString("base64"), env });
	} catch (error) {
		// One plain line: what was written and what was not. Anything else is a defect and keeps its trace.
		if (!(error instanceof WriteFailed)) throw error;
		out(`\n${error.message}`);
		return 1;
	}
	const verb = flags.dryRun ? "Would write" : "Wrote";
	const nothing = written.created.length === 0 && written.added.length === 0;
	out("");
	if (nothing) out("Monti is set up here already: nothing to write.");
	if (written.created.length > 0) out(`${verb}:\n${written.created.map((file) => `  ${file}`).join("\n")}`);
	if (written.added.length > 0)
		out(
			`${flags.dryRun ? "Would add" : "Added"}:\n${written.added.map(({ file, what }) => `  ${file}: ${what.join(", ")}`).join("\n")}`,
		);
	if (written.kept.length > 0)
		out(`Left as they are (already there):\n${written.kept.map((file) => `  ${file}`).join("\n")}`);
	const admin = adminDir(site, answers);
	const configName = site.config ?? "monti.config.ts";
	if (flags.dryRun) {
		out(`\nNothing was written (--dry-run).`);
		return 0;
	}

	// The values just added to .env.local are the site's from here on.
	loadEnvFiles(cwd, env);
	let tables = false;
	let config: MontiConfig | null = null;
	try {
		config = await options.loadConfig();
	} catch (error) {
		out(
			`\n${configName} does not load yet: ${(error instanceof Error ? error.message : String(error)).split("\n")[0]}`,
		);
	}
	if (config?.database && (await database.answers(config.database))) {
		let make = true;
		if (ask)
			try {
				make = (
					await ask({
						message: "The database answers. Make Monti's tables in it now? (yes, no)",
						initial: "yes",
					})
				)
					.toLowerCase()
					.startsWith("y");
			} catch {
				make = false;
			}
		if (make)
			try {
				await database.setUp(config, cwd);
				tables = true;
				out("\nMonti's tables are made.");
			} catch (error) {
				out(
					`\nMonti's tables were not made: ${(error instanceof Error ? error.message : String(error)).split("\n")[0]}`,
				);
			}
	}

	const report = await (options.doctor ?? runDoctor)({
		cwd,
		env,
		configFile: path.join(cwd, configName),
		loadConfig: options.loadConfig,
	});
	out(`\n${formatReport(report)}`);
	out(
		`\nWhat is left:\n${nextSteps(site, answers, { tables, admin, byHand: written.byHand })
			.map((step, at) => `  ${at + 1}. ${step}`)
			.join("\n")}`,
	);
	return 0;
}
