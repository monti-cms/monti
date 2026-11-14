import { sql } from "kysely";
import { z } from "zod";
import { entryPlace, recordsOf, titleOf } from "../activity/words";
import { asDoc, type Block, type Doc, newBlockId } from "../body/doc";
import { randomUUID } from "../bytes";
import { type EntryState, editableEntry, entryOf, saveWorking, stateOf } from "../entries/operations";
import type { Entry } from "../entries/record";
import { CheckError } from "../errors";
import { defineOperation, type OperationContext, type RecordRef } from "../operation";
import { readSchemaState } from "../schema/apply";
import { checkSchema, localeModeOf, type Schema, storedFields } from "../schema/define";
import { AnswersInput, applyStructure, checkApply, heldByStructure, LocalesInput } from "../schema/operations";
import { type Answers, planSchema } from "../schema/plan";
import { changesSql, pendingSql, sourceJoin } from "./count";
import { type FieldMark, fieldMarksOf, seenAfter, trackedFields, writtenValue } from "./fields";
import { blockHash, marksOf, pairedCopy, type TranslationMark } from "./links";
import {
	addSkips,
	followedDoc,
	followedFields,
	isTranslation,
	publishedOf,
	rememberBlocks,
	sourceEntryOf,
} from "./source";

const ref = (id: string): RecordRef => ({ kind: "entry", id });

/** The translation an operation works on, with its source and the source body it follows. */
async function pairOf(ctx: OperationContext, entry: Entry) {
	const schema = ctx.site.schema();
	if (!isTranslation(schema, entry)) throw new CheckError({ key: "translations.notTranslation" });
	const source = await sourceEntryOf(ctx.db, schema, entry.translationGroup);
	if (!source) throw new CheckError({ key: "translations.noSource" });
	const followed = await followedDoc(ctx.db, source);
	return { source, followed, sourceBlocks: new Map(followed.blocks.map((block) => [block.id, block])) };
}

/** The marks of a translation now: against what the site shows of its source, nothing while the source is not on the site. */
async function marksNow(ctx: OperationContext, entry: Entry, source: Entry): Promise<TranslationMark[]> {
	const published = await ctx.db
		.selectFrom("entry_published")
		.select("doc")
		.where("entry_id", "=", source.id)
		.executeTakeFirst();
	return marksOf(asDoc(entry.doc), entry.translationSkips, published ? asDoc(published.doc) : null);
}

/** The field marks of a translation now: against what the site shows of its source, nothing while the source is not on the site. */
async function fieldMarksNow(ctx: OperationContext, entry: Entry, source: Entry): Promise<FieldMark[]> {
	return fieldMarksOf(entry.translationSeen, await publishedOf(ctx.db, source.id));
}

/** What a translation has seen once these field marks are confirmed: the source as it is now. Its own words stay. */
async function seenConfirmed(ctx: OperationContext, entry: Entry, source: Entry, fields: readonly string[]) {
	const published = await publishedOf(ctx.db, source.id);
	return {
		...entry.translationSeen,
		...Object.fromEntries(published ? fields.map((field) => [field, writtenValue(published, field)]) : []),
	};
}

const BlockDecision = z.discriminatedUnion("do", [
	/** A pending block keeps the source's words (a name, a quote). */
	z.object({ do: z.literal("keepSource"), block: z.string() }),
	/** A changed mark: the translation stays as it is; a removed mark: the block stays, no longer paired. */
	z.object({ do: z.literal("confirm"), block: z.string() }),
	/** A `followSource` block is changed in this language only. */
	z.object({ do: z.literal("detach"), block: z.string() }),
	z.object({ do: z.literal("remove"), block: z.string() }),
	/** An added source block comes in as a pending block, after the block its mark names; with `keep`, kept in the source's words at once. */
	z.object({ do: z.literal("add"), from: z.string(), keep: z.boolean().optional() }),
	/** An added source block is left out of this language for good. */
	z.object({ do: z.literal("skip"), from: z.string() }),
]);
type BlockDecision = z.infer<typeof BlockDecision>;
const Decision = z.union([
	BlockDecision,
	/** A field's mark: the translation's value stays, and it has seen the source as it is now. */
	z.object({ do: z.literal("confirmField"), field: z.string() }),
]);
type Decision = z.infer<typeof Decision>;
const isBlockDecision = (decision: Decision): decision is BlockDecision => decision.do !== "confirmField";
const fieldsIn = (decisions: Decision[]) =>
	decisions.flatMap((decision) => (decision.do === "confirmField" ? [decision.field] : []));

