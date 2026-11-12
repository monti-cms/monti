import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
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
	 * database step: when it fails, the files are the truth to apply again.
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

/** The files of a site checkout: `monti.schema.ts` and `monti/changes` under `root`. */
export function schemaFilesAt(root: string, schemaFile = "monti.schema.ts"): SchemaFiles {
	const changes = path.join(root, "monti", "changes");
	return {
		async write(schema, change, writeSchema) {
			// The file is the site's own, under a folder known only when the server runs. A bundler that follows file paths (Turbopack) is told not to
			// take the whole project for it.
			if (writeSchema) await writeFile(path.join(/*turbopackIgnore: true*/ root, schemaFile), schemaSource(schema));
			await mkdir(changes, { recursive: true });
			await writeFile(path.join(changes, `${change.id}.json`), `${JSON.stringify(change, null, "\t")}\n`, {
				flag: "wx",
			});
		},
		readChanges: () => readChangeFiles(changes),
	};
}
