import {
	applyOps,
	type Block,
	type BodyOp,
	type Doc,
	type Message,
	type ProposalItemView,
	type ProposalView,
	sameJson,
	storedFields,
} from "@monti-cms/core";
import { Del, Ins } from "@monti-cms/ui";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useLanguageName } from "../format/language";
import { endsClosed, fieldName as nameOfField } from "../format/names";
import { useAdmin } from "../operations/admin-context";
import { useRead } from "../operations/use-operation";
import { type BlockWords, blockWords } from "../screens/entry/compare-entries";
import { useBlockNames } from "../screens/entry/use-block-names";
import type { SchemaRead } from "../screens/settings/schema-draft";
import type { DiffRun } from "./diff";

export type EntryNow = {
	collection: string;
	locale: string;
	title: string;
	slug: string;
	values: Record<string, unknown>;
	doc: Doc | null;
	/** The library's files its body shows (`entries.get`'s `media`), to name a picture by its file. */
	media?: { id: string; name: string }[];
};

/**
 * One place a change touches, as it is now and as proposed. A place in the body also has its block on each side (`body`, `null` where it has none: a
 * block put in, a block taken out): the review page reads it as the editor draws it (`ReadBody`), and says the words alone where one line is all
 * there is room for.
 */
export type Place = {
	name: string;
	before: string;
	after: string;
	body?: { before: Block | null; after: Block | null };
};

const said = (value: unknown): string =>
	value === null || value === undefined
		? ""
		: typeof value === "string"
			? value
			: Array.isArray(value)
				? value.map(said).join(", ")
				: typeof value === "object"
					? JSON.stringify(value)
					: String(value);

/** An id a former item of the same proposal makes (`{ $item }`): the item that makes it, or `null` for a plain id. */
export const madeBy = (id: unknown): string | null =>
	typeof id === "object" && id !== null && typeof (id as { $item?: unknown }).$item === "string"
		? (id as { $item: string }).$item
		: null;

/**
 * The items that write into what another item of the proposal makes (a translation's words): they are read in that item's row, on the review
 * page and on the card. Only the words of the translation (its title and its body): anything else written into it (a field, an address, a
 * block edit) is a row of its own, so nothing is applied unseen.
 */
export function followersOf(items: readonly ProposalItemView[]) {
	const making = new Set(items.filter((each) => each.operation === "translations.create").map((each) => each.id));
	const parentOf = (item: ProposalItemView) => {
		const parent = madeBy((item.input as { id?: unknown } | null)?.id);
		const wordsOnly =
			item.operation === "entries.save" &&
			Object.keys((item.input ?? {}) as object).every((key) => ["id", "version", "title", "doc"].includes(key));
		return wordsOnly && parent !== null && making.has(parent) ? parent : null;
	};
	return {
		follows: (item: ProposalItemView) => parentOf(item) !== null,
		followers: (parent: string) => items.filter((each) => parentOf(each) === parent),
	};
}

/**
 * A proposal's counts by its rows, as the card and the review page show them: the words written into a translation it makes are that
 * translation's, not changes of their own. A row whose words went wrong counts as failed.
 */
export function rowCounts(view: ProposalView): ProposalView["counts"] {
	const { follows, followers } = followersOf(view.items);
	const rows = view.items.filter((item) => !follows(item));
	const failed = (item: ProposalItemView) =>
		[item, ...followers(item.id)].some((each) => each.state === "failed" || each.state === "skipped");
	const count = (test: (item: ProposalItemView) => boolean) => rows.filter(test).length;
	return {
		toApply: count((item) => item.state === "pending" && item.included && !item.stale),
		applied: count((item) => item.state === "applied" && !failed(item)),
		failed: count(failed),
		stale: count((item) => [item, ...followers(item.id)].some((each) => each.stale)),
		reverted: count((item) => item.state === "reverted"),
	};
}

/**
 * A translation a proposal makes, read beside its source (flow 3·13): the source as it is now, its blocks, and the words its followers propose
 * for the title and for each block (`null`: nothing proposed for it, it starts in the source's words).
 */
export function translationOf(
	item: ProposalItemView,
	followers: readonly ProposalItemView[],
	entries: Record<string, EntryNow>,
) {
	const input = item.input as { source: string; locale: string };
	const source = entries[input.source];
	const proposedDoc = followers.map((each) => (each.input as { doc?: Doc }).doc).find((doc) => doc !== undefined);
	const proposedTitle = followers
		.map((each) => (each.input as { title?: string }).title)
		.find((title) => title !== undefined);
	const blocks = source?.doc?.blocks ?? [];
	// What is proposed for a source block: the block proposed for it (by its link, or by its place), or `null` when nothing is.
	const translated = (block: Block, index: number): Block | null =>
		proposedDoc?.blocks.find((each) => each.link?.from === block.id) ?? proposedDoc?.blocks[index] ?? null;
	return { input, source, blocks, proposedTitle, translated };
}

