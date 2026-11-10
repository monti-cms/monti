import { z } from "zod";
import type { MediaTable } from "../db/schema";
import { defineRecordKind } from "../records";

const DateShape = z.union([z.date(), z.iso.datetime().transform((value) => new Date(value))]);

/** A media row as a snapshot keeps it: the file's place, name and keys, so undoing a move, a rename or a trash puts them back. */
const SnapshotShape = z.object({
	folder_id: z.string().nullable(),
	name: z.string(),
	kind: z.enum(["image", "file"]) satisfies z.ZodType<MediaTable["kind"]>,
	mime: z.string(),
	size: z.number(),
	original_key: z.string(),
	original_width: z.number().nullable(),
	original_height: z.number().nullable(),
	web_key: z.string().nullable(),
	web_width: z.number().nullable(),
	web_height: z.number().nullable(),
	placeholder: z.string().nullable(),
	uploaded_at: DateShape,
	version: z.number().int(),
	trashed_at: DateShape.nullable(),
	trashed_by: z.enum(["admin", "assistant", "cli", "plugin"]).nullable(),
});

export const mediaRecord = defineRecordKind({
	kind: "media",
	async load(db, ids) {
		if (ids.length === 0) return [];
		const rows = await db.selectFrom("media").selectAll().where("id", "in", ids).execute();
		return rows.map((row) => ({ id: row.id, version: row.version, data: row }));
	},
	async restore(db, id, data) {
		if (data === null) {
			await db.deleteFrom("media").where("id", "=", id).execute();
			return;
		}
		const { version, ...values } = SnapshotShape.parse(data);
		await db
			.insertInto("media")
			.values({ id, ...values, version: version + 1 })
			.onConflict((conflict) =>
				conflict.column("id").doUpdateSet((eb) => ({ ...values, version: eb("media.version", "+", 1) })),
			)
			.execute();
	},
});
