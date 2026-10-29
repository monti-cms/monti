import type { ChangeImpact, CollectionDropImpact, SchemaChange } from "@monti-cms/core/internal/schema-change";
import type { SchemaDecision } from "@monti-cms/core/internal/schema-edit";
import type { EditRequest, SchemaEditPreview, SuggestedTransform } from "../../api/schema";
import type { ChangeItem } from "./change-list";
import {
	collectionsOf,
	fieldsOf,
	isObj,
	localesOf,
	type Obj,
	type Rename,
	type SettingChange,
	titleFieldName,
} from "./schema-model";

/** The pick made for each change that can be handled in more than one way, by the key of its decision. `null`: no transform, the data stays as stored. */
export type Picks = Record<string, SuggestedTransform | null>;

/** A collection the draft removed, as the review names it. */
export interface Removal {
	readonly name: string;
	readonly label: string;
	readonly kind: "document" | "item";
}

/**
 * The request of the screen's edit with the picks made so far. `undefined` picks leave the choice to the server's defaults. A pick that moves a language's
 * translations to the trash goes in `trashLocales`, like the collections to delete go in `dropCollections`; the rest are transforms.
 */
export const requestOf = (
	draft: unknown,
	renames: readonly Rename[],
	picks: Picks | undefined,
	dropCollections: readonly string[],
): EditRequest => {
	const chosen = picks ? Object.values(picks).filter((pick): pick is SuggestedTransform => pick !== null) : undefined;
	const trashLocales = (chosen ?? []).flatMap((pick) => (pick.op === "trashLocale" ? [pick.locale] : []));
	return {
		schema: draft,
		transforms: chosen?.filter((pick) => pick.op !== "trashLocale"),
		renames,
		...(dropCollections.length > 0 ? { dropCollections } : {}),
		...(trashLocales.length > 0 ? { trashLocales } : {}),
	};
};

/**
 * Whether applying with these picks deletes stored values: a field's values dropped while entries hold them, or a collection with its entries. Dropping a
 * field no entry has a value in deletes nothing, so it does not turn the apply red.
 */
export const deletesValues = (
	picks: Picks | undefined,
	decisions: readonly Pick<SchemaDecision, "key" | "entries">[],
	deletedCollections: number,
): boolean =>
	deletedCollections > 0 ||
	Object.entries(picks ?? {}).some(
		([key, pick]) => pick?.op === "dropField" && (decisions.find((decision) => decision.key === key)?.entries ?? 0) > 0,
	);

/** One change of the review: what is shown as a block of the sheet, and the data it needs. */
export type ReviewBlock =
	/** A collection that is new. */
	| { readonly type: "added"; readonly key: string; readonly collection: string }
	/** A field the writer renamed: the values move with it, or the new field starts empty. */
	| {
			readonly type: "rename";
			readonly key: string;
			readonly decision: SchemaDecision;
			readonly collection: string;
			readonly from: string;
			readonly to: string;
	  }
	/** A field that is gone: keep the values, move them to another field, or delete them. */
	| {
			readonly type: "removed";
			readonly key: string;
			readonly decision: SchemaDecision;
			readonly collection: string;
			readonly field: string;
			/** The fields the values could move to. */
			readonly targets: readonly string[];
	  }
	/** A field that must be filled and has no value in some entries. */
	| {
			readonly type: "required";
			readonly key: string;
			readonly decision: SchemaDecision;
			readonly collection: string;
			readonly field: string;
	  }
	/** A select option that is gone from the field. */
	| {
			readonly type: "option";
			readonly key: string;
			readonly decision: SchemaDecision;
			readonly collection: string;
			readonly field: string;
			readonly option: string;
	  }
	/** A language that is gone from the file. */
	| { readonly type: "locale"; readonly key: string; readonly decision: SchemaDecision; readonly code: string }
	/** The public address of a collection. */
	| { readonly type: "path"; readonly key: string; readonly impact: ChangeImpact }
	/** A collection deleted with its entries. */
	| {
			readonly type: "drop";
			readonly key: string;
			readonly impact: ChangeImpact & { drop: CollectionDropImpact };
			readonly removal: Removal;
	  }
	/** Any other change the stored data cares about. */
	| { readonly type: "change"; readonly key: string; readonly impact: ChangeImpact }
	/** A site or admin setting. */
	| { readonly type: "setting"; readonly key: string; readonly setting: SettingChange };