/** A translation's body after the decisions, and the source blocks it now leaves out. */
function decide(
	doc: Doc,
	decisions: BlockDecision[],
	marks: TranslationMark[],
	sourceBlocks: Map<string, Block>,
	ctx: OperationContext,
) {
	const blocks = [...doc.blocks];
	const skipped: string[] = [];
	const at = (id: string) => {
		const index = blocks.findIndex((block) => block.id === id);
		if (index < 0) throw new CheckError({ key: "body.noBlock", values: { block: id } });
		return index;
	};
	const current = (block: Block) => (block.link ? sourceBlocks.get(block.link.from) : undefined);
	for (const decision of decisions) {
		if (decision.do === "add" || decision.do === "skip") {
			const mark = marks.find((each) => each.kind === "added" && each.from === decision.from);
			const source = sourceBlocks.get(decision.from);
			if (!mark || mark.kind !== "added" || !source)
				throw new CheckError({ key: "translations.notAdded", values: { block: decision.from } });
			if (decision.do === "skip") skipped.push(decision.from);
			else {
				const index = mark.after === null ? 0 : at(mark.after) + 1;
				const copy = pairedCopy(source, newBlockId(), ctx.site.kit);
				const kept =
					decision.keep && copy.link ? { ...copy, link: { ...copy.link, state: "keepSource" as const } } : copy;
				blocks.splice(index, 0, kept);
			}
			continue;
		}
		const index = at(decision.block);
		const block = blocks[index] as Block;
		const link = block.link;
		if (decision.do === "remove") {
			blocks.splice(index, 1);
			if (link) skipped.push(link.from);
			continue;
		}
		if (!link) throw new CheckError({ key: "translations.notPaired", values: { block: block.id } });
		const source = current(block);
		if (decision.do === "confirm") {
			// A removed source block: the block stays, on its own.
			if (!source) {
				const { link: _link, ...free } = block;
				blocks[index] = free;
			} else blocks[index] = { ...block, link: { ...link, seen: blockHash(source) } };
			continue;
		}
		if (!source) throw new CheckError({ key: "translations.noSourceBlock", values: { block: block.id } });
		// Keeping the source's words, or changing a followed block here, starts from the source block as it is now.
		const { id: _id, link: _sourceLink, ...words } = source;
		if (decision.do === "keepSource" && link.state !== "pending")
			throw new CheckError({ key: "translations.notPending", values: { block: block.id } });
		if (decision.do === "detach" && link.state !== "followSource")
			throw new CheckError({ key: "translations.notFollowing", values: { block: block.id } });
		blocks[index] = {
			...words,
			id: block.id,
			link: { ...link, seen: blockHash(source), state: decision.do === "keepSource" ? "keepSource" : "translated" },
		};
	}
	return { doc: { ...doc, blocks }, skipped };
}

type LocaleStatus = { locale: string; id: string; state: EntryState; changes: number; pending: number };

