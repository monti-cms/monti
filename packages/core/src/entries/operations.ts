import { z } from "zod";
import { entryPlace, oneOrMany, recordsOf, titleOf } from "../activity/words";
import { assertDoc } from "../body/check";
import { asDoc, blockMap, type Doc, withNewIds } from "../body/doc";
import { randomUUID } from "../bytes";
import { CheckError, ConflictError } from "../errors";
import { isEmptyValue, sameJson } from "../json";
import { mediaInDoc } from "../media/items";
import { checkMediaValues } from "../media/uses";
import { cleanMediaValue, mediaValueOf } from "../media/value";
import { defineOperation, type OperationContext, type Preview, type RecordRef } from "../operation";
import { lockRecords } from "../records";
import { generateUniqueSlug, resolveInlineCreation, syncRelationsForEntry } from "../relations/sync";
import { choseIn, localeModeOf, notChosenFields, placesOf, type Schema, storedFields } from "../schema/define";
import { dropUnfollowed, translationsOf, unfollowed } from "../translations/chosen";
import { blockHashes, keepLinks } from "../translations/links";
import {
	addedSourceBlocks,
	addSkips,
	followedFields,
	followedHashes,
	isTranslation,
	rememberBlocks,
	seenOf,
	sourceEntryOf,
} from "../translations/source";
import { followerPaths, previewPath, previewSlug, publicPath, publicPaths, publishSlug, slugify } from "./paths";
import { isSecret, PREVIEW_MINUTES, previewToken } from "./preview";
import { type Entry, loadEntries, markChanges } from "./record";
import { fieldValue, type PublishTask, publishTasks } from "./tasks";

/** The places a save can change. Only the ones given change; a value of `null` in `values` empties that field. */
const Draft = {
	title: z.string().optional(),
	slug: z.string().optional(),
	values: z.record(z.string(), z.unknown()).optional(),
	doc: z.unknown().optional(),
};
type DraftInput = { title?: string; slug?: string; values?: Record<string, unknown>; doc?: unknown };
const Ids = z.object({ ids: z.array(z.string()).min(1) });

const ref = (id: string): RecordRef => ({ kind: "entry", id });

/** What the screen shows for the entry: ○ draft, ● published, ● changed, archived. */
export type EntryState = "draft" | "published" | "changed" | "archived";
const stateOf = (entry: Entry): EntryState =>
	entry.status === "published" ? (entry.hasUnpublishedChanges ? "changed" : "published") : entry.status;

export async function entryOf(ctx: OperationContext, id: string): Promise<Entry> {
	const [entry] = await loadEntries(ctx.db, [id]);
	if (!entry) throw new CheckError({ key: "entries.unknown", values: { id } });
	return entry;
}

/** Refuses values the schema does not have room for: an unknown field, or a select option it does not list. */
function checkDraft(schema: Schema, collection: string, draft: DraftInput) {
	const fields = storedFields(schema.collections[collection]);
	if (!fields) throw new CheckError({ key: "collections.unknown", values: { collection } });
	if (draft.slug !== undefined && draft.slug !== slugify(draft.slug))
		throw new CheckError({ key: "entries.badSlug", values: { slug: draft.slug } });
	for (const [field, value] of Object.entries(draft.values ?? {})) {
		const definition = fields[field];
		if (!definition || field === "title" || field === "slug")
			throw new CheckError({ key: "entries.unknownField", values: { field } });
		if (value === null || definition.kind !== "select") continue;
		const chosen = definition.many ? value : [value];
		if (!Array.isArray(chosen) || chosen.some((option) => !definition.options.includes(option as string)))
			throw new CheckError({ key: "entries.badOption", values: { field } });
	}
}

/** The working copy after a draft: given places replaced, `null` values dropped. */
function applyDraft(entry: Pick<Entry, "title" | "slug" | "values" | "doc">, draft: DraftInput) {
	const values = { ...entry.values, ...draft.values };
	for (const [field, value] of Object.entries(values)) if (value === null) delete values[field];
	return {
		title: draft.title ?? entry.title,
		slug: draft.slug ?? entry.slug,
		values,
		doc: draft.doc === undefined ? entry.doc : draft.doc,
	};
}

/**
 * Only the chosen option's values are an entry's (doc 19). Of the working copy a save leaves, the values of a conditional field's other
 * options are dropped; a value the draft itself gives for such a field is refused, with the field's name, so nothing a caller meant to write is
 * dropped unsaid (the assistant's proposal for a field of an option that is not chosen ends here, when it is applied). A translation's choice
 * is its source's, which this copy does not hold: it goes by the source's fields as it follows them (`followed`), and with no source to
 * follow its values are left as they are.
 */
function keepChosen(
	schema: Schema,
	entry: { collection: string; locale: string },
	values: Record<string, unknown>,
	draft: DraftInput,
	followed: Parameters<typeof unfollowed>[3] = null,
) {
	const others =
		entry.locale !== schema.locales.source
			? new Set(unfollowed(schema, entry.collection, values, followed))
			: notChosenFields(schema.collections[entry.collection], values);
	for (const field of others)
		if (!isEmptyValue(draft.values?.[field])) throw new CheckError({ key: "entries.notChosen", values: { field } });
	return Object.fromEntries(Object.entries(values).filter(([field]) => !others.has(field)));
}

