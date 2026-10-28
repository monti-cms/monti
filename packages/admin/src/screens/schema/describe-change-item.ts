import type { TranslatorFor } from "../../translator";
import type { ChangeItem, ChangeSubject } from "./change-list";
import type { schemaChangesMessages } from "./changes.messages";

type T = TranslatorFor<typeof schemaChangesMessages>;

const COLLECTION_KEYS = ["label", "kind", "path", "folders", "icon", "defaultTab"] as const;
const SETTINGS = [
	"site.name",
	"site.homeLink",
	"site.url",
	"site.aliases",
	"site.previewPath",
	"site.previewLocaleParam",
	"site.localePrefix",
	"admin.locale",
	"admin.templates",
	"admin.translations",
] as const;

const includes = <const L extends readonly string[]>(list: L, value: string): value is L[number] =>
	list.includes(value);

function subjectName(subject: ChangeSubject, t: T): string {
	switch (subject.kind) {
		case "collection":
			return subject.label;
		case "field":
			return subject.label;
		case "locale":
			return subject.label;
		case "collectionSetting":
			return includes(COLLECTION_KEYS, subject.key)
				? t(`subject.collection.${subject.key}`)
				: t("subject.collection.other");
		case "setting":
			return includes(SETTINGS, subject.path) ? t(`subject.${subject.path}`) : t("subject.other");
		case "body":
		case "layout":
		case "fieldOrder":
		case "collectionOrder":
		case "defaultLocale":
		case "localeOrder":
		case "timeZone":
			return t(`subject.${subject.kind}`);
	}
}

/** How one item of the changes list reads: its name (a collection's setting is named with the collection), how it changed, and the color of that. */
export function describeChangeItem(
	item: ChangeItem,
	collectionLabel: (name: string) => string,
	t: T,
): { name: string; tag: string; tone: "warning" | "danger" | "success" } {
	const whole = item.subject.kind === "collection";
	const name = subjectName(item.subject, t);
	const inCollection = item.collection && item.subject.kind !== "collection" && item.subject.kind !== "field";
	const tag = whole ? t(item.tag === "added" ? "tag.collectionAdded" : "tag.collectionRemoved") : t(`tag.${item.tag}`);
	return {
		name: inCollection ? `${collectionLabel(item.collection as string)} · ${name}` : name,
		tag,
		tone: item.tag === "removed" ? "danger" : item.tag === "added" ? "success" : "warning",
	};
}
