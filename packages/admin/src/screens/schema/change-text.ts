import type { SchemaChange, SuggestedTransform } from "@monti-cms/core/internal/schema-change";
import type { TranslatorFor } from "../../translator";
import type { schemaReviewMessages } from "./review.messages";
import type { ReviewLabels } from "./review-model";

type T = TranslatorFor<typeof schemaReviewMessages>;

const branchText = (branch: { field: string; value: string } | null, none: string) =>
	branch ? `${branch.field}=${branch.value}` : none;

/** A change of the schema as one sentence. */
export function describeChange(change: SchemaChange, t: T): string {
	switch (change.kind) {
		case "collection_added":
		case "collection_removed":
			return t(`change.${change.kind}`, { collection: change.collection });
		case "collection_kind_changed":
			return t("change.collection_kind_changed", { collection: change.collection, from: change.from, to: change.to });
		case "collection_path_changed":
			return t("change.collection_path_changed", {
				collection: change.collection,
				from: change.from ?? t("path.none"),
				to: change.to ?? t("path.none"),
			});
		case "body_changed":
			return t(change.to ? "change.body_added" : "change.body_removed", { collection: change.collection });
		case "allowed_changed":
			return t(change.narrowed ? "change.allowed_narrowed" : "change.allowed_changed", {
				collection: change.collection,
			});
		case "field_added":
			return t("change.field_added", {
				collection: change.collection,
				field: change.field,
				fieldKind: change.fieldKind,
				required: change.required ? t("change.requiredNote") : "",
			});
		case "field_removed":
			return t("change.field_removed", {
				collection: change.collection,
				field: change.field,
				fieldKind: change.fieldKind,
			});
		case "field_renamed":
			return t("change.field_renamed", { collection: change.collection, from: change.from, to: change.to });
		case "field_type_changed":
			return t("change.field_type_changed", {
				collection: change.collection,
				field: change.field,
				from: change.from,
				to: change.to,
			});
		case "field_required_changed":
			return t(change.required ? "change.field_required_on" : "change.field_required_off", {
				collection: change.collection,
				field: change.field,
			});
		case "field_locale_changed":
			return t("change.field_locale_changed", {
				collection: change.collection,
				field: change.field,
				from: change.from,
				to: change.to,
			});
		case "field_moved":
			return t("change.field_moved", {
				collection: change.collection,
				field: change.field,
				from: branchText(change.from, t("change.noCondition")),
				to: branchText(change.to, t("change.noCondition")),
			});
		case "option_added":
		case "option_removed":
			return t(`change.${change.kind}`, { collection: change.collection, field: change.field, option: change.option });
		case "option_renamed":
			return t("change.option_renamed", {
				collection: change.collection,
				field: change.field,
				from: change.from,
				to: change.to,
			});
		case "locale_added":
		case "locale_removed":
			return t(`change.${change.kind}`, { locale: change.locale });
		case "default_locale_changed":
			return t("change.default_locale_changed", { from: change.from, to: change.to });
	}
}

/** What the sentence of a choice needs to know about its change. */
export interface ChoiceContext {
	/** The removed field was renamed by the writer: the values follow it, or the new field starts empty. */
	readonly renamed?: boolean;
	/** How many entries the choice touches, already written with its unit ("148 posts"). */
	readonly count?: string;
	/** `item` for a collection of short records, anything else for documents. */
	readonly kind?: string;
}

/** What a transform does, as the label of its choice. */
export function describeTransform(transform: SuggestedTransform, t: T, context: ChoiceContext = {}): string {
	switch (transform.op) {
		case "renameField":
			return t(context.renamed ? "choice.move" : "choice.moveTo");
		case "dropField":
			return t("choice.erase");
		case "dropCollection":
			return t("drop.entries.then");
		case "trashLocale":
			return t("choice.trash");
		case "mapOption":
			return t("choice.mapTo");
		case "setDefault":
			return t("choice.fill", { count: context.count ?? "", kind: context.kind ?? "document" });
	}
}

/** What leaving the data alone means for a change a transform could handle, as the label of its choice. */
export function describeNoTransform(change: SchemaChange, t: T, context: ChoiceContext = {}): string {
	switch (change.kind) {
		case "field_removed":
			return t(context.renamed ? "choice.blank" : "choice.keep");
		case "option_removed":
		case "locale_removed":
			return t("choice.keep");
		default:
			return t("choice.leave");
	}
}

/** How a change reads in the head of its block: the tag word's key and the color of the tag (new green, edit yellow, removed red). */
export function describeTag(change: SchemaChange): {
	word: "new" | "rename" | "drop" | "required" | "address" | "edit" | "locale";
	kind: "new" | "edit" | "drop";
} {
	switch (change.kind) {
		case "collection_added":
		case "field_added":
		case "option_added":
		case "locale_added":
			return { word: change.kind === "field_added" && change.required ? "required" : "new", kind: "new" };
		case "field_renamed":
		case "option_renamed":
			return { word: "rename", kind: "edit" };
		case "collection_removed":
		case "field_removed":
		case "option_removed":
			return { word: "drop", kind: "drop" };
		case "locale_removed":
			return { word: "locale", kind: "drop" };
		case "field_required_changed":
			return change.required ? { word: "required", kind: "new" } : { word: "edit", kind: "edit" };
		case "collection_path_changed":
			return { word: "address", kind: "edit" };
		default:
			return { word: "edit", kind: "edit" };
	}
}

/** The name and the key in the head of the block of a change: what it is about and how the schema file writes it. */
export function describeHead(change: SchemaChange, labels: ReviewLabels, t: T): { title: string; identifier: string } {
	switch (change.kind) {
		case "collection_added":
		case "collection_removed":
		case "collection_kind_changed":
		case "collection_path_changed":
		case "body_changed":
		case "allowed_changed":
			return { title: labels.collection(change.collection), identifier: change.collection };
		case "field_added":
			return {
				title: labels.field(change.collection, change.field),
				identifier: `${change.field} · ${change.fieldKind}`,
			};
		case "field_removed":
			return {
				title: labels.field(change.collection, change.field),
				identifier: `${change.field} · ${change.fieldKind}`,
			};
		case "field_renamed":
			return {
				title: labels.field(change.collection, change.to),
				identifier: `${change.from} → ${change.to}`,
			};
		case "field_type_changed":
		case "field_required_changed":
		case "field_locale_changed":
		case "field_moved":
			return { title: labels.field(change.collection, change.field), identifier: change.field };
		case "option_added":
		case "option_removed":
			return {
				title: labels.field(change.collection, change.field),
				identifier: `${change.field} · ${change.option}`,
			};
		case "option_renamed":
			return {
				title: labels.field(change.collection, change.field),
				identifier: `${change.field} · ${change.from} → ${change.to}`,
			};
		case "locale_added":
		case "locale_removed":
			return { title: labels.locale(change.locale), identifier: change.locale };
		case "default_locale_changed":
			return { title: t("block.defaultLocale"), identifier: `${change.from} → ${change.to}` };
	}
}
