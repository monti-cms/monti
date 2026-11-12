import { link, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
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

/**
 * The files of a site checkout: `monti.schema.ts` and `monti/changes` under `root`.
 *
 * The write is all or nothing. The change file goes first under a name nothing reads (`<id>.json.part`), then the schema file, then the change file
 * takes its name (a hard link, which never replaces a change already there), which is the moment the change exists. A failure before that leaves the schema file as it was (it is not written yet, or the part
 * file is removed and the schema's old text written back), so "could not write" is true of both files.
 */
export function schemaFilesAt(root: string, schemaFile = "monti.schema.ts"): SchemaFiles {
	const changes = path.join(root, "monti", "changes");
	const schemaPath = path.join(root, schemaFile);
	return {
		async write(schema, change, writeSchema) {
			const final = path.join(changes, `${change.id}.json`);
			const part = `${final}.part`;
			await mkdir(changes, { recursive: true });
			await writeFile(part, `${JSON.stringify(change, null, "\t")}\n`, { flag: "wx" });
			const before = writeSchema ? await readFile(schemaPath, "utf8").catch(() => null) : null;
			/** Leaves the files as they were before this write, or says that it could not. */
			const undo = async (cause: unknown) => {
				await rm(part, { force: true }).catch(() => {});
				if (!writeSchema) return;
				const now = await readFile(schemaPath, "utf8").catch(() => null);
				if (now === before) return;
				try {
					if (before === null) await rm(schemaPath, { force: true });
					else await writeFile(schemaPath, before);
				} catch {
					throw new PartialSchemaWrite(schemaFile, cause);
				}
			};
			try {
				if (writeSchema) await writeFile(schemaPath, schemaSource(schema));
				// A link, not a rename: it fails (`EEXIST`) where a change by that name is already there, so an id is never written twice.
				await link(part, final);
				await rm(part, { force: true }).catch(() => {});
			} catch (error) {
				await undo(error);
				throw error;
			}
		},
		readChanges: () => readChangeFiles(changes),
	};
}
