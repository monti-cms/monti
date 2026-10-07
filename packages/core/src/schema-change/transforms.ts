import type { SchemaMigration } from "../schema-file/types";
import type { Site } from "../site";
import type { SchemaChange } from "./types";

/**
 * The data transforms of a schema change (`SchemaMigration`, listed in `migrations` of the schema file). Each is a pure function of one entry's stored
 * metadata; the store runs them over every stored body in one transaction (`applySchemaChange`).
 *
 * - `renameField`: the value moves to the new name. Nothing is overwritten: an entry that already has a value under the new name keeps both and is reported.
 * - `mapOption`: a stored select value that is no longer an option becomes another option (also inside a list of values, without duplicates).
 * - `dropField`: the only transform that deletes data, and only the values of a field the schema no longer has.
 * - `setDefault`: an entry with no value gets one (the field must be text or select). A translation only gets it for a per-language field.
 *
 * Moving a field into or out of a conditional branch needs no transform: a stored value is kept wherever its field is, so nothing moves in the data.
 */

/** A problem that stops a transform from running. */
export interface TransformProblem {
	readonly id: string;
	readonly message: string;
}

/** The part of a site the transforms read. */
type TransformSite = Pick<Site, "isCollection" | "storedField">;

const isEmpty = (value: unknown): boolean =>
	value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

/**
 * Checks transforms against the schema they run under (`site`: the schema after the change). A transform that would be wrong is a problem, so it never runs:
 * a field that is not there to rename to, a `dropField` of a field the schema still has (it would delete live data), a `mapOption` to something that is not an
 * option, a default that is not valid for its field.
 */
export function checkTransforms(site: TransformSite, transforms: readonly SchemaMigration[]): TransformProblem[] {
	const problems: TransformProblem[] = [];
	const problem = (id: string, message: string) => problems.push({ id, message });
	for (const [index, item] of transforms.entries()) {
		const at = `${item.collection}`;
		if (!site.isCollection(item.collection)) {
			problem(item.id, `collection "${item.collection}" is not in the schema`);
			continue;
		}
		const stored = (name: string) => site.storedField(item.collection, name);
		switch (item.op) {
			case "renameField": {
				if (item.from === item.to) problem(item.id, `${at}: "${item.from}" renamed to itself`);
				else if (stored(item.from)) {
					problem(
						item.id,
						`${at}.${item.from} is still a field of the schema; remove it there (or use another transform)`,
					);
				}
				// A rename may point at a name a later rename moves on (a chain).
				const chained = transforms
					.slice(index + 1)
					.some(
						(later) => later.op === "renameField" && later.collection === item.collection && later.from === item.to,
					);
				if (!stored(item.to) && !chained) problem(item.id, `${at}.${item.to} is not a field of the schema`);
				break;
			}
			case "mapOption": {
				const field = stored(item.field)?.field;
				if (field?.kind !== "select") problem(item.id, `${at}.${item.field} is not a select field of the schema`);
				else {
					if (!Object.hasOwn(field.options, item.to))
						problem(item.id, `${at}.${item.field} has no option "${item.to}"`);
					if (Object.hasOwn(field.options, item.from)) {
						problem(item.id, `${at}.${item.field} still has the option "${item.from}"; remove it there first`);
					}
				}
				break;
			}
			case "dropField": {
				if (stored(item.field)) {
					problem(
						item.id,
						`${at}.${item.field} is still a field of the schema; remove it there first (a drop deletes stored values)`,
					);
				}
				break;
			}
			case "setDefault": {
				const field = stored(item.field)?.field;
				if (field?.kind !== "text" && field?.kind !== "select") {
					problem(item.id, `${at}.${item.field} is not a text or select field of the schema`);
				} else if (item.value === "") problem(item.id, `${at}.${item.field} would get an empty default`);
				else if (field.kind === "select" && !Object.hasOwn(field.options, item.value)) {
					problem(item.id, `${at}.${item.field} has no option "${item.value}"`);
				} else if (field.kind === "text" && field.max !== undefined && [...item.value].length > field.max) {
					problem(item.id, `${at}.${item.field} allows ${field.max} characters at most`);
				}
				break;
			}
		}
	}
	return problems;
}

/** What running the transforms on one body gave. */
export interface TransformResult {
	readonly metadata: Record<string, unknown>;
	/** Ids of the transforms that changed the metadata. */
	readonly changedBy: readonly string[];
	/** Entries where a rename found a value under the new name already: both were kept. */
	readonly conflicts: readonly { readonly id: string; readonly from: string; readonly to: string }[];
}

