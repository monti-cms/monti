import { z } from "zod";
import { entryOperations } from "../entries/operations";
import { CheckError } from "../errors";
import { defineOperation, type OperationContext } from "../operation";
import { readSettings, writeSettings } from "../settings/values";
import { type BackupManifest, readBackup } from "./backup";
import { type ImportInput, importUpload, inspectUpload } from "./import";

/** The backup or export as the screen is handed it: the text files, and the media files to fetch and put beside them (`media/<key>`). */
export type BackupOutput = {
	/** The zip's name: `monti-backup-2026-11-13.zip`. */
	name: string;
	manifest: BackupManifest;
	files: Record<string, string>;
	media: { key: string; size: number }[];
	/** When a backup was last taken (a whole one, from the tools); `null` when never. */
	lastBackup: string | null;
};

/** What the assistant is told of a backup or an export: what it would hold, never the contents (they are far past what a tool result carries). */
export type BackupSummary = Pick<BackupOutput, "name" | "manifest" | "lastBackup">;

const day = (at: Date) => at.toISOString().slice(0, 10);

const lastBackup = async (ctx: OperationContext) => {
	const at = (await readSettings(ctx.db, "data")).values.lastBackup;
	return typeof at === "string" ? at : null;
};

const UploadInput = z.object({
	collection: z.string(),
	/** The upload's text files: a Monti backup's own files, or the files a plugin's importer reads (`.md`, `.mdx`), each with its path in the upload. */
	files: z.array(z.object({ name: z.string(), text: z.string() })),
	/** The names of the upload's other files (pictures). */
	has: z.array(z.string()).default([]),
	/** A key of the upload → the field it goes to (`title`, `slug`, or a field's name); `null` leaves it out. Left out, a key goes to the field of its name. */
	mapping: z.record(z.string(), z.string().nullable()).optional(),
	/** A picture the upload names → the id of the library file it was sent up as. */
	media: z.record(z.string(), z.string()).optional(),
});

/** The operation that makes an entry: an imported entry is made by it, check and all. */
const createEntry = () => {
	const create = entryOperations.find((operation) => operation.name === "entries.create");
	if (!create) throw new Error("entries.create is not defined.");
	return create;
};

export const dataOperations = [
	defineOperation({
		name: "data.backup",
		kind: "read",
		description:
			"The site's backup (doc 14): every entry with what the site shows of it, folders, media records, addresses, templates and the admin's values, as the files of the backup zip. The trash, the activity log, conversations and keys are not in it. As a tool it answers with what the backup would hold (counts), not its contents.",
		input: z.object({}),
		async run(_input, ctx): Promise<BackupOutput | BackupSummary> {
			const backup = await readBackup(ctx.db, ctx.site.schema(), ctx.now());
			const summary = {
				name: `monti-backup-${day(ctx.now())}.zip`,
				manifest: backup.manifest,
				lastBackup: await lastBackup(ctx),
			};
			// A whole site is megabytes of text: a model is told what is in it, and reads entries with the reads made for that.
			if (ctx.actor === "assistant") return summary;
			return { ...summary, files: backup.files, media: backup.media };
		},
	}),
	defineOperation({
		name: "data.export",
		kind: "read",
		description:
			"Export picked entries in the backup's shape: those entries with their translations, the entries their relations point at, their folders and the records of the files they use. As a tool it answers with what the export would hold (counts), not its contents: read entries with entries.get.",
		input: z.object({ ids: z.array(z.string()).min(1) }),
		async run(input, ctx): Promise<BackupOutput | BackupSummary> {
			const rows = await ctx.db
				.selectFrom("entries")
				.select(["translation_group", "slug", "collection"])
				.where("id", "in", input.ids)
				.where("trashed_at", "is", null)
				.execute();
			if (rows.length === 0) throw new CheckError({ key: "entries.unknown", values: { id: input.ids[0] ?? "" } });
			const backup = await readBackup(ctx.db, ctx.site.schema(), ctx.now(), [
				...new Set(rows.map((row) => row.translation_group)),
			]);
			const [only] = rows;
			const name =
				rows.length === 1 && only
					? `${only.collection}-${only.slug || "entry"}.zip`
					: `monti-export-${day(ctx.now())}.zip`;
			const summary = { name, manifest: backup.manifest, lastBackup: await lastBackup(ctx) };
			if (ctx.actor === "assistant") return summary;
			return { ...summary, files: backup.files, media: backup.media };
		},
	}),
	defineOperation({
		name: "data.backedUp",
		kind: "write",
		humanOnly: true,
		bookkeeping: true,
		log: false,
		description: "Note that a backup was taken now: the tools show when the last one was. Nothing of the site changes.",
		input: z.object({}),
		async run(_input, ctx) {
			const at = ctx.now().toISOString();
			await writeSettings(ctx.db, "data", { ...(await readSettings(ctx.db, "data")).values, lastBackup: at });
			return { lastBackup: at };
		},
		summary: () => ({ key: "data.backedUp" }),
	}),
	defineOperation({
		name: "data.inspect",
		kind: "read",
		description:
			"Read an upload for one collection without writing anything: how many entries it holds, which of them the collection already has, the upload's keys with the field each would go to, the pictures to send up first, components no block is known for, and required fields that would stay empty. The upload is a Monti backup or export, or files a plugin's importer reads (.md and .mdx with the MDX plugin).",
		input: UploadInput,
		run: (input, ctx) => inspectUpload(ctx, input as ImportInput),
	}),
	defineOperation({
		name: "data.import",
		kind: "write",
		humanOnly: true,
		undoable: true,
		description:
			"Import an upload's entries into one collection as new drafts, with the field mapping given: an entry whose body the collection already has is left out, a taken address gets -2, a relation value with no item makes one. One import is one line of the activity log, undone as a whole. Only a person does it: it needs the files.",
		input: UploadInput.extend({ name: z.string().default("") }),
		async run(input, ctx) {
			const imported = await importUpload(ctx, input as ImportInput, createEntry());
			if (imported.imported === 0) throw new CheckError({ key: "data.nothingToImport" });
			ctx.emit({ type: "import.done", ids: imported.ids, collection: input.collection });
			return { ...imported, name: input.name, collection: input.collection };
		},
		log: "import",
		summary: (_input, output) => ({
			key: "data.import",
			values: {
				count: output.imported,
				name: output.name,
				collection: output.collection,
				skipped: output.skipped,
				items: output.items,
				// The entries whose address was taken, each with the address it asked for: the log's details show them from → to.
				renamed: JSON.stringify(output.renamed.slice(0, 50).map((each) => [each.id, each.from])),
			},
		}),
		where: (input) => ({ key: "activity.where.collection", values: { collection: input.collection } }),
	}),
];