/** The kinds of field whose stored value another field of the same kind can take over. */
const MOVABLE = new Set(["text", "select", "relation", "media"]);

/** The fields of the draft's collection that can take over the values of a removed field of `fieldKind`, besides the ones the server suggests. Never the title, which names every entry. */
function moveTargets(
	draft: Obj,
	decision: SchemaDecision,
	collection: string,
	field: string,
	fieldKind: string,
): string[] {
	const suggested = decision.suggestions.flatMap((item) => (item.op === "renameField" ? [item.to] : []));
	const current = collectionsOf(draft)[collection] ?? {};
	const title = titleFieldName(current);
	const same = Object.entries(fieldsOf(current)).flatMap(([name, other]) =>
		name !== field && name !== title && other.kind === fieldKind && MOVABLE.has(fieldKind) ? [name] : [],
	);
	return [...new Set([...suggested, ...same])];
}

const isRequired = (change: SchemaChange): boolean =>
	(change.kind === "field_added" && change.required) || (change.kind === "field_required_changed" && change.required);

/** Whether the block of `decision` already says what `change` says, so the change is not listed again. */
function owns(block: ReviewBlock, change: SchemaChange): boolean {
	switch (block.type) {
		case "rename":
			return (
				(change.kind === "field_removed" && change.collection === block.collection && change.field === block.from) ||
				(change.kind === "field_renamed" && change.collection === block.collection && change.from === block.from) ||
				(change.kind === "field_added" && change.collection === block.collection && change.field === block.to)
			);
		case "removed":
			return (
				(change.kind === "field_removed" && change.collection === block.collection && change.field === block.field) ||
				(change.kind === "field_renamed" && change.collection === block.collection && change.from === block.field)
			);
		case "required":
			return (
				(change.kind === "field_added" || change.kind === "field_required_changed") &&
				change.collection === block.collection &&
				change.field === block.field
			);
		case "option":
			return (
				(change.kind === "option_removed" || change.kind === "option_renamed") &&
				change.collection === block.collection &&
				change.field === block.field &&
				(change.kind === "option_removed" ? change.option : change.from) === block.option
			);
		case "locale":
			return change.kind === "locale_removed" && change.locale === block.code;
		default:
			return false;
	}
}

function decisionBlock(
	decision: SchemaDecision,
	input: { draft: Obj; renames: readonly Rename[] },
): ReviewBlock | null {
	const { change, key } = decision;
	switch (change.kind) {
		case "locale_removed":
			return { type: "locale", key, decision, code: change.locale };
		case "field_removed": {
			const renamed = input.renames.find(
				(item) => item.kind === "field" && item.collection === change.collection && item.from === change.field,
			);
			const to = renamed?.to;
			if (to !== undefined && decision.suggestions.some((item) => item.op === "renameField" && item.to === to)) {
				return { type: "rename", key, decision, collection: change.collection, from: change.field, to };
			}
			return {
				type: "removed",
				key,
				decision,
				collection: change.collection,
				field: change.field,
				targets: moveTargets(input.draft, decision, change.collection, change.field, change.fieldKind),
			};
		}
		case "option_removed":
			return {
				type: "option",
				key,
				decision,
				collection: change.collection,
				field: change.field,
				option: change.option,
			};
		case "field_added":
		case "field_required_changed":
			return isRequired(change)
				? { type: "required", key, decision, collection: change.collection, field: change.field }
				: null;
		default:
			return null;
	}
}

/**
 * The blocks of the review, in the order they are shown: the changes that ask for a choice first, then the other changes the stored data cares about
 * (addresses first), the collections deleted with their entries, and the settings of the site and the admin. A change that a block already says (the added
 * field of a rename, the removed and the renamed field of one choice) is not a block of its own. The decisions about a deleted collection are the writer's own
 * press of Delete and are not asked again.
 */
