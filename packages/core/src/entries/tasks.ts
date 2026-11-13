import type { Kysely, Transaction } from "kysely";
import { asDoc, walk } from "../body/doc";
import { linkedGroups } from "../body/links";
import { brokenCodeRefs } from "../code/links";
import type { Database } from "../db/schema";
import { isEmptyValue } from "../json";
import { altGaps } from "../media/alt";
import type { Message } from "../operation";
import { type FieldDefinition, notChosenFields, type Schema, storedFields } from "../schema/define";
import type { Site } from "../site";
import { marksOf } from "../translations/links";
import { bodyAsRead, followedFields, isTranslation, sourceEntryOf, translatedFields } from "../translations/source";
import type { Entry } from "./record";

type Awaitable<T> = T | Promise<T>;

/** One row of the publish to-do list (doc 02). A blocking one stops the publish until it is done. */
export type PublishTask = {
	code: string;
	/** Where it points: a field name, or `doc` with a block id, so the screen can go there. */
	field?: string;
	block?: string;
	blocking: boolean;
	message: Message;
};

/** A plugin's publish check: it adds rows to the same list, and decides whether they block. */
export type PublishCheck = (
	entry: Entry,
	context: { db: Kysely<Database> | Transaction<Database>; schema: Schema },
) => Awaitable<PublishTask[]>;

/** The value of a field: `title` and `slug` are columns, the rest sit in `values`. */
export const fieldValue = (entry: Pick<Entry, "title" | "slug" | "values">, field: string) =>
	field === "title" ? entry.title : field === "slug" ? entry.slug : entry.values[field];

/**
 * The publish to-do list: the editor's "to do n", the publish button and publishing many from the list all read this one result. `slugTaken` comes from
 * `publishSlug`.
 */
export async function publishTasks(
	db: Kysely<Database> | Transaction<Database>,
	site: Site,
	entry: Entry,
	slugTaken: boolean,
): Promise<PublishTask[]> {
	const schema = site.schema();
	const fields: Record<string, FieldDefinition> = storedFields(schema.collections[entry.collection]);
	const tasks: PublishTask[] = [];
	// A translation's `same` fields are its source's, and an empty `fromSource` one is the source's too (doc 04).
	const source = isTranslation(schema, entry) ? await sourceEntryOf(db, schema, entry.translationGroup) : null;
	const read = translatedFields(schema, entry.collection, entry, await followedFields(db, source));
	// The slug is the published address: an empty one always blocks, whatever the schema says (doc 02, 2026-11-06).
	// Required holds only inside the chosen option (doc 19): a field of another option is not the entry's, and is asked for by nothing. A
	// choice the field no longer lists (its option was taken out of the schema) is no choice: a required one is asked for again.
	const others = notChosenFields(schema.collections[entry.collection], read.values);
	const chosen = (field: string, definition: FieldDefinition) => {
		const value = fieldValue(field === "slug" ? entry : read, field);
		const listed =
			definition.kind !== "select" || definition.many || value == null || definition.options.includes(String(value));
		return listed ? value : null;
	};
	for (const [field, definition] of Object.entries(fields))
		if (!others.has(field) && (definition.required || field === "slug") && isEmptyValue(chosen(field, definition)))
			tasks.push({
				code: "required",
				field,
				blocking: true,
				message: { key: "entries.task.required", values: { field } },
			});
	// Images with nothing to say for them block the publish (doc 02, flow 1·10): one row, going to the first of them. `entries.missingAlt` lists them all.
	const drawn = await bodyAsRead(db, source, entry.doc);
	const gaps = await altGaps(db, fields, read.values, drawn);
	const [firstGap] = gaps;
	if (firstGap)
		tasks.push({
			code: "missingAlt",
			...("field" in firstGap.place ? { field: firstGap.place.field } : { field: "doc", block: firstGap.place.block }),
			blocking: true,
			message: { key: "entries.task.missingAlt", values: { count: gaps.length } },
		});
	if (slugTaken)
		tasks.push({
			code: "slugTaken",
			field: "slug",
			blocking: true,
			message: { key: "entries.task.slugTaken", values: { slug: entry.slug } },
		});
	// A block still in the source's words is not decided: the site would not draw it (doc 04, principle 4).
	for (const block of asDoc(entry.doc).blocks)
		if (block.link?.state === "pending")
			tasks.push({
				code: "pending",
				field: "doc",
				block: block.id,
				blocking: true,
				message: { key: "entries.task.pending" },
			});
	// A block new in the published source is not decided either: the translation is written, kept in the source's words or left without it first
	// (doc 04, 2026-11-06 owner). `block` is the source block's id: the editor shows it as an undecided block paired with it.
	if (source) {
		const published = await db
			.selectFrom("entry_published")
			.select("doc")
			.where("entry_id", "=", source.id)
			.executeTakeFirst();
		for (const mark of marksOf(asDoc(entry.doc), entry.translationSkips, published ? asDoc(published.doc) : null))
			if (mark.kind === "added")
				tasks.push({
					code: "added",
					field: "doc",
					block: mark.from,
					blocking: true,
					message: { key: "entries.task.added" },
				});
	}
	// A block's own check (`defineBlock`'s `check`) adds rows for that block.
	for (const { block } of walk(asDoc(entry.doc).blocks))
		for (const row of site.kit.blocks.get(block.type)?.check?.(block) ?? [])
			tasks.push({
				code: "block",
				field: "doc",
				block: block.id,
				blocking: row.level === "block",
				message: typeof row.message === "string" ? { key: "blocks.check", values: { text: row.message } } : row.message,
			});
	// Code links that go nowhere in the body the site draws: the reader would find no lines. They block (doc 17, 17-8).
	const broken = brokenCodeRefs(asDoc(drawn));
	if (broken.length > 0)
		tasks.push({
			code: "brokenCodeLink",
			field: "doc",
			block: broken[0].block,
			blocking: true,
			message: { key: "entries.task.brokenCodeLink", values: { count: broken.length } },
		});
	// Links to entries in this language that are not on the site: the reader would find nothing there. It only tells (doc 02).
	const linked = linkedGroups(asDoc(entry.doc));
	if (linked.length > 0) {
		const live = await db
			.selectFrom("entry_published")
			.innerJoin("entries", "entries.id", "entry_published.entry_id")
			.select("entries.translation_group")
			.where("entries.translation_group", "in", linked)
			.where("entry_published.locale", "=", entry.locale)
			.execute();
		const unpublished = linked.filter((group) => !live.some((row) => row.translation_group === group)).length;
		if (unpublished > 0)
			tasks.push({
				code: "unpublishedLink",
				field: "doc",
				blocking: false,
				message: { key: "entries.task.unpublishedLink", values: { count: unpublished } },
			});
	}
	for (const check of site.publishChecks) tasks.push(...(await check(entry, { db, schema })));
	return tasks;
}
