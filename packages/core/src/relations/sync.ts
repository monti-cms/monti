import type { Kysely, Transaction } from "kysely";
import { randomUUID } from "../bytes";
import type { Database } from "../db/schema";
import { pathKept, publicPaths, slugify } from "../entries/paths";
import type { OperationContext, RecordRef } from "../operation";
import { lockRecords } from "../records";
import { localeModeOf, type Schema, storedFields } from "../schema/define";

type Db = Kysely<Database> | Transaction<Database>;

const ref = (id: string): RecordRef => ({ kind: "entry", id });

/** Generates a unique slug within (collection, locale) by appending -2, -3 if taken, by a live entry or by one deleted for good. */
export async function generateUniqueSlug(
	db: Db,
	collection: string,
	locale: string,
	title: string,
	excludeEntryId?: string,
	fallbackId?: string,
): Promise<string> {
	const base = slugify(title) || (fallbackId ? fallbackId.slice(0, 8) : "item");
	let candidate = base;
	let suffix = 2;
	while (true) {
		let queryEntries = db
			.selectFrom("entries")
			.select("id")
			.where("collection", "=", collection)
			.where("locale", "=", locale)
			.where("slug", "=", candidate)
			.where("trashed_at", "is", null);
		if (excludeEntryId !== undefined) {
			queryEntries = queryEntries.where("id", "<>", excludeEntryId);
		}
		const inEntries = await queryEntries.executeTakeFirst();
		if (!inEntries) {
			let queryPublished = db
				.selectFrom("entry_published")
				.select("entry_id")
				.where("collection", "=", collection)
				.where("locale", "=", locale)
				.where("slug", "=", candidate);
			if (excludeEntryId !== undefined) {
				queryPublished = queryPublished.where("entry_id", "<>", excludeEntryId);
			}
			const inPublished = await queryPublished.executeTakeFirst();
			if (!inPublished && !(await pathKept(db, collection, locale, candidate))) return candidate;
		}
		candidate = `${base}-${suffix++}`;
	}
}

function extractNewTitle(raw: unknown): string | null {
	if (typeof raw === "string") {
		if (raw.startsWith("new:")) return raw.slice(4).trim();
		return null;
	}
	if (typeof raw === "object" && raw !== null && "create" in raw) {
		const title = (raw as { create: unknown }).create;
		if (typeof title === "string") return title.trim();
	}
	return null;
}

/**
 * The item of a collection that is called `title` in the source language, made when there is none: live at once, as an item is (doc 08). The
 * entry point of every "a name that is not in the list becomes a new item": a relation field that takes new names, and an import.
 */
export async function findOrCreateItem(ctx: OperationContext, collection: string, title: string): Promise<string> {
	const schema = ctx.site.schema();
	const existing = await ctx.db
		.selectFrom("entries")
		.select(["id", "translation_group"])
		.where("collection", "=", collection)
		.where("locale", "=", schema.locales.source)
		.where("title", "=", title)
		.where("trashed_at", "is", null)
		.executeTakeFirst();

	if (existing) {
		return existing.translation_group;
	}

	// Create a new item
	const newId = randomUUID();
	const newGroup = randomUUID();
	const locale = schema.locales.source;
	const slug = await generateUniqueSlug(ctx.db, collection, locale, title, undefined, newId);
	const maxRow = await ctx.db
		.selectFrom("entries")
		.select((eb) => eb.fn.max("position").as("max"))
		.where("collection", "=", collection)
		.executeTakeFirst();
	const position = (Number(maxRow?.max) || 0) + 1;
	const now = ctx.now();

	await ctx.db
		.insertInto("entries")
		.values({
			id: newId,
			collection: collection,
			translation_group: newGroup,
			locale,
			title: title,
			slug,
			position,
			status: "published",
			has_unpublished_changes: false,
			version: 1,
			values: JSON.stringify({}),
			doc: null,
			created_at: now,
			updated_at: now,
		})
		.execute();

	await ctx.db
		.insertInto("entry_published")
		.values({
			entry_id: newId,
			collection: collection,
			locale,
			title: title,
			slug,
			values: JSON.stringify({}),
			doc: null,
			published_at: now,
			from_version: 1,
			block_hashes: JSON.stringify({}),
		})
		.execute();

	ctx.created(ref(newId));
	ctx.emit({ type: "entry.saved", ids: [newId], collection: collection, locale, version: 1 });
	ctx.emit({
		type: "entry.published",
		ids: [newId],
		collection: collection,
		locale,
		paths: publicPaths(ctx.site.schema(), collection, locale, [slug]),
	});

	return newGroup;
}