export function reviewBlocks(input: {
	preview: SchemaEditPreview;
	draft: Obj;
	renames: readonly Rename[];
	removals: readonly Removal[];
	settings: readonly SettingChange[];
}): ReviewBlock[] {
	const { preview, removals } = input;
	const asked = preview.decisions.flatMap((decision) => {
		const block = decisionBlock(decision, input);
		return block ? [block] : [];
	});
	const removalOf = (impact: ChangeImpact): Removal | undefined =>
		impact.drop && impact.change.kind === "collection_removed"
			? removals.find((item) => item.name === (impact.change as { collection: string }).collection)
			: undefined;
	const rest: ReviewBlock[] = [];
	const drops: ReviewBlock[] = [];
	for (const impact of preview.impacts) {
		const removal = removalOf(impact);
		if (removal && impact.drop) {
			drops.push({
				type: "drop",
				key: impact.key,
				impact: impact as ChangeImpact & { drop: CollectionDropImpact },
				removal,
			});
		} else if (!asked.some((block) => owns(block, impact.change))) {
			const type =
				impact.change.kind === "collection_added"
					? "added"
					: impact.change.kind === "collection_path_changed"
						? "path"
						: "change";
			if (type === "added")
				rest.push({ type, key: impact.key, collection: (impact.change as { collection: string }).collection });
			else rest.push({ type, key: impact.key, impact });
		}
	}
	const byRank = (block: ReviewBlock) => (block.type === "path" ? 0 : block.type === "added" ? 1 : 2);
	return [
		...asked,
		...rest.sort((a, b) => byRank(a) - byRank(b)),
		...drops,
		...input.settings.map((setting): ReviewBlock => ({ type: "setting", key: `setting:${setting.path}`, setting })),
	];
}

/** The picks the dialog starts from: the server's pick for each decision. */
export const initialPicks = (decisions: readonly SchemaDecision[]): Picks =>
	Object.fromEntries(decisions.map((decision) => [decision.key, decision.chosen]));

/** What the draft calls things the review names: the labels of collections and fields (a removed one from the saved file), and the kind of each collection. */
export interface ReviewLabels {
	collection(name: string): string;
	field(collection: string, name: string): string;
	/** `item` for a collection of short records, `document` for the rest. */
	kind(collection: string): "document" | "item";
	locale(code: string): string;
}

const labelOf = (value: unknown, fallback: string): string =>
	typeof value === "string" && value !== "" ? value : fallback;

/** The labels of the review from the draft and the saved file; whatever the draft no longer has is looked up in the saved file. */
export function reviewLabels(draft: Obj, saved: Obj): ReviewLabels {
	const collectionOf = (name: string): Obj | undefined => collectionsOf(draft)[name] ?? collectionsOf(saved)[name];
	return {
		collection: (name) => labelOf(collectionOf(name)?.label, name),
		field: (collection, name) => {
			const found =
				fieldsOf(collectionsOf(draft)[collection] ?? {})[name] ??
				fieldsOf(collectionsOf(saved)[collection] ?? {})[name];
			return labelOf(isObj(found) ? found.label : undefined, name);
		},
		kind: (collection) => (collectionOf(collection)?.kind === "item" ? "item" : "document"),
		locale: (code) => {
			const found =
				localesOf(draft).find((item) => item.code === code) ?? localesOf(saved).find((item) => item.code === code);
			return found?.name ?? code;
		},
	};
}

/** What the title of the sheet says it is about: the one collection, the area, or just the number when the changes spread over several. */
export type ReviewTarget =
	| { readonly kind: "removed"; readonly names: readonly string[] }
	| { readonly kind: "collection"; readonly name: string; readonly count: number }
	| { readonly kind: "area"; readonly area: ChangeItem["area"]; readonly count: number }
	| { readonly kind: "all"; readonly count: number };

/** Where the changes of the list are: only collections deleted, one collection, one area of the Settings page, or several. */
export function reviewTarget(items: readonly ChangeItem[]): ReviewTarget {
	const deleted = items.filter((item) => item.subject.kind === "collection" && item.tag === "removed");
	if (items.length > 0 && deleted.length === items.length) {
		return { kind: "removed", names: deleted.map((item) => item.collection ?? "") };
	}
	const areas = [...new Set(items.map((item) => item.area))];
	if (areas.length === 1 && areas[0] === "collections") {
		const names = [...new Set(items.map((item) => item.collection))];
		const [only] = names;
		if (names.length === 1 && only) return { kind: "collection", name: only, count: items.length };
	}
	if (areas.length === 1 && areas[0]) return { kind: "area", area: areas[0], count: items.length };
	return { kind: "all", count: items.length };
}