/** A change's words with what goes out and what comes in marked, on one line or as one side of two. */
export function marked(runs: DiffRun[], side: "both" | "before" | "after"): ReactNode {
	return runs
		.filter(
			(run) => side === "both" || run.kind === "same" || (side === "before" ? run.kind === "del" : run.kind === "ins"),
		)
		.map((run, index) => {
			// A run's place among the runs names it: they are made anew from the two texts each time.
			const key = `${index}:${run.kind}`;
			return run.kind === "del" ? (
				<Del key={key}>{run.text}</Del>
			) : run.kind === "ins" ? (
				<Ins key={key}>{run.text}</Ins>
			) : (
				run.text
			);
		});
}

/**
 * The words of a proposal's changes, as the review page and the card in the conversation show them (AS-46): each change's places as they are
 * now and as proposed, named as the editor names them. `items` are the changes to read: the entries they are of are read as they are now.
 */
export function useChangeWords(items: readonly ProposalItemView[] | undefined) {
	const { t, transport, onWrite } = useAdmin();
	const languageName = useLanguageName();
	// Every write in the admin reads the entries again, as `useRead` does: a save in the editor moves what a change would take out.
	const [writes, setWrites] = useState(0);
	useEffect(() => onWrite(() => setWrites((count) => count + 1)), [onWrite]);
	const [entries, setEntries] = useState<Record<string, EntryNow>>({});
	const names = useBlockNames(Object.values(entries).flatMap((entry) => entry.media ?? []));
	// What the site calls its fields, their options and its languages: a change is named as the editor names it.
	const schema = useRead<SchemaRead>("schema.read").data;

	// The entries its changes are of, as they are now: what a change takes out is read from them.
	const entryIds = useMemo(
		() => [
			...new Set(
				(items ?? []).flatMap((item) => [
					...item.targets
						.filter((target) => target.startsWith("entry:"))
						.map((target) => target.slice("entry:".length)),
					// A translation to make: its source, read beside what is proposed for it.
					...(item.operation === "translations.create"
						? [String((item.input as { source?: unknown }).source ?? "")].filter(Boolean)
						: []),
				]),
			),
		],
		[items],
	);
	const wanted = entryIds.join(" ");
	// biome-ignore lint/correctness/useExhaustiveDependencies: it follows which entries the proposal names, and every write
	useEffect(() => {
		let gone = false;
		void (async () => {
			for (const entryId of entryIds) {
				const answer = await transport("entries.get", { id: entryId });
				if (gone) return;
				if (answer.status !== 200) continue;
				const { entry, media } = answer.body as { entry: EntryNow; media?: { id: string; name: string }[] };
				setEntries((known) => ({ ...known, [entryId]: { ...entry, media: media ?? [] } }));
			}
		})();
		return () => {
			gone = true;
		};
	}, [wanted, transport, writes]);

	const fieldsOf = (collection: string | undefined) =>
		collection ? (schema?.adminValues[collection]?.fields ?? {}) : {};
	const fieldName = (collection: string | undefined, field: string) =>
		nameOfField(field, fieldsOf(collection)[field]?.label, t);
	/** A field's value in words: a choice by its option's label. */
	const valueWords = (collection: string | undefined, field: string, value: unknown) => {
		const labels = fieldsOf(collection)[field]?.optionLabels ?? {};
		return Array.isArray(value)
			? value.map((each) => (typeof each === "string" ? (labels[each] ?? each) : said(each))).join(", ")
			: typeof value === "string"
				? (labels[value] ?? value)
				: said(value);
	};
	/** Why a change cannot be put in, in the screen's words: the field it writes belongs to an option the entry has not chosen. */
	const blockedWords = (reason: Message, collection: string | undefined) => {
		if (reason.key !== "entries.optionNotChosen") return t(reason);
		const field = String(reason.values?.field ?? "");
		const option = String(reason.values?.option ?? "");
		const definition = collection ? storedFields(schema?.schema.collections[collection])[field] : undefined;
		const name = fieldName(collection, field);
		// A choice made by a switch has one option: the switch is off.
		if (definition?.kind === "select" && definition.control === "toggle")
			return t(endsClosed(name) ? "review.switchOffFinal" : "review.switchOffOpen", { field: name });
		const chosen = valueWords(collection, field, option);
		return t("review.notChosen", {
			field: t(endsClosed(name) ? "list.subjectFinal" : "list.subjectOpen", { name }),
			option: t(endsClosed(chosen) ? "list.subjectFinal" : "list.subjectOpen", { name: chosen }),
		});
	};

	const { followers } = followersOf(items ?? []);

	/** The blocks of a body that change from one text to the next, each as it is and as proposed. */
	const bodyPlaces = (was: Doc | null, next: Doc): Place[] => {
		const places: Place[] = [];
		const said = (words: BlockWords) => words.text || (words.values ?? "");
		// A block with values is named by its kind ("Block 4 · Callout", doc 18).
		const named = (words: BlockWords, index: number) =>
			[t("review.block", { number: index + 1 }), words.values?.split(" · ")[0]].filter((part) => part).join(" · ");
		next.blocks.forEach((block, index) => {
			const now = blockWords(block, names);
			const old = was?.blocks.find((each) => each.id === block.id);
			if (!old)
				places.push({ name: t("review.newBlock"), before: "", after: said(now), body: { before: null, after: block } });
			else if (!sameJson(old, block))
				places.push({
					name: named(now, index),
					before: said(blockWords(old, names)),
					after: said(now),
					body: { before: old, after: block },
				});
		});
		(was?.blocks ?? []).forEach((block, index) => {
			if (!next.blocks.some((each) => each.id === block.id))
				places.push({
					name: named(blockWords(block, names), index),
					before: said(blockWords(block, names)),
					after: "",
					body: { before: block, after: null },
				});
		});
		return places;
	};

	/** The places of an entry one change touches, each as it is and as proposed. A change the page has no words for has none: its row names it. */
	const placesOf = (item: ProposalItemView): Place[] => {
		const entryId = item.targets.find((target) => target.startsWith("entry:"))?.slice("entry:".length);
		const now = entryId ? entries[entryId] : undefined;
		// Once applied, the entry already reads as proposed: there is no "before" left to show against it.
		const applied = item.state !== "pending" && item.state !== "stale";
		if (item.operation === "entries.save") {
			const input = item.input as { title?: string; slug?: string; values?: Record<string, unknown> };
			const places: Place[] = [];
			if (input.title !== undefined)
				places.push({ name: t("review.title.field"), before: applied ? "" : (now?.title ?? ""), after: input.title });
			if (input.slug !== undefined)
				places.push({ name: t("review.slug.field"), before: applied ? "" : (now?.slug ?? ""), after: input.slug });
			for (const [field, value] of Object.entries(input.values ?? {}))
				places.push({
					name: fieldName(now?.collection, field),
					before: applied ? "" : valueWords(now?.collection, field, now?.values[field]),
					after: valueWords(now?.collection, field, value),
				});
			// Its body, block by block, as a body edit's. A translation's words have no entry to read yet: they are its translation's row.
			const doc = (item.input as { doc?: Doc }).doc;
			if (doc !== undefined && now && !applied) places.push(...bodyPlaces(now.doc, doc));
			// A changed choice takes the values of the option it leaves with it (doc 19): each is shown going out.
			if (!applied)
				for (const cleared of item.preview?.clears ?? [])
					places.push({
						name: fieldName(now?.collection, cleared.field),
						before: valueWords(now?.collection, cleared.field, cleared.value),
						after: "",
					});
			return places;
		}
		if (item.operation === "body.edit" && now && !applied) {
			const ops = (item.input as { ops: BodyOp[] }).ops;
			let next: Doc;
			try {
				next = applyOps(now.doc ?? { type: "doc", blocks: [] }, ops);
			} catch {
				// The body moved on so far that the edit no longer fits: the row says it changed in the meantime.
				return [];
			}
			return bodyPlaces(now.doc, next);
		}
		// A translation to make: nothing of it stands yet, so each place is the words proposed for it alone; its row is named by its source.
		if (item.operation === "translations.create") {
			const made = translationOf(item, followers(item.id), entries);
			const places: Place[] = [];
			if (made.proposedTitle !== undefined)
				places.push({ name: t("review.title.field"), before: "", after: made.proposedTitle });
			made.blocks.forEach((block, index) => {
				const proposed = made.translated(block, index);
				const words = proposed ? blockWords(proposed).text : "";
				if (proposed && words !== "" && words !== blockWords(block).text)
					places.push({
						name: t("review.block", { number: index + 1 }),
						before: "",
						after: words,
						body: { before: null, after: proposed },
					});
			});
			return places;
		}
		return [];
	};

	return { entries, placesOf, fieldName, valueWords, languageName, blockedWords };
}
