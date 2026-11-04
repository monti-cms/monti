import type { Kysely, Transaction } from "kysely";
import { asDoc, walk } from "../body/doc";
import { linkedGroups } from "../body/links";
import type { Database } from "../db/schema";
import type { Message } from "../operation";
import type { FieldDefinition, Schema } from "../schema/define";
import type { Site } from "../site";
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

const isEmpty = (value: unknown) =>
	value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

/** The value of a field: `title` and `slug` are columns, the rest sit in `values`. */
export const fieldValue = (entry: Pick<Entry, "title" | "slug" | "values">, field: string) =>
	field === "title" ? entry.title : field === "slug" ? entry.slug : entry.values[field];

/**
 * The publish to-do list: the editor's "to do n", the publish button and publishing many from the list all read this one result. `slugTaken` comes from
 * `publishSlug`, since the slug may still be made at publish time.
 */
export async function publishTasks(
	db: Kysely<Database> | Transaction<Database>,
	site: Site,
	entry: Entry,
	slugTaken: boolean,
): Promise<PublishTask[]> {
	const schema = site.schema();
	const fields: Record<string, FieldDefinition> = schema.collections[entry.collection]?.fields ?? {};
	const tasks: PublishTask[] = [];
	// An empty slug is made from the title when publishing, so it is never a task.
	for (const [field, definition] of Object.entries(fields))
		if (definition.required && field !== "slug" && isEmpty(fieldValue(entry, field)))
			tasks.push({
				code: "required",
				field,
				blocking: true,
				message: { key: "entries.task.required", values: { field } },
			});
	if (slugTaken)
		tasks.push({
			code: "slugTaken",
			field: "slug",
			blocking: true,
			message: { key: "entries.task.slugTaken", values: { slug: entry.slug } },
		});
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