export const translationOperations = [
	defineOperation({
		name: "translations.create",
		kind: "write",
		description:
			"Make a translation of a source-language entry in another of the site's languages: a new entry in the same group, each block copied from what the site shows of the source (or its working copy before it is published) as a pending block to decide, a block without words (code) following the source. It starts from the source's address; per-language fields start empty. Then translate the pending blocks with body.edit proposals.",
		input: z.object({ source: z.string(), locale: z.string() }),
		async check(input, ctx) {
			const schema = ctx.site.schema();
			const source = await entryOf(ctx, input.source);
			if (isTranslation(schema, source)) throw new CheckError({ key: "translations.notSource" });
			if (source.trashedAt) throw new CheckError({ key: "entries.trashed" });
			if (input.locale === schema.locales.source || !schema.locales.list.some((each) => each.code === input.locale))
				throw new CheckError({ key: "translations.unknownLocale", values: { locale: input.locale } });
			const there = await ctx.db
				.selectFrom("entries")
				.select("id")
				.where("translation_group", "=", source.translationGroup)
				.where("locale", "=", input.locale)
				.where("trashed_at", "is", null)
				.executeTakeFirst();
			if (there) throw new CheckError({ key: "translations.exists", values: { locale: input.locale } });
		},
		async run(input, ctx) {
			const schema = ctx.site.schema();
			const source = await entryOf(ctx, input.source);
			const followed = await followedDoc(ctx.db, source);
			await rememberBlocks(ctx.db, followed.blocks);
			const doc: Doc = {
				type: "doc",
				blocks: followed.blocks.map((block) => pairedCopy(block, newBlockId(), ctx.site.kit)),
			};
			// Per language: empty; from the source: the source's to start with; the same: never stored on a translation. A media field starts empty too: an empty one
			// follows the source (doc 09), and a copy would stop following it.
			const fields = storedFields(schema.collections[source.collection]);
			// The source as a translation follows it: what it copies and what it has seen are the same thing.
			const following = (await followedFields(ctx.db, source)) ?? source;
			const values = Object.fromEntries(
				Object.entries(following.values).filter(([name]) => {
					const definition = fields[name];
					return (
						definition !== undefined && definition.kind !== "media" && localeModeOf(name, definition) === "fromSource"
					);
				}),
			);
			const seen = seenAfter(trackedFields(schema, source.collection), {}, { title: "", values }, following);
			const id = randomUUID();
			await ctx.db
				.insertInto("entries")
				.values({
					id,
					collection: source.collection,
					translation_group: source.translationGroup,
					locale: input.locale,
					title: "",
					slug: source.slug,
					folder_id: source.folderId,
					values: JSON.stringify(values),
					doc: JSON.stringify(doc),
					translation_seen: JSON.stringify(seen),
				})
				.execute();
			ctx.created(ref(id));
			ctx.emit({ type: "entry.saved", ids: [id], collection: source.collection, locale: input.locale, version: 1 });
			return { id };
		},
		log: "save",
		summary: (input) => ({ key: "translations.create", values: { locale: input.locale } }),
		where: (_input, output, records) => entryPlace(recordsOf(records, "entry", [output.id])),
	}),
	defineOperation({
		name: "translations.status",
		kind: "read",
		description:
			"For the groups of these entries: each language's entry with its state, how many marks the source's changes left on it (changed, added, removed blocks, changed fields) and how many pending blocks it has, and the site's languages it lacks. Find translations that are missing or behind their source with it; the list's language column and filters read the same counts.",
		input: z.object({ ids: z.array(z.string()).min(1) }),
		async run(input, ctx) {
			const { locales } = ctx.site.schema();
			const { rows } = await sql<{
				id: string;
				translation_group: string;
				locale: string;
				state: EntryState;
				changes: number;
				pending: number;
			}>`select x.id, x.translation_group, x.locale,
					case when x.status = 'published' and x.has_unpublished_changes then 'changed' else x.status end as state,
					${changesSql("x", locales.source)} as changes, ${pendingSql("x")} as pending
				from entries x ${sourceJoin("x", locales.source)}
				where x.trashed_at is null and x.translation_group in (select translation_group from entries where id in (${sql.join(input.ids)}))`.execute(
				ctx.db,
			);
			const order = locales.list.map((locale) => locale.code);
			const rank = (code: string) => (order.includes(code) ? order.indexOf(code) : order.length);
			const groups = [...new Set(rows.map((row) => row.translation_group))];
			return {
				groups: groups.map((group) => {
					const own = rows
						.filter((row) => row.translation_group === group)
						.sort((a, b) => rank(a.locale) - rank(b.locale) || a.locale.localeCompare(b.locale));
					return {
						group,
						source: own.find((row) => row.locale === locales.source)?.id ?? null,
						locales: own.map(
							(row): LocaleStatus => ({
								locale: row.locale,
								id: row.id,
								state: row.state,
								changes: Number(row.changes),
								pending: Number(row.pending),
							}),
						),
						missing: order.filter((code) => !own.some((row) => row.locale === code)),
					};
				}),
			};
		},
	}),
	defineOperation({
		name: "translations.compare",
		kind: "read",
		description:
			"Read a translation next to its source block by block: each translation block with the source block it is paired with, the source's fields, each mark the source's changes left (changed: the source block before and after; removed; added: the new source block and the translation block it goes after), and each field whose source value moved on from the one the translation saw (its value before and after).",
		input: z.object({ id: z.string() }),
		async run(input, ctx) {
			const entry = await entryOf(ctx, input.id);
			const { source, followed, sourceBlocks } = await pairOf(ctx, entry);
			const marks = await marksNow(ctx, entry, source);
			const seen = marks.flatMap((mark) => (mark.kind === "added" ? [] : [mark.seen]));
			const before = new Map(
				seen.length
					? (await ctx.db.selectFrom("source_blocks").selectAll().where("hash", "in", seen).execute()).map((row) => [
							row.hash,
							row.block as Block,
						])
					: [],
			);
			const doc = asDoc(entry.doc);
			const published = await ctx.db
				.selectFrom("entry_published")
				.select("published_at")
				.where("entry_id", "=", source.id)
				.executeTakeFirst();
			// One source on every side of the translation (04-5): the title, the fields and the body the pane shows are what the marks are
			// counted against, what the site shows of the source, or its working copy while it is not on the site.
			const fields = await followedFields(ctx.db, source);
			return {
				source: {
					id: source.id,
					locale: source.locale,
					title: fields?.title ?? source.title,
					slug: fields?.slug ?? source.slug,
					// What a translation's `same` and empty `fromSource` fields show: what the site shows (04-5).
					values: fields?.values ?? source.values,
					doc: followed,
					publishedAt: published?.published_at ?? null,
					updatedAt: source.updatedAt,
					/**
					 * The source's own state: `changed` has saved changes the translation does not follow until they are published, `draft` is not on
					 * the site, so nothing is marked yet. The editor says which (TR-24 to TR-26).
					 */
					state: stateOf(source),
				},
				translation: { id: entry.id, locale: entry.locale, version: entry.version, doc },
				pairs: doc.blocks.map((block) => ({ block: block.id, from: block.link?.from ?? null })),
				marks: marks.map((mark) =>
					mark.kind === "added"
						? { ...mark, source: sourceBlocks.get(mark.from) ?? null }
						: { ...mark, before: before.get(mark.seen) ?? null, after: sourceBlocks.get(mark.from) ?? null },
				),
				fields: await fieldMarksNow(ctx, entry, source),
				pending: doc.blocks.filter((block) => block.link?.state === "pending").length,
			};
		},
	}),
	defineOperation({
		name: "translations.setBlocks",
		kind: "write",
		description:
			"Decide blocks of a translation, in order: keepSource (a pending block keeps the source's words), confirm (a changed mark is seen, the text stays; a removed mark leaves the block unpaired), detach (a block that follows the source is changed in this language only), remove, add (an added source block comes in as a pending block) or skip (it is left out for good). confirmField does for a field's mark what confirm does for a block's. Translating a block's words is a body.edit, not this.",
		input: z.object({ id: z.string(), version: z.number().int(), blocks: z.array(Decision).min(1) }),
		touches: (input) => [ref(input.id)],
		async check(input, ctx) {
			const entry = await editableEntry(ctx, input.id, input.version);
			const { source, sourceBlocks } = await pairOf(ctx, entry);
			decide(
				asDoc(entry.doc),
				input.blocks.filter(isBlockDecision),
				await marksNow(ctx, entry, source),
				sourceBlocks,
				ctx,
			);
			const marked = await fieldMarksNow(ctx, entry, source);
			for (const field of fieldsIn(input.blocks))
				if (!marked.some((mark) => mark.field === field))
					throw new CheckError({ key: "translations.notMarked", values: { field } });
		},
		async run(input, ctx) {
			const entry = await entryOf(ctx, input.id);
			const { source, sourceBlocks } = await pairOf(ctx, entry);
			const { doc, skipped } = decide(
				asDoc(entry.doc),
				input.blocks.filter(isBlockDecision),
				await marksNow(ctx, entry, source),
				sourceBlocks,
				ctx,
			);
			const saved = await saveWorking(ctx, entry, {
				...entry,
				doc,
				translationSeen: await seenConfirmed(ctx, entry, source, fieldsIn(input.blocks)),
			});
			await addSkips(ctx.db, entry, skipped);
			return saved;
		},
		log: "save",
		summary: (input, _output, records) => ({
			key: "translations.setBlocks",
			values: { title: titleOf(records, "entry", input.id), count: input.blocks.length },
		}),
		where: (input, _output, records) => entryPlace(recordsOf(records, "entry", [input.id])),
	}),
	defineOperation({
		name: "translations.confirmAll",
		kind: "write",
		description:
			"Confirm every changed and removed mark of a translation at once, fields too: the text stays, changed blocks and fields are seen against the source as it is now, removed blocks become unpaired. Added source blocks are left to decide one by one.",
		input: z.object({ id: z.string(), version: z.number().int() }),
		touches: (input) => [ref(input.id)],
		async check(input, ctx) {
			await pairOf(ctx, await editableEntry(ctx, input.id, input.version));
		},
		async run(input, ctx) {
			const entry = await entryOf(ctx, input.id);
			const { source, sourceBlocks } = await pairOf(ctx, entry);
			const marks = await marksNow(ctx, entry, source);
			const decisions = marks.flatMap((mark) =>
				mark.kind === "added" ? [] : [{ do: "confirm" as const, block: mark.block }],
			);
			const { doc } = decide(asDoc(entry.doc), decisions, marks, sourceBlocks, ctx);
			const fields = (await fieldMarksNow(ctx, entry, source)).map((mark) => mark.field);
			const translationSeen = await seenConfirmed(ctx, entry, source, fields);
			const saved = await saveWorking(ctx, entry, { ...entry, doc, translationSeen });
			return { ...saved, confirmed: decisions.length + fields.length };
		},
		log: "save",
		summary: (input, output, records) => ({
			key: "translations.confirmAll",
			values: { title: titleOf(records, "entry", input.id), count: output.confirmed },
		}),
		where: (input, _output, records) => entryPlace(recordsOf(records, "entry", [input.id])),
	}),
	defineOperation({
		name: "locales.plan",
		kind: "read",
		description:
			"Compare a draft of the site's languages (the list, the source language, how addresses show the language) with the applied one: the languages added and removed and a source change, with what the review must confirm. Removing a language deletes its translations.",
		input: z.object({ locales: LocalesInput }),
		async run(input, ctx) {
			// The file's schema: the plugins' fields are not the file's, and a draft made of them would write them into it (doc 14).
			const current = (await readSchemaState(ctx.db))?.schema ?? ctx.site.fileSchema();
			const draft: Schema = { ...ctx.site.fileSchema(), locales: input.locales };
			return {
				problems: checkSchema(draft).filter((problem) => problem.collection === undefined),
				changes: (await planSchema(ctx.db, current, draft)).filter((change) => change.collection === undefined),
			};
		},
	}),
	defineOperation({
		name: "locales.apply",
		kind: "write",
		structure: true,
		description:
			"Apply a draft of the site's languages on the dev server, the way schema.apply applies collections: monti.schema.ts and a change file, then the database. A removed language needs the answer { do: 'removeLocale', confirm: true } and deletes its translations; a new source language makes it the source of every group, with a draft where a group has no entry in it.",
		input: z.object({ locales: LocalesInput, answers: AnswersInput }),
		touches: () => [{ kind: "schema", id: "current" }],
		holds: (_input, ctx) => heldByStructure(ctx),
		check: (input, ctx) =>
			checkApply(ctx, { ...ctx.site.fileSchema(), locales: input.locales }, [], input.answers as Answers),
		run: (input, ctx) =>
			applyStructure(ctx, { ...ctx.site.fileSchema(), locales: input.locales }, [], input.answers as Answers),
		log: "settings",
		summary: (_input, output) => ({
			key: output.applied ? "schema.applied" : "schema.applyFailed",
			values: { change: output.changeId },
		}),
		where: () => ({ key: "activity.where.schema" }),
	}),
];