/**
 * The plugins' say before an entry is saved (doc 14, `beforeSave`): each in the plugins' order, given the working copy as the one before it
 * left it. What a hook returns is laid over the copy after passing a save's own checks; one that throws a `CheckError` stops the save.
 */
async function beforeSaving(
	ctx: OperationContext,
	entry: { id: string | null; collection: string; locale: string },
	working: Pick<Entry, "title" | "slug" | "values" | "doc">,
	previous: Entry | null,
) {
	const schema = ctx.site.schema();
	let next = working;
	for (const plugin of ctx.site.plugins) {
		if (!plugin.beforeSave) continue;
		const changed = await plugin.beforeSave(
			{ ...entry, title: next.title, slug: next.slug, values: { ...next.values }, doc: next.doc },
			{ db: ctx.db, schema, previous, actor: ctx.actor },
		);
		if (!changed) continue;
		// Only what the hook changed is its say: a hook that hands back every value it was given changes none of them, and what an
		// entry still holds from before (a value of a plugin since taken out) is not held against it.
		const values = Object.fromEntries(
			Object.entries(changed.values ?? {}).filter(
				([field, value]) => !sameJson(value ?? null, next.values[field] ?? null),
			),
		);
		const fields = storedFields(schema.collections[entry.collection]);
		for (const field of Object.keys(values)) {
			const definition = fields[field];
			// A translation's `same` fields are its source's (doc 04), for a hook as for a person.
			if (definition && isTranslation(schema, entry) && localeModeOf(field, definition) === "same")
				throw new CheckError({ key: "entries.sameField", values: { field } });
			// The far side of such a relation is other entries, which the write did not take hold of before it ran.
			if (definition?.kind === "relation" && definition.via !== undefined)
				throw new Error(
					`Plugin ${plugin.name}: beforeSave cannot set "${field}", a relation edited from its other side.`,
				);
		}
		const patch = { title: changed.title, slug: changed.slug, values };
		checkDraft(schema, entry.collection, patch);
		await checkMediaValues(ctx.db, schema, entry.collection, patch.values);
		next = applyDraft(next, patch);
	}
	return next;
}

/** The media fields of these values as they are kept (`cleanMediaValue`). */
function cleanMediaFields(schema: Schema, collection: string, values: Record<string, unknown>) {
	const fields = storedFields(schema.collections[collection]);
	return Object.fromEntries(
		Object.entries(values).map(([name, value]) => {
			const media = fields[name]?.kind === "media" ? mediaValueOf(value) : null;
			return [name, media ? cleanMediaValue(media) : value];
		}),
	);
}

/** Checks the body a draft brings against the body the entry had: a person's save and the assistant's block edits pass the same check (doc 03). */
async function checkBodyOf(ctx: OperationContext, doc: unknown, previous: unknown) {
	if (doc === undefined || doc === null) return;
	assertDoc(doc, ctx.site.kit, (previous as Doc | null) ?? null);
}

/** Writes a new working copy: one version up, "changed" set again, and an `entry.saved` event. Saving and block edits both end here. */
export async function saveWorking(
	ctx: OperationContext,
	entry: Entry,
	working: Pick<Entry, "title" | "slug" | "values" | "doc"> & { translationSeen?: Record<string, unknown> },
): Promise<{ id: string; version: number }> {
	await ctx.db
		.updateTable("entries")
		.set((eb) => ({
			title: working.title,
			slug: working.slug,
			values: JSON.stringify(working.values),
			doc: working.doc === null ? null : JSON.stringify(working.doc),
			...(working.translationSeen ? { translation_seen: JSON.stringify(working.translationSeen) } : {}),
			version: eb("version", "+", 1),
			updated_at: ctx.now(),
		}))
		.where("id", "=", entry.id)
		.execute();
	await markChanges(ctx.db, entry.id);
	ctx.emit({
		type: "entry.saved",
		ids: [entry.id],
		collection: entry.collection,
		locale: entry.locale,
		version: entry.version + 1,
	});
	return { id: entry.id, version: entry.version + 1 };
}

/** Refuses a change to an entry read at another version, or one that is archived or in the trash. */
export async function editableEntry(ctx: OperationContext, id: string, version: number): Promise<Entry> {
	const entry = await entryOf(ctx, id);
	// The version is part of the input, so no entry point can save over a save it has not seen (doc 02, principle 3).
	if (entry.version !== version)
		throw new ConflictError([{ ref: ref(entry.id), expected: version, actual: entry.version }]);
	if (entry.status === "archived") throw new CheckError({ key: "entries.archived" });
	if (entry.trashedAt) throw new CheckError({ key: "entries.trashed" });
	return entry;
}

async function tasksOf(ctx: OperationContext, entry: Entry): Promise<{ slug: string; tasks: PublishTask[] }> {
	const { slug, taken } = await publishSlug(ctx.db, entry);
	return { slug, tasks: await publishTasks(ctx.db, ctx.site, entry, taken) };
}

type PublishPlan = { entry: Entry; slug: string; tasks: PublishTask[]; blocked: PreviewBlock | null };
type PreviewBlock = NonNullable<Preview["blocked"]>[number]["reason"];

