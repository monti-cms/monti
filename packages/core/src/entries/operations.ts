import { z } from "zod";
import { assertDoc } from "../body/check";
import { blockMap, type Doc, withNewIds } from "../body/doc";
import { randomUUID } from "../bytes";
import { CheckError, ConflictError } from "../errors";
import { sameJson } from "../json";
import { defineOperation, type OperationContext, type Preview, type RecordRef } from "../operation";
import type { Schema } from "../schema/define";
import { publicPath, publishSlug, slugify } from "./paths";
import { PREVIEW_MINUTES, previewToken } from "./preview";
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
	const fields = schema.collections[collection]?.fields;
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

/** Checks the body a draft brings against the body the entry had: a person's save and the assistant's block edits pass the same check (doc 03). */
async function checkBodyOf(ctx: OperationContext, doc: unknown, previous: unknown) {
	if (doc === undefined || doc === null) return;
	assertDoc(doc, ctx.site.kit, (previous as Doc | null) ?? null);
}

/** Writes a new working copy: one version up, "changed" set again, and an `entry.saved` event. Saving and block edits both end here. */
export async function saveWorking(
	ctx: OperationContext,
	entry: Entry,
	working: Pick<Entry, "title" | "slug" | "values" | "doc">,
): Promise<{ id: string; version: number }> {
	await ctx.db
		.updateTable("entries")
		.set((eb) => ({
			title: working.title,
			slug: working.slug,
			values: JSON.stringify(working.values),
			doc: working.doc === null ? null : JSON.stringify(working.doc),
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

export const entryOperations = [
	defineOperation({
		name: "entries.create",
		kind: "write",
		description:
			"Create an entry in a collection and language, optionally with a title, field values and either a body or a template (templates.list) to start the body from. It starts as a draft with an empty slug, made from the title when it is first published.",
		input: z.object({ collection: z.string(), locale: z.string().min(1), template: z.string().optional(), ...Draft }),
		async check(input, ctx) {
			checkDraft(ctx.site.schema(), input.collection, input);
			if (input.template !== undefined && input.doc !== undefined)
				throw new CheckError({ key: "entries.docAndTemplate" });
			await checkBodyOf(ctx, input.doc, null);
		},
		async run(input, ctx) {
			const id = randomUUID();
			const working = applyDraft({ title: "", slug: "", values: {}, doc: null }, input);
			if (input.template !== undefined) {
				const template = await ctx.db
					.selectFrom("templates")
					.select("doc")
					.where("id", "=", input.template)
					.executeTakeFirst();
				if (!template) throw new CheckError({ key: "templates.unknown", values: { id: input.template } });
				// New ids, and the blocks go in as the template has them, even ones the site no longer defines (doc 03, decisions).
				const doc = template.doc as Doc;
				working.doc = { type: "doc", blocks: doc.blocks.map(withNewIds) };
				await checkBodyOf(ctx, working.doc, working.doc);
			}
			await ctx.db
				.insertInto("entries")
				.values({
					id,
					collection: input.collection,
					translation_group: randomUUID(),
					locale: input.locale,
					title: working.title,
					slug: working.slug,
					values: JSON.stringify(working.values),
					doc: working.doc === null ? null : JSON.stringify(working.doc),
				})
				.execute();
			ctx.created(ref(id));
			ctx.emit({ type: "entry.saved", ids: [id], collection: input.collection, locale: input.locale, version: 1 });
			return { id };
		},
		summary: (input) => ({ key: "entries.create", values: { title: input.title ?? "" } }),
	}),
	defineOperation({
		name: "entries.get",
		kind: "read",
		description:
			"Read an entry: its working copy (title, slug, field values, body), what the site shows (published slug and date), its version, state and publish to-do list.",
		input: z.object({ id: z.string() }),
		async run(input, ctx) {
			const entry = await entryOf(ctx, input.id);
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
							path: publicPath(ctx.site.schema(), entry.collection, published.slug),
							publishedAt: published.published_at,
							fromVersion: published.from_version,
						}
					: null,
				tasks: (await tasksOf(ctx, entry)).tasks,
			};
		},
	}),
	defineOperation({
		name: "entries.save",
		kind: "write",
		description:
			"Save changed places of an entry's working copy: title, slug, field values (null empties a field) and body. Give the version you read: if it was saved elsewhere since, the save is refused as a conflict. Archived entries cannot be changed; unarchive first. Saving does not change the site; publishing does.",
		input: z.object({ id: z.string(), version: z.number().int(), ...Draft }),
		touches: (input) => [ref(input.id)],
		async check(input, ctx) {
			const entry = await editableEntry(ctx, input.id, input.version);
			checkDraft(ctx.site.schema(), entry.collection, input);
			await checkBodyOf(ctx, input.doc, entry.doc);
		},
		async run(input, ctx) {
			const entry = await entryOf(ctx, input.id);
			return saveWorking(ctx, entry, applyDraft(entry, input));
		},
		summary: (input) => ({ key: "entries.save", values: { id: input.id } }),
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
			const places = [
				...(["title", "slug"] as const).map((place) => ({ place, mine: mine[place], server: entry[place] })),
				...[...new Set([...Object.keys(mine.values), ...Object.keys(entry.values)])].map((field) => ({
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
			"The publish to-do list of an entry: empty required fields, a slug another entry is published under, and plugins' checks. Blocking rows stop the publish.",
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
			'Publish entries: copy each working copy to the site. An empty slug is made from the title. Republishing keeps the first publish date ("keep") or sets today ("today"). Entries with blocking to-do rows are left alone; the preview lists them.',
		input: Ids.extend({ date: z.enum(["keep", "today"]).default("keep") }),
		touches: (input) => input.ids.map(ref),
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
				blocked: plans.flatMap((plan) => (plan.blocked ? [{ ref: ref(plan.entry.id), reason: plan.blocked }] : [])),
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
			for (const { entry, blocked } of await planPublish(ctx, input.ids)) {
				if (blocked) continue;
				// Again per entry: an entry published earlier in this loop may have taken the slug.
				const { slug, taken } = await publishSlug(ctx.db, entry);
				if (taken) continue;
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
				};
				await ctx.db
					.insertInto("entry_published")
					.values({ entry_id: entry.id, ...copy })
					.onConflict((conflict) => conflict.column("entry_id").doUpdateSet(copy))
					.execute();
				const paths = [slug, ...(previous && previous.slug !== slug ? [previous.slug] : [])].flatMap(
					(each) => publicPath(schema, entry.collection, each) ?? [],
				);
				ctx.emit({
					type: "entry.published",
					ids: [entry.id],
					collection: entry.collection,
					locale: entry.locale,
					version,
					paths,
				});
				published.push(entry.id);
			}
			return { published, blocked: input.ids.filter((id) => !published.includes(id)) };
		},
		summary: (_input, output) => ({ key: "entries.publish", values: { count: output.published.length } }),
	}),
	defineOperation({
		name: "entries.archive",
		kind: "write",
		description:
			"Archive entries: take them off the site. They leave the list's default view and become read-only until unarchived, which makes them drafts again.",
		input: Ids,
		touches: (input) => input.ids.map(ref),
		async run(input, ctx) {
			const archived: string[] = [];
			for (const entry of await loadEntries(ctx.db, input.ids)) {
				if (entry.status === "archived") continue;
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
						paths: [publicPath(ctx.site.schema(), entry.collection, previous.slug) ?? []].flat(),
					});
				archived.push(entry.id);
			}
			return { archived };
		},
		summary: (_input, output) => ({ key: "entries.archive", values: { count: output.archived.length } }),
	}),
	defineOperation({
		name: "entries.unarchive",
		kind: "write",
		description: "Unarchive entries: they become drafts, and reach the site again only when published.",
		input: Ids,
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
		summary: (_input, output) => ({ key: "entries.unarchive", values: { count: output.unarchived.length } }),
	}),
	defineOperation({
		name: "entries.duplicate",
		kind: "write",
		description:
			"Copy an entry's working copy into a new draft of the same collection and language, with an empty slug.",
		input: z.object({ id: z.string() }),
		async run(input, ctx) {
			const entry = await entryOf(ctx, input.id);
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
					folder_id: entry.folderId,
					values: JSON.stringify(entry.values),
					doc: entry.doc === null ? null : JSON.stringify(entry.doc),
				})
				.execute();
			ctx.created(ref(id));
			return { id };
		},
		summary: (input) => ({ key: "entries.duplicate", values: { id: input.id } }),
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
			"A short-lived link that lets the site show an entry's working copy before it is published. Refused when the entry has neither title nor body.",
		input: z.object({ id: z.string() }),
		async run(input, ctx) {
			const entry = await entryOf(ctx, input.id);
			if (!ctx.site.secret) throw new CheckError({ key: "entries.noSecret" });
			if (entry.title === "" && (entry.doc === null || entry.doc === undefined))
				throw new CheckError({ key: "entries.nothingToPreview" });
			const expiresAt = new Date(ctx.now().getTime() + PREVIEW_MINUTES * 60_000);
			const { slug } = await publishSlug(ctx.db, entry);
			return {
				token: await previewToken(ctx.site.secret, entry.id, expiresAt),
				path: publicPath(ctx.site.schema(), entry.collection, slug),
				expiresAt,
			};
		},
	}),
];