/** Which collections a list of transforms touches. */
export const transformCollections = (transforms: readonly SchemaMigration[]): string[] => [
	...new Set(transforms.map((item) => item.collection)),
];

/**
 * Runs the transforms (in order) on the metadata of one stored body of `collection`. The input is not changed. `isTranslation`: the body belongs to a
 * translation, which holds only per-language values.
 */
export function applyTransforms(
	site: TransformSite,
	transforms: readonly SchemaMigration[],
	body: { readonly collection: string; readonly isTranslation?: boolean },
	metadata: { readonly [key: string]: unknown },
): TransformResult {
	let current: Record<string, unknown> = { ...metadata };
	const changedBy: string[] = [];
	const conflicts: { id: string; from: string; to: string }[] = [];
	const changed = (id: string, next: Record<string, unknown>) => {
		current = next;
		changedBy.push(id);
	};

	for (const item of transforms) {
		if (item.collection !== body.collection) continue;
		switch (item.op) {
			case "renameField": {
				if (!Object.hasOwn(current, item.from)) break;
				if (Object.hasOwn(current, item.to) && !isEmpty(current[item.to])) {
					conflicts.push({ id: item.id, from: item.from, to: item.to });
					break;
				}
				const { [item.from]: value, ...rest } = current;
				changed(item.id, { ...rest, [item.to]: value });
				break;
			}
			case "mapOption": {
				const value = current[item.field];
				if (typeof value === "string" && value === item.from) changed(item.id, { ...current, [item.field]: item.to });
				else if (Array.isArray(value) && value.includes(item.from)) {
					const mapped = value.map((entry) => (entry === item.from ? item.to : entry));
					changed(item.id, { ...current, [item.field]: mapped.filter((entry, at) => mapped.indexOf(entry) === at) });
				}
				break;
			}
			case "dropField": {
				if (!Object.hasOwn(current, item.field)) break;
				const { [item.field]: _dropped, ...rest } = current;
				changed(item.id, rest);
				break;
			}
			case "setDefault": {
				if (!isEmpty(current[item.field])) break;
				const stored = site.storedField(item.collection, item.field);
				if (!stored) break;
				// A translation holds per-language values only; a shared value lives on the source.
				if (body.isTranslation && !("localized" in stored.field && stored.field.localized)) break;
				// A field in a conditional branch only gets a value where the branch shows.
				if (stored.when && current[stored.when.field] !== stored.when.value) break;
				changed(item.id, { ...current, [item.field]: item.value });
				break;
			}
		}
	}
	return { metadata: current, changedBy, conflicts };
}

/** A transform that fits a change, without its id (the caller names it). */
export type SuggestedTransform = DistributiveOmit<SchemaMigration, "id" | "note">;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * The transforms that fit a change, for a screen to offer. A removed field offers a drop (and a rename to each field that looks like it was renamed, see
 * `SchemaDiff.renameHints`, when `renameTo` lists candidates); a removed option offers a mapping to each option that is left; a field that became required
 * offers a default. Nothing is offered for a change data does not follow from.
 */
export function suggestTransforms(
	change: SchemaChange,
	context: { readonly options?: readonly string[]; readonly renameTo?: readonly string[] } = {},
): SuggestedTransform[] {
	switch (change.kind) {
		case "field_removed":
			return [
				...(context.renameTo ?? []).map(
					(to): SuggestedTransform => ({ op: "renameField", collection: change.collection, from: change.field, to }),
				),
				{ op: "dropField", collection: change.collection, field: change.field },
			];
		case "option_removed":
			return (context.options ?? [])
				.filter((to) => to !== change.option)
				.map(
					(to): SuggestedTransform => ({
						op: "mapOption",
						collection: change.collection,
						field: change.field,
						from: change.option,
						to,
					}),
				);
		case "field_required_changed":
		case "field_added": {
			if (!change.required) return [];
			// A select offers each option; a text field offers a template with an empty value the screen fills in.
			const values = context.options && context.options.length > 0 ? context.options : [""];
			return values.map(
				(value): SuggestedTransform => ({
					op: "setDefault",
					collection: change.collection,
					field: change.field,
					value,
				}),
			);
		}
		default:
			return [];
	}
}