/** For each entry, the slug it would publish under and, when it cannot be published, why. Publishing, its preview and its check share this. */
async function planPublish(ctx: OperationContext, ids: string[]): Promise<PublishPlan[]> {
	const entries = await loadEntries(ctx.db, ids);
	return Promise.all(
		entries.map(async (entry): Promise<PublishPlan> => {
			const { slug, tasks } = await tasksOf(ctx, entry);
			const blocking = tasks.filter((task) => task.blocking).length;
			const blocked: PreviewBlock | null =
				ctx.site.schema().collections[entry.collection]?.kind !== "document"
					? { key: "entries.notDocument" }
					: entry.status === "archived"
						? { key: "entries.archived" }
						: entry.trashedAt
							? { key: "entries.trashed" }
							: blocking > 0
								? { key: "entries.publishBlocked", values: { count: blocking } }
								: null;
			return { entry, slug, tasks, blocked };
		}),
	);
}

async function oldSlug(ctx: OperationContext, entry: Entry) {
	return (
		(await ctx.db
			.selectFrom("entry_published")
			.select(["slug", "published_at"])
			.where("entry_id", "=", entry.id)
			.executeTakeFirst()) ?? null
	);
}

/**
 * The body, block by block (`doc.<block id>`), so "3 places differ" counts blocks, not the whole body (doc 02, compare). A changed order is one more
 * place, `doc.order`.
 */
function docPlaces(mine: unknown, server: unknown) {
	const ours = blockMap((mine as Doc | null) ?? null);
	const theirs = blockMap((server as Doc | null) ?? null);
	const topIds = (doc: unknown) => ((doc as Doc | null)?.blocks ?? []).map((block) => block.id);
	return [
		...[...new Set([...topIds(mine), ...topIds(server)])].map((id) => ({
			place: `doc.${id}`,
			mine: ours.get(id),
			server: theirs.get(id),
		})),
		{
			place: "doc.order",
			mine: topIds(mine).filter((id) => theirs.has(id)),
			server: topIds(server).filter((id) => ours.has(id)),
		},
	];
}

/**
 * These entries, and the translations of those that are sources in a collection with a conditional field: a change of what the site shows of
 * a source may take values out of its translations (`dropUnfollowed`), so they are records of the write, locked and put back by an undo.
 */
async function withTranslations(ctx: Pick<OperationContext, "db" | "site">, ids: string[]): Promise<RecordRef[]> {
	const all = new Set(ids);
	for (const entry of await loadEntries(ctx.db, ids)) for (const id of await translationsOf(ctx, entry)) all.add(id);
	return [...all].map(ref);
}

