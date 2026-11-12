import { access, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { fingerprint } from "../bytes";
import { AdminValues } from "./admin-values";
import type { Schema } from "./define";
import { schemaSource } from "./source";

/** One data step of a structure change. Steps that change no stored value (a new collection, a field's settings) leave none. */
export type ChangeStep =
	| { do: "removeCollection"; collection: string }
	| { do: "renameField"; collection: string; from: string; to: string; values: "move" | "empty" }
	| { do: "removeField"; collection: string; field: string; values: "clear" | { move: string } }
	| { do: "fillField"; collection: string; field: string; value: unknown }
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
	 * The fingerprint of `monti.schema.ts` as this change left it. Nothing that follows the change reads it; a start after a crash does, to tell
	 * whether the schema file was written before the change file got its name.
	 */
	schema?: string;
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
	z.object({ do: z.literal("removeLocale"), locale: z.string() }),
	z.object({ do: z.literal("changeSource"), from: z.string(), to: z.string() }),
]);

const ChangeFileShape: z.ZodType<ChangeFile> = z.object({
	id: z.string().min(1),
	steps: z.array(ChangeStepShape),
	firstAdminValues: z.record(z.string(), AdminValues.partial()).optional(),
	schema: z.string().optional(),
});

/** The way to `monti.schema.ts` and the change files. The dev server has one; the live site has none. */
export type SchemaFiles = {
	/**
	 * Writes the change file, and the schema file when `writeSchema` (not when the draft is the file a developer edited by hand). Both go before the
	 * database step: when it fails, the files are the truth to apply again. The two are written as one: when it throws, neither file has changed. The
	 * one case it could not undo it says so with a `PartialSchemaWrite`.
	 */
	write(schema: Schema, change: ChangeFile, writeSchema: boolean): Promise<void>;
	readChanges(): Promise<ChangeFile[]>;
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
 */
export function schemaFilesAt(
	root: string,
	schemaFile = "monti.schema.ts",
	io: FileCalls = { access, mkdir, readdir, readFile, rename, rm, writeFile },
): SchemaFiles {
	const changes = path.join(root, "monti", "changes");
	const schemaPath = path.join(root, schemaFile);
	const schemaPart = `${schemaPath}.part`;
	const text = (file: string) => io.readFile(file, "utf8").catch(() => null);
	const names = () => io.readdir(changes).catch(() => [] as string[]);
	const drop = (file: string) => io.rm(file, { force: true }).catch(() => {});

	/** Finishes or clears what a write that never ended left behind. */
	async function recover() {
		const found = await names();
		const parts = found.filter((name) => name.endsWith(".json.part"));
		if (parts.length === 0) return;
		const current = await text(schemaPath);
		for (const name of parts) {
			const part = path.join(changes, name);
			const final = name.slice(0, -".part".length);
			let belongs: string | undefined;
			try {
				belongs = ChangeFileShape.parse(JSON.parse((await text(part)) ?? "")).schema;
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

	return {
		async write(schema, change, writeSchema) {
			await recover();
			const final = path.join(changes, `${change.id}.json`);
			const part = `${final}.part`;
			const before = await text(schemaPath);
			const next = writeSchema ? schemaSource(schema) : before;
			const record: ChangeFile = { ...change, ...(next === null ? {} : { schema: fingerprint(next) }) };
			await io.mkdir(changes, { recursive: true });
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
		},
		async readChanges() {
			await recover();
			return readChangeFiles(changes);
		},
	};
}
