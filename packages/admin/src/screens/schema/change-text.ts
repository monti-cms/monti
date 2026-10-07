import type { SchemaChange, SuggestedTransform } from "@monti-cms/core/schema-change";
import type { TranslatorFor } from "../../translator";
import type { schemaMessages } from "./messages";

type T = TranslatorFor<typeof schemaMessages>;

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

/** What a transform does, as a choice label. */
export function describeTransform(transform: SuggestedTransform, t: T): string {
	switch (transform.op) {
		case "renameField":
			return t("transform.renameField", { to: transform.to });
		case "dropField":
			return t("transform.dropField");
		case "mapOption":
			return t("transform.mapOption", { from: transform.from, to: transform.to });
		case "setDefault":
			return transform.value === ""
				? t("transform.setDefaultText")
				: t("transform.setDefault", { value: transform.value });
	}
}

/** What leaving the data alone means for a change a transform could handle. */
export function describeNoTransform(change: SchemaChange, t: T): string {
	switch (change.kind) {
		case "field_removed":
			return t("transform.noneRemoved");
		case "option_removed":
			return t("transform.noneOption");
		default:
			return t("transform.noneRequired");
	}
}