export const entryOperations = [
	defineOperation({
		name: "entries.create",
		kind: "write",
		description:
			"Create an entry in a collection and language, optionally with a title, slug, field values and either a body or a template (templates.list) to start the body from. It starts as a draft. An empty slug blocks publishing until one is set.",
		input: z.object({
			collection: z.string(),
			/** Always the site's source language; a translation is made with translations.create (doc 04). */
			locale: z.string().min(1).optional(),
			template: z.string().optional(),
			...Draft,
		}),
		async check(input, ctx) {
			const { source } = ctx.site.schema().locales;
			if (input.locale !== undefined && input.locale !== source)
				throw new CheckError({ key: "entries.notSourceLocale", values: { locale: input.locale, source } });
			checkDraft(ctx.site.schema(), input.collection, input);
			await checkMediaValues(ctx.db, ctx.site.schema(), input.collection, input.values);
			if (input.template !== undefined && input.doc !== undefined)
				throw new CheckError({ key: "entries.docAndTemplate" });
			await checkBodyOf(ctx, input.doc, null);
		},
		async run(input, ctx) {
			const id = randomUUID();
			const locale = ctx.site.schema().locales.source;
			const isItem = ctx.site.schema().collections[input.collection]?.kind === "item";
			let values = input.values ? { ...input.values } : {};
			values = await resolveInlineCreation(ctx, input.collection, values);
			const drafted = applyDraft({ title: "", slug: "", values: {}, doc: null }, { ...input, values });
			if (input.template !== undefined) {
				const template = await ctx.db
					.selectFrom("templates")
					.select("doc")
					.where("id", "=", input.template)
					.executeTakeFirst();
				if (!template) throw new CheckError({ key: "templates.unknown", values: { id: input.template } });
				// New ids, and the blocks go in as the template has them, even ones the site no longer defines (doc 03, decisions).
				const doc = template.doc as Doc;
				drafted.doc = { type: "doc", blocks: doc.blocks.map(withNewIds) };
				await checkBodyOf(ctx, drafted.doc, drafted.doc);
			}
			// The plugins see the entry as it will be saved, its template's body included.
			const working = await beforeSaving(ctx, { id: null, collection: input.collection, locale }, drafted, null);
			working.values = keepChosen(ctx.site.schema(), { collection: input.collection, locale }, working.values, input);
			working.values = cleanMediaFields(ctx.site.schema(), input.collection, working.values);
			if (isItem && working.slug === "" && working.title !== "") {
				working.slug = await generateUniqueSlug(ctx.db, input.collection, locale, working.title, undefined, id);
			}
			const translationGroup = randomUUID();
			const now = ctx.now();
			const isItemLive = isItem && working.title !== "" && working.slug !== "";
			const status = isItemLive ? "published" : "draft";
			const hasUnpublishedChanges = false;
			await ctx.db
				.insertInto("entries")
				.values({
					id,
					collection: input.collection,
					translation_group: translationGroup,
					locale,
					title: working.title,
					slug: working.slug,
					status,
					has_unpublished_changes: hasUnpublishedChanges,
					values: JSON.stringify(working.values),
					doc: working.doc === null ? null : JSON.stringify(working.doc),
				})
				.execute();
			if (isItemLive) {
				await ctx.db
					.insertInto("entry_published")
					.values({
						entry_id: id,
						collection: input.collection,
						locale,
						title: working.title,
						slug: working.slug,
						values: JSON.stringify(working.values),
						doc: null,
						published_at: now,
						from_version: 1,
						block_hashes: JSON.stringify({}),
					})
					.execute();
			}
			await syncRelationsForEntry(ctx, { id, collection: input.collection, translationGroup, locale }, working.values);
			ctx.created(ref(id));
			ctx.emit({ type: "entry.saved", ids: [id], collection: input.collection, locale, version: 1 });
			if (isItemLive) {
				ctx.emit({
					type: "entry.published",
					ids: [id],
					collection: input.collection,
					locale,
					paths: publicPaths(ctx.site.schema(), input.collection, locale, [working.slug]),
				});
			}
			return { id };
		},
		log: "save",
		summary: (_input, output, records) => ({
			key: "entries.create",
			values: { title: titleOf(records, "entry", output.id) },
		}),
		where: (_input, output, records) => entryPlace(recordsOf(records, "entry", [output.id])),
	}),
	defineOperation({
		name: "entries.get",
		kind: "read",
		description:
			"Read an entry: its working copy (title, slug, field values, body), what the site shows (published slug and date), its version, state, publish to-do list and the media files its body shows.",
		input: z.object({ id: z.string() }),
		async run(input, ctx) {
			const entry = await entryOf(ctx, input.id);
			const schema = ctx.site.schema();
			const fields = storedFields(schema.collections[entry.collection]);
			for (const [fieldName, fieldDef] of Object.entries(fields)) {
				if (fieldDef.kind === "relation" && fieldDef.via !== undefined) {
					if (entry.values[fieldName] === undefined || entry.values[fieldName] === null) {
						const viaLinks = await ctx.db
							.selectFrom("entry_links")
							.select("from_group")
							.where("field", "=", fieldDef.via)
							.where("to_group", "=", entry.translationGroup)
							.orderBy("position", "asc")
							.execute();
						const groups = viaLinks.map((l) => l.from_group);
						entry.values[fieldName] = fieldDef.many ? groups : (groups[0] ?? null);
					}
				}
			}
			const published = await ctx.db
				.selectFrom("entry_published")
				.select(["slug", "published_at", "from_version"])
				.where("entry_id", "=", entry.id)
				.executeTakeFirst();
			return {
				entry,
				state: stateOf(entry),
				published: published
					? {
							slug: published.slug,
							path: publicPath(ctx.site.schema(), entry.collection, published.slug, entry.locale),
							publishedAt: published.published_at,
							fromVersion: published.from_version,
						}
					: null,
				tasks: (await tasksOf(ctx, entry)).tasks,
				// The files its body shows, so the editor need not read them after it (their shapes hold the pictures' places).
				media: await mediaInDoc(ctx, entry.doc),
			};
		},
	}),
	defineOperation({
		name: "entries.save",
		kind: "write",
		description:
			"Save changed places of an entry's working copy: title, slug, field values (null empties a field) and body. Give the version you read: if it was saved elsewhere since, the save is refused as a conflict. Archived entries cannot be changed; unarchive first. Saving does not change the site; publishing does.",
		input: z.object({ id: z.string(), version: z.number().int(), ...Draft }),
		// A save names the places it changes, so in a proposal it can follow another change of the same entry; a save that brings a whole body
		// replaces what the other change left, and cannot.
		follows: (input, versions) =>
			input.doc !== undefined ? null : { ...input, version: versions[`entry:${input.id}`] ?? input.version },
		places: (input) => [
			...(input.title === undefined ? [] : [`entry:${input.id}/title`]),
			...(input.slug === undefined ? [] : [`entry:${input.id}/slug`]),
			...Object.keys(input.values ?? {}).map((field) => `entry:${input.id}/field/${field}`),
			// A whole body: it holds every block, so no block edit of the same entry waits beside it.
			...(input.doc === undefined ? [] : [`entry:${input.id}/body`]),
		],
		async touches(input, ctx) {
			const [entry] = await loadEntries(ctx.db, [input.id]);
			if (!entry) return [ref(input.id)];
			const touchedIds = new Set<string>([entry.id]);
			// Siblings for 'same' fields
			const siblings = await ctx.db
				.selectFrom("entries")
				.select("id")
				.where("translation_group", "=", entry.translationGroup)
				.where("id", "<>", entry.id)
				.where("trashed_at", "is", null)
				.execute();
			for (const s of siblings) touchedIds.add(s.id);

			// Via relation targets
			const colFields = storedFields(ctx.site.schema().collections[entry.collection]);
			for (const [fName, fDef] of Object.entries(colFields)) {
				if (fDef.kind === "relation" && fDef.via !== undefined) {
					const viaGroups = new Set<string>();
					const curr = entry.values[fName];
					if (typeof curr === "string" && curr) viaGroups.add(curr);
					else if (Array.isArray(curr)) for (const g of curr) if (typeof g === "string") viaGroups.add(g);
					const next = input.values?.[fName];
					if (typeof next === "string" && next) viaGroups.add(next);
					else if (Array.isArray(next)) for (const g of next) if (typeof g === "string") viaGroups.add(g);

					if (viaGroups.size > 0) {
						const targetRows = await ctx.db
							.selectFrom("entries")
							.select("id")
							.where("collection", "=", fDef.to)
							.where("translation_group", "in", [...viaGroups])
							.where("trashed_at", "is", null)
							.execute();
						for (const tr of targetRows) touchedIds.add(tr.id);
					}
				}
			}
			return [...touchedIds].map(ref);
		},
		async check(input, ctx) {
			const entry = await editableEntry(ctx, input.id, input.version);
			const schema = ctx.site.schema();
			checkDraft(schema, entry.collection, input);
			await checkMediaValues(ctx.db, schema, entry.collection, input.values);
			// A translation's `same` fields are the source's: they are changed there (doc 04, field values).
			if (isTranslation(schema, entry))
				for (const field of Object.keys(input.values ?? {})) {
					const definition = storedFields(schema.collections[entry.collection])[field];
					if (definition && localeModeOf(field, definition) === "same")
						throw new CheckError({ key: "entries.sameField", values: { field } });
				}
			await checkBodyOf(ctx, input.doc, entry.doc);
		},
		// What the save would do with the entry's conditional fields (doc 19), for a proposal that waits: a value for a field of an option
		// that is not chosen leaves the entry alone, with why (the save refuses it when applied); a changed choice says which values go
		// with the option it leaves. A translation's choice is its source's: nothing is said of it here.
		async preview(input, ctx) {
			const [entry] = await loadEntries(ctx.db, [input.id]);
			const me = ref(input.id);
			const summary = { key: "entries.save", values: { title: input.title ?? entry?.title ?? "" } };
			const schema = ctx.site.schema();
			if (!entry || !input.values || isTranslation(schema, entry)) return { summary, changes: [me] };
			const fields = storedFields(schema.collections[entry.collection]);
			const next = { ...entry.values, ...input.values };
			for (const [field, value] of Object.entries(input.values)) {
				const missing = isEmptyValue(value)
					? undefined
					: placesOf(fields[field]?.under).find((place) => next[place.field] !== place.option);
				if (missing)
					return {
						summary,
						changes: [],
						blocked: [
							{
								ref: me,
								reason: { key: "entries.optionNotChosen", values: { field: missing.field, option: missing.option } },
								// A change of that choice, made first, is what would make the field the entry's.
								unless: [`entry:${input.id}/field/${missing.field}`],
							},
						],
					};
			}
			const cleared = Object.entries(fields).flatMap(([field, definition]) =>
				definition.under &&
				!isEmptyValue(entry.values[field]) &&
				choseIn(definition.under, entry.values) &&
				!choseIn(definition.under, next)
					? [{ field, value: entry.values[field] }]
					: [],
			);
			return { summary, changes: [me], ...(cleared.length > 0 ? { clears: cleared } : {}) };
		},
		async run(input, ctx) {
			const entry = await entryOf(ctx, input.id);
			const isItem = ctx.site.schema().collections[entry.collection]?.kind === "item";
			let values = input.values ? { ...input.values } : undefined;
			if (values) {
				values = await resolveInlineCreation(ctx, entry.collection, values);
			}
			const working = await beforeSaving(ctx, entry, applyDraft(entry, { ...input, values }), entry);
			const schema = ctx.site.schema();
			working.values = keepChosen(
				schema,
				entry,
				working.values,
				input,
				isTranslation(schema, entry)
					? await followedFields(ctx.db, await sourceEntryOf(ctx.db, schema, entry.translationGroup))
					: null,
			);
			working.values = cleanMediaFields(ctx.site.schema(), entry.collection, working.values);
			if (isItem && working.slug === "" && working.title !== "") {
				working.slug = await generateUniqueSlug(
					ctx.db,
					entry.collection,
					entry.locale,
					working.title,
					entry.id,
					entry.id,
				);
			}
			// What it has seen of its source is the core's too: a save only says which fields hold a value now (doc 04).
			const translationSeen = await seenOf(ctx.db, ctx.site.schema(), entry, working);
			let saved: { id: string; version: number };
			if (input.doc === undefined || working.doc === null) {
				saved = await saveWorking(ctx, entry, { ...working, translationSeen });
			} else {
				// The links are the core's: the save keeps them, whatever the editor sent, but for a new block paired with a source block added since (doc 04).
				const added = await addedSourceBlocks(ctx, entry);
				// A block whose words change takes in what its source block says now (2026-11-10, owner).
				const hashes = await followedHashes(ctx.db, ctx.site.schema(), entry);
				const { doc, skipped } = keepLinks(asDoc(entry.doc), working.doc as Doc, hashes, new Set(), added);
				saved = await saveWorking(ctx, entry, { ...working, doc, translationSeen });
				await addSkips(ctx.db, entry, skipped);
			}
			if (isItem && working.title !== "" && working.slug !== "") {
				const now = ctx.now();
				await ctx.db
					.updateTable("entries")
					.set({ status: "published", has_unpublished_changes: false, slug: working.slug })
					.where("id", "=", entry.id)
					.execute();
				const publishedRow = {
					collection: entry.collection,
					locale: entry.locale,
					title: working.title,
					slug: working.slug,
					values: JSON.stringify(working.values),
					doc: null,
					published_at: now,
					from_version: saved.version,
					block_hashes: JSON.stringify({}),
				};
				await ctx.db
					.insertInto("entry_published")
					.values({ entry_id: entry.id, ...publishedRow })
					.onConflict((conflict) => conflict.column("entry_id").doUpdateSet(publishedRow))
					.execute();
				ctx.emit({
					type: "entry.published",
					ids: [entry.id],
					collection: entry.collection,
					locale: entry.locale,
					// The page it had before the save too, when its address changed.
					paths: publicPaths(ctx.site.schema(), entry.collection, entry.locale, [working.slug, entry.slug]),
				});
			}
			await syncRelationsForEntry(
				ctx,
				{
					id: entry.id,
					collection: entry.collection,
					translationGroup: entry.translationGroup,
					locale: entry.locale,
				},
				working.values,
				entry.values,
			);
			// A source whose choice changed where its translations follow it (it is not on the site, or it is an item, live on save): the
			// translations lose what was the other option's (doc 19). They are records of this save (`touches`).
			await dropUnfollowed(ctx, await translationsOf(ctx, entry));
			return saved;
		},
		log: "save",
		summary: (input, _output, records) => ({
			key: "entries.save",
			values: { title: titleOf(records, "entry", input.id) },
		}),
		where: (input, _output, records) => entryPlace(recordsOf(records, "entry", [input.id])),
	}),
	defineOperation({
		name: "entries.compare",
		kind: "read",
		description:
			"Compare an unsaved draft of an entry with the latest saved copy, place by place (title, slug, each field, body). Used after a conflict or for a browser draft.",
		input: z.object({ id: z.string(), ...Draft }),
		async run(input, ctx) {
			const entry = await entryOf(ctx, input.id);
			const mine = applyDraft(entry, input);
			// A field of an option that is not chosen in the draft is no place of its own: the choice is the place that differs (doc 19). Where
			// the two sides chose different options, the options' fields differ because the choice does: the choice is the one place.
			const collection = ctx.site.schema().collections[entry.collection];
			const others = notChosenFields(collection, mine.values);
			for (const field of others) delete mine.values[field];
			for (const [field, definition] of Object.entries(storedFields(collection)))
				if (placesOf(definition.under).some((place) => !sameJson(mine.values[place.field], entry.values[place.field])))
					others.add(field);
			const places = [
				...(["title", "slug"] as const).map((place) => ({ place, mine: mine[place], server: entry[place] })),
				...[...new Set([...Object.keys(mine.values), ...Object.keys(entry.values)])]
					.filter((field) => !others.has(field))
					.map((field) => ({
						place: `values.${field}`,
						mine: fieldValue(mine, field),
						server: fieldValue(entry, field),
					})),
				...docPlaces(mine.doc, entry.doc),
			].filter((place) => !sameJson(place.mine, place.server));
			return { version: entry.version, updatedAt: entry.updatedAt, places };
		},
	}),
	defineOperation({
		name: "entries.checkPublish",
		kind: "read",
		description:
			"The publish to-do list of an entry: empty required fields, an empty slug, a slug another entry is published under, and plugins' checks. Blocking rows stop the publish.",
		input: z.object({ id: z.string() }),
		async run(input, ctx) {
			const { tasks, slug } = await tasksOf(ctx, await entryOf(ctx, input.id));
			return { slug, tasks, blocking: tasks.filter((task) => task.blocking).length };
		},
	}),
	defineOperation({
		name: "entries.publish",
		kind: "write",
		description:
			'Publish entries: copy each working copy to the site. An entry with an empty slug or another blocking to-do row is not published. Republishing keeps the first publish date ("keep") or sets today ("today"). Entries with blocking to-do rows are left alone; the preview lists them.',
		input: Ids.extend({ date: z.enum(["keep", "today"]).default("keep") }),
		// One by one: the assistant's proposal has an item per entry, each taken or left on its own (doc 10).
		each: "ids",
		// In a proposal it comes after a change of the same entry (a summary filled in, then published): it carries no version of its own, so it
		// follows as it is. What it changes is what the site shows of the entry: two of these on one entry do not wait side by side.
		follows: (input) => input,
		places: (input) => input.ids.map((id) => `entry:${id}/site`),
		touches: (input, ctx) => withTranslations(ctx, input.ids),
		async preview(input, ctx) {
			const plans = await planPublish(ctx, input.ids);
			const ready = plans.filter((plan) => !plan.blocked);
			const moved = await Promise.all(ready.map(async (plan) => (await oldSlug(ctx, plan.entry))?.slug ?? plan.slug));
			return {
				summary: {
					key: "entries.publish",
					values: { count: ready.length, movedPaths: ready.filter((plan, index) => moved[index] !== plan.slug).length },
				},
				changes: ready.map((plan) => ref(plan.entry.id)),
				blocked: plans.flatMap((plan) =>
					plan.blocked
						? [
								{
									ref: ref(plan.entry.id),
									reason: plan.blocked,
									// What blocks it is a to-do of the entry: a change of the entry made first may clear it (a summary filled in).
									...(plan.blocked.key === "entries.publishBlocked" ? { unless: [`entry:${plan.entry.id}`] } : {}),
								},
							]
						: [],
				),
			};
		},
		async check(input, ctx) {
			const plans = await planPublish(ctx, input.ids);
			if (plans.length < new Set(input.ids).size) throw new CheckError({ key: "entries.unknown" });
			const first = plans[0].blocked;
			if (plans.every((plan) => plan.blocked))
				throw new CheckError(plans.length === 1 && first ? first : { key: "entries.nothingToPublish" });
		},
		async run(input, ctx) {
			const schema = ctx.site.schema();
			const now = ctx.now();
			const published: string[] = [];
			for (const { entry: planned, blocked } of await planPublish(ctx, input.ids)) {
				if (blocked) continue;
				// As it is now: a source published earlier in this loop may have taken an old option's values out of this translation.
				const [entry = planned] = await loadEntries(ctx.db, [planned.id]);
				// Again per entry: an entry published earlier in this loop may have taken the slug.
				const { slug, taken } = await publishSlug(ctx.db, entry);
				if (taken || slug === "") continue;
				const previous = await oldSlug(ctx, entry);
				const version = entry.version + 1;
				await ctx.db
					.updateTable("entries")
					.set({ slug, status: "published", has_unpublished_changes: false, version })
					.where("id", "=", entry.id)
					.execute();
				// An old path under a slug that is live again is never read: the site looks for a published slug first.
				if (previous && previous.slug !== slug)
					await ctx.db
						.insertInto("old_paths")
						.values({ collection: entry.collection, locale: entry.locale, slug: previous.slug, entry_id: entry.id })
						.onConflict((conflict) =>
							conflict.columns(["collection", "locale", "slug"]).doUpdateSet({ entry_id: entry.id }),
						)
						.execute();
				const copy = {
					collection: entry.collection,
					locale: entry.locale,
					title: entry.title,
					slug,
					values: JSON.stringify(entry.values),
					doc: entry.doc === null ? null : JSON.stringify(entry.doc),
					published_at: previous && input.date === "keep" ? previous.published_at : now,
					from_version: version,
					// What a translation's marks are counted against (doc 04).
					block_hashes: JSON.stringify(blockHashes(entry.doc as Doc | null)),
				};
				if (!isTranslation(schema, entry)) await rememberBlocks(ctx.db, asDoc(entry.doc).blocks);
				await ctx.db
					.insertInto("entry_published")
					.values({ entry_id: entry.id, ...copy })
					.onConflict((conflict) => conflict.column("entry_id").doUpdateSet(copy))
					.execute();
				const paths = publicPaths(schema, entry.collection, entry.locale, [slug, previous?.slug]);
				// A published translation's page changes with its source's (doc 04).
				paths.push(...(await followerPaths(ctx.db, schema, entry)));
				ctx.emit({
					type: "entry.published",
					ids: [entry.id],
					collection: entry.collection,
					locale: entry.locale,
					version,
					paths,
				});
				published.push(entry.id);
				// What its translations follow of it is what the site shows now: they lose what was another option's (doc 19).
				await dropUnfollowed(ctx, await translationsOf(ctx, entry));
			}
			return { published, blocked: input.ids.filter((id) => !published.includes(id)) };
		},
		log: "publish",
		summary: (_input, output, records) => oneOrMany("entries.publish", recordsOf(records, "entry", output.published)),
		where: (_input, output, records) => entryPlace(recordsOf(records, "entry", output.published)),
	}),
	defineOperation({
		name: "entries.archive",
		kind: "write",
		description:
			"Archive entries: take them off the site. They leave the list's default view and become read-only until unarchived, which makes them drafts again.",
		input: Ids,
		// One by one: the assistant's proposal has an item per entry, each taken or left on its own (doc 10).
		each: "ids",
		// In a proposal it comes after a change of the same entry (a summary filled in, then published): it carries no version of its own, so it
		// follows as it is. What it changes is what the site shows of the entry: two of these on one entry do not wait side by side.
		follows: (input) => input,
		places: (input) => input.ids.map((id) => `entry:${id}/site`),
		touches: (input, ctx) => withTranslations(ctx, input.ids),
		async run(input, ctx) {
			const archived: string[] = [];
			for (const id of input.ids) {
				// As it is now: a source archived earlier in this loop may have changed this translation.
				const [entry] = await loadEntries(ctx.db, [id]);
				if (!entry || entry.status === "archived") continue;
				const previous = await oldSlug(ctx, entry);
				await ctx.db.deleteFrom("entry_published").where("entry_id", "=", entry.id).execute();
				await ctx.db
					.updateTable("entries")
					.set({ status: "archived", has_unpublished_changes: false, version: entry.version + 1 })
					.where("id", "=", entry.id)
					.execute();
				if (previous)
					ctx.emit({
						type: "entry.unpublished",
						ids: [entry.id],
						collection: entry.collection,
						locale: entry.locale,
						paths: [publicPath(ctx.site.schema(), entry.collection, previous.slug, entry.locale) ?? []].flat(),
					});
				archived.push(entry.id);
				// Off the site, its translations follow its working copy, which may have another option chosen (doc 19).
				await dropUnfollowed(ctx, await translationsOf(ctx, entry));
			}
			return { archived };
		},
		log: "publish",
		summary: (_input, output, records) => oneOrMany("entries.archive", recordsOf(records, "entry", output.archived)),
		where: (_input, output, records) => entryPlace(recordsOf(records, "entry", output.archived)),
	}),
	defineOperation({
		name: "entries.unarchive",
		kind: "write",
		description: "Unarchive entries: they become drafts, and reach the site again only when published.",
		input: Ids,
		// One by one: the assistant's proposal has an item per entry, each taken or left on its own (doc 10).
		each: "ids",
		// In a proposal it comes after a change of the same entry (a summary filled in, then published): it carries no version of its own, so it
		// follows as it is. What it changes is what the site shows of the entry: two of these on one entry do not wait side by side.
		follows: (input) => input,
		places: (input) => input.ids.map((id) => `entry:${id}/site`),
		touches: (input) => input.ids.map(ref),
		async run(input, ctx) {
			const unarchived: string[] = [];
			for (const entry of await loadEntries(ctx.db, input.ids)) {
				if (entry.status !== "archived") continue;
				await ctx.db
					.updateTable("entries")
					.set({ status: "draft", version: entry.version + 1 })
					.where("id", "=", entry.id)
					.execute();
				unarchived.push(entry.id);
			}
			return { unarchived };
		},
		log: "publish",
		summary: (_input, output, records) =>
			oneOrMany("entries.unarchive", recordsOf(records, "entry", output.unarchived)),
		where: (_input, output, records) => entryPlace(recordsOf(records, "entry", output.unarchived)),
	}),
	defineOperation({
		name: "entries.duplicate",
		kind: "write",
		description:
			"Copy a source-language entry's working copy into a new draft of the same collection, with an empty slug. A translation is not copied: copy its source and translate the copy.",
		input: z.object({ id: z.string() }),
		async check(input, ctx) {
			if (isTranslation(ctx.site.schema(), await entryOf(ctx, input.id)))
				throw new CheckError({ key: "entries.duplicateTranslation" });
		},
		async run(input, ctx) {
			// The source is held while it is copied: a folder on its way to the trash takes its entries first (doc 11), so the copy never lands in a
			// folder that is leaving. A source in a thrown-away folder is copied to the top level.
			await lockRecords(ctx.db, [ref(input.id)]);
			const entry = await entryOf(ctx, input.id);
			const folder =
				entry.folderId === null
					? undefined
					: await ctx.db
							.selectFrom("folders")
							.select("id")
							.where("id", "=", entry.folderId)
							.where("trashed_at", "is", null)
							.executeTakeFirst();
			const id = randomUUID();
			await ctx.db
				.insertInto("entries")
				.values({
					id,
					collection: entry.collection,
					translation_group: randomUUID(),
					locale: entry.locale,
					title: entry.title,
					slug: "",
					folder_id: folder?.id ?? null,
					values: JSON.stringify(entry.values),
					doc: entry.doc === null ? null : JSON.stringify(entry.doc),
				})
				.execute();
			ctx.created(ref(id));
			return { id };
		},
		log: "save",
		summary: (_input, output, records) => ({
			key: "entries.duplicate",
			values: { title: titleOf(records, "entry", output.id) },
		}),
		where: (_input, output, records) => entryPlace(recordsOf(records, "entry", [output.id])),
	}),
	defineOperation({
		name: "entries.export",
		kind: "read",
		description: "Export entries as JSON: each working copy with what the site shows of it.",
		input: Ids,
		async run(input, ctx) {
			const entries = await loadEntries(ctx.db, input.ids);
			const published = await ctx.db
				.selectFrom("entry_published")
				.selectAll()
				.where("entry_id", "in", input.ids)
				.execute();
			return {
				format: "monti.entries",
				version: 1,
				entries: entries.map((entry) => ({
					...entry,
					published: published.find((copy) => copy.entry_id === entry.id) ?? null,
				})),
			};
		},
	}),
	defineOperation({
		name: "entries.previewLink",
		kind: "read",
		description:
			"A short-lived link that lets the site show an entry's working copy before it is published: a token, and the path to open it at (the collection's preview page when it has one, the public address otherwise). Refused when the entry has neither title nor body.",
		input: z.object({ id: z.string() }),
		async run(input, ctx) {
			const entry = await entryOf(ctx, input.id);
			if (!isSecret(ctx.site.secret)) throw new CheckError({ key: "entries.noSecret" });
			if (entry.title === "" && (entry.doc === null || entry.doc === undefined))
				throw new CheckError({ key: "entries.nothingToPreview" });
			const expiresAt = new Date(ctx.now().getTime() + PREVIEW_MINUTES * 60_000);
			const slug = previewSlug(entry);
			return {
				token: await previewToken(ctx.site.secret, entry.id, expiresAt),
				path: previewPath(ctx.site.schema(), entry.collection, slug, entry.locale),
				expiresAt,
			};
		},
	}),
];