/** Resolves inline item creation ("new:<title>") for relation fields with `createMissing: true`. */
export async function resolveInlineCreation(
	ctx: OperationContext,
	collection: string,
	values: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const schema = ctx.site.schema();
	const fields = storedFields(schema.collections[collection]);
	const result = { ...values };

	for (const [fieldName, fieldDef] of Object.entries(fields)) {
		if (fieldDef.kind !== "relation" || !fieldDef.createMissing) continue;
		const rawVal = result[fieldName];
		if (rawVal === undefined || rawVal === null) continue;

		const resolveOne = async (val: unknown): Promise<unknown> => {
			const newTitle = extractNewTitle(val);
			if (!newTitle) return val;

			return findOrCreateItem(ctx, fieldDef.to, newTitle);
		};

		if (fieldDef.many && Array.isArray(rawVal)) {
			result[fieldName] = await Promise.all(rawVal.map(resolveOne));
		} else {
			result[fieldName] = await resolveOne(rawVal);
		}
	}

	return result;
}

/** Syncs `entry_links` for a given fromGroup and field. */
export async function syncEntryLinks(
	ctx: OperationContext,
	fromGroup: string,
	field: string,
	toGroups: string[],
): Promise<void> {
	await ctx.db.deleteFrom("entry_links").where("from_group", "=", fromGroup).where("field", "=", field).execute();

	const seen = new Set<string>();
	const unique = toGroups.filter((g) => {
		if (!g || seen.has(g)) return false;
		seen.add(g);
		return true;
	});

	for (const [position, toGroup] of unique.entries()) {
		await ctx.db
			.insertInto("entry_links")
			.values({
				from_group: fromGroup,
				field,
				to_group: toGroup,
				position,
			})
			.onConflict((conflict) => conflict.doNothing())
			.execute();
	}
}

/** Syncs relation fields and `entry_links` for an entry and its translation group. */
export async function syncRelationsForEntry(
	ctx: OperationContext,
	entry: { id: string; collection: string; translationGroup: string; locale: string },
	values: Record<string, unknown>,
	previousValues?: Record<string, unknown>,
): Promise<void> {
	const schema = ctx.site.schema();
	const fields = storedFields(schema.collections[entry.collection]);
	/**
	 * Says that what the site shows of another entry changed: a relation edited from this side (`via`) is kept on the other entry, and when that one
	 * is on the site (an item is, as saved), its page changes with this save, whatever this entry's own state.
	 */
	const shown = (target: { id: string; collection: string; locale: string }, live: { slug: string } | undefined) => {
		if (live)
			ctx.emit({
				type: "entry.published",
				ids: [target.id],
				collection: target.collection,
				locale: target.locale,
				paths: publicPaths(schema, target.collection, target.locale, [live.slug]),
			});
	};

	for (const [fieldName, fieldDef] of Object.entries(fields)) {
		if (fieldDef.kind !== "relation") continue;

		if (fieldDef.via !== undefined) {
			// Back-link editing via target collection's many-relation field
			const targetCol = fieldDef.to;
			const targetField = fieldDef.via;

			const asArray = (v: unknown): string[] => {
				if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && Boolean(x));
				if (typeof v === "string" && v) return [v];
				return [];
			};

			const prevTargets = asArray(previousValues?.[fieldName]);
			const currTargets = asArray(values[fieldName]);

			const toAdd = currTargets.filter((t) => !prevTargets.includes(t));
			const toRemove = prevTargets.filter((t) => !currTargets.includes(t));

			for (const targetGroup of toAdd) {
				const targetRows = await ctx.db
					.selectFrom("entries")
					.selectAll()
					.where("collection", "=", targetCol)
					.where("translation_group", "=", targetGroup)
					.where("trashed_at", "is", null)
					.execute();

				for (const tr of targetRows) {
					const currentTargetList = Array.isArray(tr.values[targetField]) ? (tr.values[targetField] as string[]) : [];
					if (!currentTargetList.includes(entry.translationGroup)) {
						const nextTargetList = [...currentTargetList, entry.translationGroup];
						tr.values[targetField] = nextTargetList;
						await ctx.db
							.updateTable("entries")
							.set({ values: JSON.stringify(tr.values), updated_at: ctx.now() })
							.where("id", "=", tr.id)
							.execute();
						shown(
							tr,
							await ctx.db
								.updateTable("entry_published")
								.set({ values: JSON.stringify(tr.values) })
								.where("entry_id", "=", tr.id)
								.returning("slug")
								.executeTakeFirst(),
						);
						await syncEntryLinks(ctx, targetGroup, targetField, nextTargetList);
					}
				}
			}

			for (const targetGroup of toRemove) {
				const targetRows = await ctx.db
					.selectFrom("entries")
					.selectAll()
					.where("collection", "=", targetCol)
					.where("translation_group", "=", targetGroup)
					.where("trashed_at", "is", null)
					.execute();

				for (const tr of targetRows) {
					const currentTargetList = Array.isArray(tr.values[targetField]) ? (tr.values[targetField] as string[]) : [];
					const nextTargetList = currentTargetList.filter((g) => g !== entry.translationGroup);
					tr.values[targetField] = nextTargetList;
					await ctx.db
						.updateTable("entries")
						.set({ values: JSON.stringify(tr.values), updated_at: ctx.now() })
						.where("id", "=", tr.id)
						.execute();
					shown(
						tr,
						await ctx.db
							.updateTable("entry_published")
							.set({ values: JSON.stringify(tr.values) })
							.where("entry_id", "=", tr.id)
							.returning("slug")
							.executeTakeFirst(),
					);
					await syncEntryLinks(ctx, targetGroup, targetField, nextTargetList);
				}
			}
		} else {
			// A translation holds no value of a field all languages share: it is the source's, saved only there (doc 04). Its save leaves the
			// group's links and the source's value alone; read from its own values, they would be emptied.
			if (entry.locale !== schema.locales.source && localeModeOf(fieldName, fieldDef) === "same") continue;
			// Normal relation field
			const targets = fieldDef.many
				? Array.isArray(values[fieldName])
					? (values[fieldName] as string[])
					: []
				: values[fieldName]
					? [values[fieldName] as string]
					: [];

			await syncEntryLinks(ctx, entry.translationGroup, fieldName, targets);

			// If shared across translation group ("same"), sync to sibling entries
			if (localeModeOf(fieldName, fieldDef) === "same") {
				const siblings = await ctx.db
					.selectFrom("entries")
					.selectAll()
					.where("translation_group", "=", entry.translationGroup)
					.where("id", "<>", entry.id)
					.where("trashed_at", "is", null)
					.execute();

				for (const sibling of siblings) {
					const sibValues = sibling.values as Record<string, unknown>;
					if (JSON.stringify(sibValues[fieldName]) !== JSON.stringify(values[fieldName])) {
						sibValues[fieldName] = values[fieldName];
						await ctx.db
							.updateTable("entries")
							.set({ values: JSON.stringify(sibValues), updated_at: ctx.now() })
							.where("id", "=", sibling.id)
							.execute();
						if (schema.collections[entry.collection]?.kind === "item") {
							await ctx.db
								.updateTable("entry_published")
								.set({ values: JSON.stringify(sibValues) })
								.where("entry_id", "=", sibling.id)
								.execute();
						}
					}
				}
			}
		}
	}
}

