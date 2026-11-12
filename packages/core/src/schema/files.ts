import { access, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import path from "node:path";
import { type Kysely, sql, type Transaction } from "kysely";
import { z } from "zod";
import { fingerprint } from "../bytes";
import type { Database } from "../db/schema";
import { CheckError } from "../errors";
import { AdminValues } from "./admin-values";
import type { Schema } from "./define";
import { schemaSource } from "./source";

type Db = Kysely<Database> | Transaction<Database>;

/** One data step of a structure change. Steps that change no stored value (a new collection, a field's settings) leave none. */
export type ChangeStep =
	| { do: "removeCollection"; collection: string }
	| { do: "renameField"; collection: string; from: string; to: string; values: "move" | "empty" }
	| { do: "removeField"; collection: string; field: string; values: "clear" | { move: string } }
	| { do: "fillField"; collection: string; field: string; value: unknown }
	/** An option left a conditional field (doc 19): the entries that chose it lose the choice, or get another option. */
	| { do: "removeOption"; collection: string; field: string; option: string; entries: "empty" | { change: string } }
	/** An option's word changed: every entry that chose it holds the new word. */
	| { do: "renameOption"; collection: string; field: string; from: string; to: string }
	/** A language left the site: its translations go with it (doc 04). */
	| { do: "removeLocale"; locale: string }
	/** The source language changed: every group gets an entry in it, which becomes its source, and the blocks are paired again (doc 04). */
	| { do: "changeSource"; from: string; to: string };

/**
 * `monti/changes/<id>.json`: every structure change leaves one, and a database follows them in id order, the dev database when the change is saved
 * and the live one when it is deployed (`monti db:migrate`).
 */
export type ChangeFile = {
	id: string;
	steps: ChangeStep[];
	/** Admin values of what the change created (labels, help, layout), put in once where the database has none yet. */
	firstAdminValues?: Record<string, Partial<AdminValues>>;
	/**
	 * The schema as this change leaves it: what its steps bring the database to. A database that follows the change is recorded as following this
	 * schema, not whatever the schema file holds by then, so an edit made to the file after the change still goes through its own review.
	 */
	schema?: Schema;
	/**
	 * The fingerprint of `monti.schema.ts` as this change left it. Nothing that follows the change reads it; a start after a crash does, to tell
	 * whether the schema file was written before the change file got its name.
	 */
	file?: string;
};

const ChangeStepShape: z.ZodType<ChangeStep> = z.discriminatedUnion("do", [
	z.object({ do: z.literal("removeCollection"), collection: z.string() }),
	z.object({
		do: z.literal("renameField"),
		collection: z.string(),
		from: z.string(),
		to: z.string(),
		values: z.enum(["move", "empty"]),
	}),
	z.object({
		do: z.literal("removeField"),
		collection: z.string(),
		field: z.string(),
		values: z.union([z.literal("clear"), z.object({ move: z.string() })]),
	}),
	z.object({ do: z.literal("fillField"), collection: z.string(), field: z.string(), value: z.unknown() }),
	z.object({
		do: z.literal("removeOption"),
		collection: z.string(),
		field: z.string(),
		option: z.string(),
		entries: z.union([z.literal("empty"), z.object({ change: z.string() })]),
	}),
	z.object({
		do: z.literal("renameOption"),
		collection: z.string(),
		field: z.string(),
		from: z.string(),
		to: z.string(),
	}),
	z.object({ do: z.literal("removeLocale"), locale: z.string() }),
	z.object({ do: z.literal("changeSource"), from: z.string(), to: z.string() }),
]);

const ChangeFileShape: z.ZodType<ChangeFile> = z.object({
	id: z.string().min(1),
	steps: z.array(ChangeStepShape),
	firstAdminValues: z.record(z.string(), AdminValues.partial()).optional(),
	// Written by `schema.apply` from a schema it has checked; read back as it is.
	schema: z.custom<Schema>((value) => typeof value === "object" && value !== null && "collections" in value).optional(),
	file: z.string().optional(),
});

/** The way to `monti.schema.ts` and the change files. The dev server has one; the live site has none. */
export type SchemaFiles = {
	/**
	 * Writes the change file, and the schema file when `writeSchema` (not when the draft is the file a developer edited by hand). Both go before the
	 * database step: when it fails, the files are the truth to apply again. The two are written as one: when it throws, neither file has changed. The
	 * one case it could not undo it says so with a `PartialSchemaWrite`. `db` is the write's transaction: it holds the files' lock until it ends, and
	 * a wait for the lock that runs out is a `SchemaFilesBusy`.
	 */
	write(db: Db, schema: Schema, change: ChangeFile, writeSchema: boolean): Promise<void>;
	/** The change files in the order they are applied, after finishing or clearing what a write a crash cut off left (`db` holds the lock for it). */
	readChanges(db: Db): Promise<ChangeFile[]>;
};

/** The change files in a folder, in the order they are applied. */
export async function readChangeFiles(dir: string): Promise<ChangeFile[]> {
	let names: string[];
	try {
		names = await readdir(dir);
	} catch {
		return [];
	}
	const files = await Promise.all(
		names
			.filter((name) => name.endsWith(".json"))
			.map(async (name) => {
				const change = ChangeFileShape.parse(JSON.parse(await readFile(path.join(dir, name), "utf8")));
				if (`${change.id}.json` !== name) throw new Error(`Change file ${name} does not match its id ${change.id}.`);
				return change;
			}),
	);
	return files.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * The schema file was changed and could not be put back after its change file failed to appear: the one way the two-file write can leave the files
 * out of step. Nothing reports it as "not written"; the write fails with what is on disk.
 */
export class PartialSchemaWrite extends Error {
	constructor(
		readonly schemaFile: string,
		cause: unknown,
	) {
		super(
			`${schemaFile} was changed, but its change file could not be written and the schema file could not be put back.`,
			{
				cause,
			},
		);
	}
}

/** The file calls the schema files make. A test hands in ones that fail at a chosen step; the site uses Node's. */
export type FileCalls = {
	access: typeof access;
	mkdir: typeof mkdir;
	readdir: (dir: string) => Promise<string[]>;
	readFile: (file: string, encoding: "utf8") => Promise<string>;
	rename: typeof rename;
	rm: typeof rm;
	writeFile: typeof writeFile;
};

/** `fs.constants.W_OK`: the file can be written by this process. */
const WRITABLE = 2;

/** The schema files are held by another write or recovery for longer than the wait: nothing was read or written. Trying again is the way on. */
export class SchemaFilesBusy extends CheckError {
	constructor() {
		super({ key: "schema.filesBusy" });
	}
}

/** How long the files are waited for before the caller is told they are busy, and how often they are asked for meanwhile. */
const LOCK_WAIT_MS = 10_000;
const LOCK_POLL_MS = 25;
const pause = () => new Promise((resume) => setTimeout(resume, LOCK_POLL_MS));

/**
 * Asks once for the lock of "the schema files of this site", held until `trx` ends. It is a Postgres advisory lock, owned by the database
 * session: every process of a site shares its database, so it puts the sessions that write the files, or finish a write a crash cut off, one
 * after the other. The key is the table the site's structure is recorded in, as this connection resolves it: two connections that reach the same
 * tables by different search paths ask for the same lock, and two sites in one database (other tables) do not wait for each other.
 */
export async function tryHoldFiles(trx: Db): Promise<boolean> {
	const { rows } = await sql<{ held: boolean }>`
		select pg_try_advisory_xact_lock(hashtext('monti:schema-files'), 'schema_state'::regclass::oid::int) as held
	`.execute(trx);
	return rows[0]?.held === true;
}

/** Waits for the database's lock until `until` (on the clock that does not jump: `performance.now()`). Never taken over. */
async function holdFiles(trx: Db, until: number): Promise<void> {
	while (!(await tryHoldFiles(trx))) {
		if (performance.now() >= until) throw new SchemaFilesBusy();
		await pause();
	}
}

/**
 * The holders at work in this process, by their token. One process is one list, however many copies of this module it has loaded (a bundler
 * can load two): a holder of this process is at work exactly while its token is here, so its mark needs no guess.
 */
const AT_WORK = Symbol.for("monti.schema-files.at-work");
const shared = globalThis as { [AT_WORK]?: Set<string> };
shared[AT_WORK] ??= new Set<string>();
const atWork: Set<string> = shared[AT_WORK];

/**
 * An owner mark: an empty file beside the change files, named for who is at work in them (`.owner.<pid>.<token>.<host>`). The name is the
 * whole mark, so it is there whole or not at all, and removing one never removes another's.
 */
const MARK = /^\.owner\.(\d+)\.([a-z0-9]+)\.(.*)$/;
const markOf = (token: string) => `.owner.${process.pid}.${token}.${encodeURIComponent(hostname())}`;

/**
 * Whether the holder a mark names is still at work. On this machine the answer is exact for this process (its token is in the list) and the
 * operating system's for another (does the process exist). A mark from another machine cannot be asked about: it counts as at work.
 */
function holderAtWork(name: string): boolean {
	const [, pid, token, host] = MARK.exec(name) ?? [];
	if (pid === undefined || token === undefined || host !== encodeURIComponent(hostname())) return true;
	if (Number(pid) === process.pid) return atWork.has(token);
	try {
		process.kill(Number(pid), 0);
		return true;
	} catch (error) {
		// No such process: it died with its mark. Anything else (not ours to signal) is a process that exists.
		return (error as { code?: string }).code !== "ESRCH";
	}
}

/**
 * The files of a site checkout: `monti.schema.ts` and `monti/changes` under `root`.
 *
 * The write is all or nothing, and a crash in the middle of it is finished or cleared the next time the files are used:
 *
 * 1. the change goes under a name nothing reads (`<id>.json.part`), with the fingerprint of the schema file it belongs to;
 * 2. the schema is written beside the schema file and moved over it in one step, so the file is never cut short;
 * 3. the change takes its name, which is the moment it exists.
 *
 * A failure before step 3 leaves the schema file as it was (not written yet, or put back), so "could not write" is true of both files. A crash
 * leaves a `.part`: when the schema file is the one it names, the change is finished (it gets its name); otherwise it is removed. Only moves by
 * name are used, which every file system has (hard links are missing on exFAT and some network shares).
 *
 * A write and the clearing of what a crash left never run at the same time, in this process or another (two dev servers on one checkout, a
 * command beside the server). Two things keep them apart, and neither guesses from a clock:
 *
 * - the files' lock in the site's database (`tryHoldFiles`), held by the write's transaction: it puts sessions one after the other, and one
 *   that waits longer than the wait is told the files are busy;
 * - an owner mark beside the files (`.owner.<pid>.<token>.<host>`), there for as long as its holder's process works on them. A session can end
 *   while its process lives on (the connection dropped, the backend was terminated): the database's lock is free then, and the holder is still
 *   in the middle of its files. Whoever takes the lock next finds the mark, sees its holder at work, and is told the files are busy; it
 *   touches nothing. The holder finishes or fails by itself, and puts the schema file back only while its mark is still there. A mark whose
 *   process is gone is what a crash left: it is removed, and the write it cut off is finished or cleared.
 *
 * What the mark cannot tell: a process number given to another program after a crash reads as "at work" until that program ends, and so does a
 * mark from another machine on a shared folder (a container that crashed and came back under another name). The files are then busy until
 * the mark is deleted by hand; the server's log names it. On a database with one connection (PGlite) every lock belongs to the one session;
 * there the connection itself, which one transaction holds at a time, keeps a write and a recovery apart.
 */
export function schemaFilesAt(
	root: string,
	schemaFile = "monti.schema.ts",
	io: FileCalls = { access, mkdir, readdir, readFile, rename, rm, writeFile },
	waitMs = LOCK_WAIT_MS,
): SchemaFiles {
	const changes = path.join(root, "monti", "changes");
	// The file is the site's own, under a folder known only when the server runs. A bundler that follows file paths (Turbopack) is told not to
	// take the whole project for it.
	const schemaPath = path.join(/*turbopackIgnore: true*/ root, schemaFile);
	const schemaPart = `${schemaPath}.part`;
	const text = (file: string) => io.readFile(file, "utf8").catch(() => null);
	const names = () => io.readdir(changes).catch(() => [] as string[]);
	const drop = (file: string) => io.rm(file, { force: true }).catch(() => {});

	/**
	 * Runs `work` as the one holder of the files: with the database's lock, and with its owner mark beside them. Inside a write's transaction the
	 * lock stays until that transaction ends; with no transaction at hand one is opened for the work. `owns` tells the work whether its mark is
	 * still there.
	 */
	async function locked<T>(db: Db, work: (owns: () => Promise<boolean>) => Promise<T>): Promise<T> {
		if (!db.isTransaction) return db.transaction().execute((trx) => locked(trx, work));
		const until = performance.now() + waitMs;
		await holdFiles(db, until);
		const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
		const mine = markOf(token);
		atWork.add(token);
		try {
			await io.mkdir(changes, { recursive: true });
			const others = async () => (await names()).filter((name) => MARK.test(name) && name !== mine);
			for (;;) {
				let working = (await others()).filter(holderAtWork);
				if (working.length === 0) {
					// Made, then the others are looked for once more: of two that come at the same moment each sees the other, and neither goes on.
					await io.writeFile(path.join(changes, mine), "", { flag: "wx" });
					const found = await others();
					working = found.filter(holderAtWork);
					if (working.length === 0) {
						// Marks of processes that are gone: what a crash left. By their own names, so no other's mark goes with them.
						for (const left of found) await drop(path.join(changes, left));
						break;
					}
					await drop(path.join(changes, mine));
				}
				if (performance.now() >= until) {
					console.error(
						`Monti: the schema files are in use by ${working.join(", ")} (monti/changes). If that process is gone, delete its mark.`,
					);
					throw new SchemaFilesBusy();
				}
				await pause();
			}
			// Asked of the mark itself: only "it is not there" says it is gone. A folder that cannot be read just now does not make the files
			// another's, and what this write left is still its own to clear.
			return await work(() =>
				io.access(path.join(changes, mine)).then(
					() => true,
					(error) => (error as { code?: string }).code !== "ENOENT",
				),
			);
		} finally {
			await drop(path.join(changes, mine));
			atWork.delete(token);
		}
	}

	/** Finishes or clears what a write that never ended left behind. Called with the lock held. */
	async function clear() {
		const found = await names();
		const current = await text(schemaPath);
		for (const name of found.filter((each) => each.endsWith(".json.part"))) {
			const part = path.join(changes, name);
			const final = name.slice(0, -".part".length);
			let belongs: string | undefined;
			try {
				belongs = ChangeFileShape.parse(JSON.parse((await text(part)) ?? "")).file;
			} catch {
				// Cut short while it was written: nothing of the change happened.
			}
			// The schema file is the one this change names: the write got as far as the schema, so the change exists.
			if (belongs !== undefined && current !== null && fingerprint(current) === belongs && !found.includes(final))
				await io.rename(part, path.join(changes, final));
			else await drop(part);
		}
		await drop(schemaPart);
	}

	/**
	 * Before the changes are read: with no `.part` there is nothing to clear and nothing is locked. A `.part` is either a writer at work or what
	 * a crash left; the lock and the owner mark tell which, since a writer holds both for as long as it works. One made after this looked is
	 * left alone.
	 */
	async function recover(db: Db) {
		if (!(await names()).some((name) => name.endsWith(".json.part"))) return;
		await locked(db, () => clear());
	}

	async function write(owns: () => Promise<boolean>, schema: Schema, change: ChangeFile, writeSchema: boolean) {
		await clear();
		const final = path.join(changes, `${change.id}.json`);
		const part = `${final}.part`;
		const before = await text(schemaPath);
		const next = writeSchema ? schemaSource(schema) : before;
		const record: ChangeFile = { ...change, schema, ...(next === null ? {} : { file: fingerprint(next) }) };
		// An id is used once: a change by that name is never replaced.
		if ((await names()).includes(`${change.id}.json`))
			throw Object.assign(new Error(`Change ${change.id} already exists.`), { code: "EEXIST" });
		await io.writeFile(part, `${JSON.stringify(record, null, "\t")}\n`, { flag: "wx" });
		let moved = false;
		try {
			if (writeSchema && next !== null) {
				// A schema file marked read-only is not to be written (doc 16); moving a new file over it would go around the mark.
				if (before !== null) await io.access(schemaPath, WRITABLE);
				await io.writeFile(schemaPart, next);
				await io.rename(schemaPart, schemaPath);
				moved = true;
			}
			await io.rename(part, final);
		} catch (error) {
			// Only while the files are still this holder's: once its mark is gone another has been in them, and what is there now is not this
			// write's to clear or to put back. If the schema file was already moved in, nothing here can say "not written".
			if (!(await owns())) {
				if (moved) throw new PartialSchemaWrite(schemaFile, error);
				throw error;
			}
			await drop(part);
			await drop(schemaPart);
			// The schema file was already the new one: back to what it was, in one step again.
			if (moved)
				try {
					if (before === null) await io.rm(schemaPath, { force: true });
					else {
						await io.writeFile(schemaPart, before);
						await io.rename(schemaPart, schemaPath);
					}
				} catch {
					throw new PartialSchemaWrite(schemaFile, error);
				}
			throw error;
		}
	}

	return {
		write: (db, schema, change, writeSchema) => locked(db, (owns) => write(owns, schema, change, writeSchema)),
		async readChanges(db) {
			await recover(db);
			return readChangeFiles(changes);
		},
	};
}
