import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/schema";
import type { Message } from "../operation";
import type { FieldDefinition, Schema } from "../schema/define";
import type { Entry } from "./record";

type Awaitable<T> = T | Promise<T>;

/** One row of the publish to-do list (doc 02). A blocking one stops the publish until it is done. */
export type PublishTask = {
	code: string;
	/** Where it points: a field name, so the screen can go there. */
	field?: string;
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
	schema: Schema,
	checks: readonly PublishCheck[],
	entry: Entry,
	slugTaken: boolean,
): Promise<PublishTask[]> {
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
	for (const check of checks) tasks.push(...(await check(entry, { db, schema })));
	return tasks;
}
