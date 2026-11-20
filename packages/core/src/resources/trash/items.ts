import { sql } from "kysely";
import { MontiError } from "../../engine/errors";
import type { ReadContext } from "../../engine/types";

/** What the trash actions return of a trashed entry, folder or media. */
export interface TrashItem {
	kind: "entry" | "folder" | "media";
	id: string;
	name: string;
	trashed_at: Date;
}

export type TrashRef = Pick<TrashItem, "kind" | "id">;

/** An item's row with whether it went into the trash with its folder: its parent folder has the same `trashed_at`. */
interface ItemRow extends Omit<TrashItem, "trashed_at"> {
	trashed_at: Date | null;
	together: boolean;
}

const SHOWN = ["item.kind", "item.id", "item.name", "item.trashed_at"] as const;

function kindOf(kind: TrashItem["kind"]) {
	return sql<TrashItem["kind"]>`${sql.lit(kind)}`.as("kind");
}

/** Whether the row's parent folder, joined as `parent`, has the row's `trashed_at`. */
function together(table: string) {
	return sql<boolean>`${sql.ref("parent.trashed_at")} is not distinct from ${sql.ref(`${table}.trashed_at`)}`.as(
		"together",
	);
}

/** The entries, named by the slug of their working copy in their source locale. */
function entryRows(ctx: ReadContext) {
	return ctx.db
		.selectFrom("entries")
		.innerJoin("entry_locales", (join) =>
			join
				.onRef("entry_locales.entry_id", "=", "entries.id")
				.onRef("entry_locales.locale", "=", "entries.source_locale"),
		)
		.leftJoin("folders as parent", "parent.id", "entries.folder_id")
		.select([kindOf("entry"), "entries.id", "entry_locales.slug as name", "entries.trashed_at"])
		.select(together("entries"));
}

function folderRows(ctx: ReadContext) {
	return ctx.db
		.selectFrom("folders")
		.leftJoin("folders as parent", "parent.id", "folders.parent_id")
		.select([kindOf("folder"), "folders.id", "folders.name", "folders.trashed_at"])
		.select(together("folders"));
}

/** The media, named by their key. */
function mediaRows(ctx: ReadContext) {
	return ctx.db
		.selectFrom("media")
		.leftJoin("folders as parent", "parent.id", "media.folder_id")
		.select([kindOf("media"), "media.id", "media.key as name", "media.trashed_at"])
		.select(together("media"));
}

/** Every entry, folder and media, active or trashed, as the table `item`. */
export function allItems(ctx: ReadContext) {
	const rows = entryRows(ctx).unionAll(folderRows(ctx)).unionAll(mediaRows(ctx)).$castTo<ItemRow>();
	return ctx.db.selectFrom(rows.as("item"));
}

/** The trash items: those with a `trashed_at`. */
function trashed(ctx: ReadContext) {
	return allItems(ctx).where("item.trashed_at", "is not", null).$castTo<TrashItem>();
}

/** The trash items with a row of their own: all but those that went into the trash with their folder. */
export function listedItems(ctx: ReadContext) {
	return trashed(ctx).where("item.together", "=", false);
}

/** The trash item `id`; rejects an id that is not one, missing or active. */
export async function findItem(ctx: ReadContext, id: string): Promise<TrashItem> {
	const item = await trashed(ctx).select(SHOWN).where("item.id", "=", id).executeTakeFirst();
	if (item === undefined) throw new MontiError("NOT_FOUND", "No trash item has this id");
	return item;
}

/** The trash items with a row of their own, the most recently trashed first. */
export async function listItems(ctx: ReadContext): Promise<TrashItem[]> {
	return listedItems(ctx).select(SHOWN).orderBy("item.trashed_at", "desc").execute();
}
