import { loadEntries, markChanges } from "../entries/record";
import type { OperationContext } from "../operation";
import { notChosenFields, type Schema, storedFields } from "../schema/define";
import { followedFields, sourceEntryOf, translatedFields } from "./source";

type Fields = { title: string; values: Record<string, unknown> };

/**
 * The fields of a translation's stored values that are not its own by the choices it follows (doc 19): a translation holds no choice of a
 * conditional field, its source does, and it follows the source as the site shows it while it is there, its working copy until then
 * (`followedFields`). With no source to follow there is no choice to go by, and nothing is named.
 */
export function unfollowed(
	schema: Schema,
	collection: string,
	values: Record<string, unknown>,
	followed: Fields | null,
): string[] {
	if (!followed) return [];
	const read = translatedFields(
		schema,
		collection,
		{ title: "", slug: "", values },
		{ title: followed.title, slug: "", values: followed.values },
	);
	const others = notChosenFields(schema.collections[collection], read.values);
	return Object.keys(values).filter((field) => others.has(field));
}

/** Whether a collection has a conditional field at all: without one no entry has a value that is not its own. */
export const hasChoices = (schema: Schema, collection: string) =>
	Object.values(storedFields(schema.collections[collection])).some((field) => field.under);

/** The translations of an entry's group that are not in the trash: what a change of the source's choice may write to. */
export async function translationsOf(
	ctx: Pick<OperationContext, "db" | "site">,
	entry: { id: string; collection: string; translationGroup: string; locale: string },
): Promise<string[]> {
	const schema = ctx.site.schema();
	if (entry.locale !== schema.locales.source || !hasChoices(schema, entry.collection)) return [];
	const rows = await ctx.db
		.selectFrom("entries")
		.select("id")
		.where("translation_group", "=", entry.translationGroup)
		.where("id", "<>", entry.id)
		.where("trashed_at", "is", null)
		.execute();
	return rows.map((row) => row.id);
}

/**
 * Takes out of translations the values of options their source no longer has chosen (doc 19, T184): from the working copy and from what
 * the site shows, as a structure change does. Called when what a translation follows of its source changed (the source saved while it is
 * not on the site, published, or taken off the site) and when a translation comes back from the trash. `ids` are the translations to look
 * at; they are records the operation touches, so an undo puts their values back. A working copy that changed moves on a version, so a
 * save made from a copy read before is told.
 */
export async function dropUnfollowed(ctx: OperationContext, ids: string[]): Promise<void> {
	const schema = ctx.site.schema();
	for (const entry of await loadEntries(ctx.db, ids)) {
		if (entry.locale === schema.locales.source || !hasChoices(schema, entry.collection)) continue;
		const source = await sourceEntryOf(ctx.db, schema, entry.translationGroup);
		const followed = await followedFields(ctx.db, source);
		const dropped = new Set(unfollowed(schema, entry.collection, entry.values, followed));
		if (dropped.size > 0) {
			const keep = (all: Record<string, unknown>) =>
				JSON.stringify(Object.fromEntries(Object.entries(all).filter(([field]) => !dropped.has(field))));
			await ctx.db
				.updateTable("entries")
				.set((eb) => ({
					values: keep(entry.values),
					// What it had seen of the source's value goes with its own.
					translation_seen: keep(entry.translationSeen),
					version: eb("version", "+", 1),
					updated_at: ctx.now(),
				}))
				.where("id", "=", entry.id)
				.execute();
			ctx.emit({
				type: "entry.saved",
				ids: [entry.id],
				collection: entry.collection,
				locale: entry.locale,
				version: entry.version + 1,
			});
		}
		const shown = await ctx.db
			.selectFrom("entry_published")
			.select("values")
			.where("entry_id", "=", entry.id)
			.executeTakeFirst();
		const gone = shown ? new Set(unfollowed(schema, entry.collection, shown.values, followed)) : new Set<string>();
		if (shown && gone.size > 0)
			await ctx.db
				.updateTable("entry_published")
				.set({
					values: JSON.stringify(
						Object.fromEntries(Object.entries(shown.values).filter(([field]) => !gone.has(field))),
					),
				})
				.where("entry_id", "=", entry.id)
				.execute();
		if (dropped.size > 0 || gone.size > 0) await markChanges(ctx.db, entry.id);
	}
}
