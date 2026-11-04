import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AdminValues } from "./admin-values";
import type { Schema } from "./define";
import { schemaSource } from "./source";

/** One data step of a structure change. Steps that change no stored value (a new collection, a field's settings) leave none. */
export type ChangeStep =
	| { do: "removeCollection"; collection: string }
	| { do: "renameField"; collection: string; from: string; to: string; values: "move" | "empty" }
	| { do: "removeField"; collection: string; field: string; values: "keep" | "clear" | { move: string } }
	| { do: "fillField"; collection: string; field: string; value: unknown }
	| { do: "clearKeptValues"; collection: string; field: string };

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
			.map(async (name) => JSON.parse(await readFile(path.join(dir, name), "utf8")) as ChangeFile),
	);
	return files.sort((a, b) => a.id.localeCompare(b.id));
}

/** The files of a site checkout: `monti.schema.ts` and `monti/changes` under `root`. */
export function schemaFilesAt(root: string, schemaFile = "monti.schema.ts"): SchemaFiles {
	const changes = path.join(root, "monti", "changes");
	return {
		async write(schema, change, writeSchema) {
			if (writeSchema) await writeFile(path.join(root, schemaFile), schemaSource(schema));
			await mkdir(changes, { recursive: true });
			await writeFile(path.join(changes, `${change.id}.json`), `${JSON.stringify(change, null, "\t")}\n`);
		},
		readChanges: () => readChangeFiles(changes),
	};
}