/**
 * Cuts every relation to a target group that is deleted for good (doc 08-3). Entries in the trash lose it too, so a restored one names nothing that is gone.
 * The draft and the published copy are each cut on their own: whatever else the draft changed stays unpublished. Each entry is locked as a save locks it, so
 * neither writes over the other, and its version rises, so a screen that read it before saves no stale value over it.
 */
export async function unlinkTargetGroup(
	db: Db,
	schema: Schema,
	targetGroup: string,
	now: Date,
): Promise<{ unlinkedCount: number }> {
	const links = await db.selectFrom("entry_links").select("from_group").where("to_group", "=", targetGroup).execute();
	const fromGroups = [...new Set(links.map((link) => link.from_group))];
	if (fromGroups.length === 0) return { unlinkedCount: 0 };

	const ids = (await db.selectFrom("entries").select("id").where("translation_group", "in", fromGroups).execute()).map(
		(row) => row.id,
	);
	await lockRecords(db, ids.map(ref));
	// Read under the lock: a save that came first has committed, and its values are the ones cut.
	const pointing = await db
		.selectFrom("entries")
		.select(["id", "collection", "values"])
		.where("id", "in", ids)
		.execute();
	const published = new Map(
		(await db.selectFrom("entry_published").select(["entry_id", "values"]).where("entry_id", "in", ids).execute()).map(
			(row) => [row.entry_id, row.values],
		),
	);
	/** The values without the target in any relation field, or `null` when they did not name it. */
	const cut = (collection: string, values: Record<string, unknown>): Record<string, unknown> | null => {
		const next = { ...values };
		let changed = false;
		for (const [field, definition] of Object.entries(storedFields(schema.collections[collection]))) {
			if (definition.kind !== "relation") continue;
			const value = next[field];
			if (Array.isArray(value) && value.includes(targetGroup)) {
				next[field] = value.filter((group) => group !== targetGroup);
				changed = true;
			} else if (value === targetGroup) {
				next[field] = null;
				changed = true;
			}
		}
		return changed ? next : null;
	};
	for (const entry of pointing) {
		const draft = cut(entry.collection, entry.values);
		if (draft)
			await db
				.updateTable("entries")
				.set((eb) => ({ values: JSON.stringify(draft), updated_at: now, version: eb("version", "+", 1) }))
				.where("id", "=", entry.id)
				.execute();
		const shown = published.get(entry.id);
		const site = shown ? cut(entry.collection, shown) : null;
		if (site)
			await db
				.updateTable("entry_published")
				.set({ values: JSON.stringify(site) })
				.where("entry_id", "=", entry.id)
				.execute();
	}

	await db.deleteFrom("entry_links").where("to_group", "=", targetGroup).execute();

	return { unlinkedCount: fromGroups.length };
}
