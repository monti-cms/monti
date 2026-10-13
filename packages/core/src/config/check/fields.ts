import type { CollectionSchema } from "../../schema/collection";
import { type Field, RESERVED_METADATA_KEYS, SUMMARY_ROLE, TITLE_ROLE } from "../../schema/fields";
import { NAME_PATTERN, OPTION_VALUE_PATTERN } from "../rules";
import { type IssueList, pathOf } from "./issue";

/**
 * The rules about one field, by kind. They work on a field as `defineSite` normalizes it, so the same check serves the code config, the schema file and the admin's
 * field form (which asks what a field it is still building is missing).
 */

/** What a field is checked against: the collection it is in and the site's other collections. */
export interface FieldEnv {
	/** Every collection name of the site. */
	readonly collectionNames: readonly string[];
	/** The definitions of those collections, when the check can see them (a backlink needs the other side). */
	readonly collections?: Readonly<Record<string, CollectionSchema>>;
	/** The fields of the collection the field is in (a slug names the text field it is made from). */
	readonly fields: Readonly<Record<string, Field>>;
	/** The collection has a body (a text field can be filled from it). */
	readonly body: boolean;
}

const ROLE_NAME = /^[A-Za-z][A-Za-z0-9-]*$/;
const VIEW_NAME = /^[a-z][a-z0-9-]*$/;

/** Tab names on layout groups are short labels. */
export const TAB_NAME_MAX = 20;

/** Reports a tab name that is empty or too long. */
export function checkTabName(list: IssueList, path: string, tab: string | undefined): void {
	if (tab !== undefined && (!tab.trim() || tab.length > TAB_NAME_MAX)) {
		list.add(path, "tab-name", `must be 1-${TAB_NAME_MAX} characters`);
	}
}

/** The names a select field offers, in order. */
const optionsOf = (field: { readonly options?: unknown }): [string, unknown][] =>
	field.options && typeof field.options === "object" ? Object.entries(field.options) : [];

/** A select (or a conditional field's choice): it offers options with labels, and its default is one of them. */
function checkSelect(list: IssueList, path: string, select: { options?: unknown; defaultValue?: unknown }): void {
	const options = optionsOf(select);
	if (options.length === 0) {
		list.add(pathOf(path, "options"), "options-empty", "needs at least one option");
		return;
	}
	for (const [value, label] of options) {
		if (!OPTION_VALUE_PATTERN.test(value)) {
			list.add(pathOf(path, "options", value), "option-value", `"${value}" may hold letters, digits, "_" and "-" only`);
		}
		if (typeof label !== "string" || !label.trim()) {
			list.add(pathOf(path, "options", value), "option-label", "needs a label");
		}
	}
	if (typeof select.defaultValue !== "string" || !Object.hasOwn(select.options as object, select.defaultValue)) {
		list.add(
			pathOf(path, "defaultValue"),
			"default-not-option",
			`"${String(select.defaultValue)}" is not one of the options (${options.map(([value]) => value).join(", ")})`,
		);
	}
}

/**
 * Checks one field at `path`: the settings its kind needs, and the names it points to (the text field a slug is made from, the collection a relation points to).
 * `name` is the key the field has; it is only used to refuse a reserved name.
 */
export function checkField(list: IssueList, path: string, name: string, field: Field, env: FieldEnv): void {
	if (RESERVED_METADATA_KEYS.includes(name)) {
		list.add(path, "reserved-name", `"${name}" is a reserved name; rename the field`);
	} else if (!NAME_PATTERN.test(name)) {
		list.add(
			path,
			"name",
			`"${name}" is not a field name: letters, digits, "_" and "-", starting with a letter or "_"`,
		);
	}
	switch (field.kind) {
		case "select":
			checkSelect(list, path, field);
			break;
		case "conditional": {
			checkSelect(list, pathOf(path, "discriminant"), field.discriminant);
			const branches = Object.entries(field.values ?? {});
			if (!branches.some(([, group]) => Object.keys(group ?? {}).length > 0)) {
				list.add(pathOf(path, "values"), "branches-empty", "needs fields for at least one option");
			}
			for (const [option] of branches) {
				if (!Object.hasOwn(field.discriminant?.options ?? {}, option)) {
					list.add(
						pathOf(path, "values", option),
						"branch-not-option",
						`"${option}" is not an option of the discriminant (${optionsOf(field.discriminant ?? {})
							.map(([value]) => value)
							.join(", ")})`,
					);
				}
			}
			break;
		}
		case "text":
			if (field.fillFromBody && !env.body) {
				list.add(pathOf(path, "fillFromBody"), "fill-needs-body", "needs a collection with a body");
			}
			break;
		case "slug":
			if (field.from !== undefined && env.fields[field.from]?.kind !== "text") {
				list.add(pathOf(path, "from"), "slug-source", `"${field.from}" is not a text field of this collection`);
			}
			break;
		case "relation":
			if (typeof field.to !== "string" || !env.collectionNames.includes(field.to)) {
				list.add(pathOf(path, "to"), "unknown-collection", `"${String(field.to)}" is not a collection of this site`);
			}
			break;
		case "backlink":
			if (!field.from || !field.via) {
				list.add(path, "backlink-incomplete", "needs `from` (a collection) and `via` (its relation field)");
			} else if (!env.collectionNames.includes(field.from)) {
				list.add(pathOf(path, "from"), "unknown-collection", `"${field.from}" is not a collection of this site`);
			}
			break;
		case "view":
			if (typeof field.view !== "string" || !VIEW_NAME.test(field.view)) {
				list.add(pathOf(path, "view"), "view-name", "must be a kebab-case name");
			}
			break;
		default:
			break;
	}
}

/** The role rules of a field: a role has the shape of a name, and the roles the core reads (`summary`, `title`) sit on text fields. */
export function checkRole(list: IssueList, path: string, field: Field): void {
	const { role } = field as { role?: string };
	if (role === undefined) return;
	if (!ROLE_NAME.test(role))
		list.add(pathOf(path, "role"), "role-name", `"${role}" is not a role name (letters, digits and "-")`);
	if ((role === SUMMARY_ROLE || role === TITLE_ROLE) && field.kind !== "text") {
		list.add(pathOf(path, "role"), "role-kind", `"${role}" needs a text field`);
	}
}
