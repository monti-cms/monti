import { z } from "zod";
import { sameJson } from "../json";

/** A field's admin values: what only the admin screen and the assistant use, so they change on the live site too. */
export const FieldAdminValues = z.object({
	label: z.string().optional(),
	/** For the assistant: how to fill the field. The screen does not show it. */
	description: z.string().optional(),
	optionLabels: z.record(z.string(), z.string()).optional(),
});

/**
 * How a collection's list looks (doc 06): the column order, the hidden columns, the widths the admin dragged and the page size. Filters and sorting live
 * in the address only.
 */
export const ListPrefs = z.object({
	order: z.array(z.string()).optional(),
	hidden: z.array(z.string()).optional(),
	/** Column id → width in px, for the columns the admin resized; the others keep their kind's width. The screen keeps it between 60 and 480. */
	widths: z.record(z.string(), z.number().int().positive().max(480)).optional(),
	pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]).optional(),
});

type LayoutField = string | { group: string; fields: string[] };

/** A collection's admin values (doc 01, "where values live"). */
export const AdminValues = z.object({
	label: z.string().optional(),
	folders: z.boolean().optional(),
	fields: z.record(z.string(), FieldAdminValues).optional(),
	/** The property panel: tabs of fields and groups. Without it, one tab in the schema's order. */
	layout: z
		.array(
			z.object({
				tab: z.string(),
				fields: z.array(z.union([z.string(), z.object({ group: z.string(), fields: z.array(z.string()) })])),
			}),
		)
		.optional() as z.ZodOptional<z.ZodType<{ tab: string; fields: LayoutField[] }[]>>,
	/** What the editor lets the admin put in. The site draws every block either way. */
	editor: z
		.object({
			blocks: z.union([z.literal("all"), z.array(z.string())]),
			marks: z.union([z.literal("all"), z.array(z.string())]),
			headings: z.array(z.number().int().min(1).max(6)),
		})
		.partial()
		.optional(),
	list: ListPrefs.optional(),
});
export type AdminValues = z.infer<typeof AdminValues>;

/** A field's admin values to change: a key given is set, `null` clears it, a key left out stays. */
const FieldAdminValuesPatch = z.object({
	label: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
	optionLabels: z.record(z.string(), z.string()).nullable().optional(),
});

/**
 * A change of a collection's admin values (docs 01 and 12): only what is named changes. A key given is set, `null` clears it, a key left out stays as
 * saved. `fields` goes by field (a field given is merged key by key, `null` drops all a field has); `editor` and `list` are merged key by key; `layout`
 * is one value. So "rename the label" is `{ label }` and nothing else of the collection moves.
 */
export const AdminValuesPatch = z.object({
	label: AdminValues.shape.label.unwrap().nullable().optional(),
	folders: AdminValues.shape.folders.unwrap().nullable().optional(),
	fields: z.record(z.string(), FieldAdminValuesPatch.nullable()).nullable().optional(),
	layout: AdminValues.shape.layout.unwrap().nullable().optional(),
	editor: z
		.object({
			blocks: z.union([z.literal("all"), z.array(z.string())]).nullable(),
			marks: z.union([z.literal("all"), z.array(z.string())]).nullable(),
			headings: z.array(z.number().int().min(1).max(6)).nullable(),
		})
		.partial()
		.nullable()
		.optional(),
	list: z
		.object({
			order: z.array(z.string()).nullable(),
			hidden: z.array(z.string()).nullable(),
			widths: z.record(z.string(), z.number().int().positive().max(480)).nullable(),
			pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]).nullable(),
		})
		.partial()
		.nullable()
		.optional(),
});
export type AdminValuesPatch = z.infer<typeof AdminValuesPatch>;

/** One level of a patch over what is saved: given keys are set, `null` ones go, the rest stay. `undefined` when nothing is left. */
function mergeKeys<T extends object>(saved: T | undefined, patch: { [K in keyof T]?: T[K] | null }): T | undefined {
	const out: Record<string, unknown> = { ...saved };
	for (const [key, value] of Object.entries(patch)) {
		if (value === undefined) continue;
		if (value === null) delete out[key];
		else out[key] = value;
	}
	return Object.keys(out).length > 0 ? (out as T) : undefined;
}

/** The admin values after a patch (see `AdminValuesPatch`). */
export function mergeAdminValues(saved: AdminValues, patch: AdminValuesPatch): AdminValues {
	const { fields, editor, list, ...flat } = patch;
	const out: AdminValues = mergeKeys(saved, flat) ?? {};
	if (fields !== undefined) {
		const merged: NonNullable<AdminValues["fields"]> = { ...(fields === null ? {} : saved.fields) };
		for (const [field, values] of Object.entries(fields ?? {})) {
			const next = values === null ? undefined : mergeKeys(merged[field], values);
			if (next) merged[field] = next;
			else delete merged[field];
		}
		if (Object.keys(merged).length > 0) out.fields = merged;
		else delete out.fields;
	}
	if (editor !== undefined) {
		const next = editor === null ? undefined : mergeKeys(saved.editor, editor);
		if (next) out.editor = next;
		else delete out.editor;
	}
	if (list !== undefined) {
		const next = list === null ? undefined : mergeKeys(saved.list, list);
		if (next) out.list = next;
		else delete out.list;
	}
	return out;
}

/** One level of a patch that turns `saved` into `next`: the keys that differ, `null` for the ones that are gone. `undefined` when none differ. */
function diffKeys(saved: object | undefined, next: object | undefined): Record<string, unknown> | undefined {
	const before = (saved ?? {}) as Record<string, unknown>;
	const after = (next ?? {}) as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const key of new Set([...Object.keys(before), ...Object.keys(after)]))
		if (!sameJson(before[key], after[key])) out[key] = after[key] === undefined ? null : after[key];
	return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * The patch that turns `saved` admin values into `next` (the inverse of `mergeAdminValues`): what a screen that holds the whole values sends, so its
 * save names only what the person changed and nothing another save wrote in the meantime is undone by it.
 */
export function diffAdminValues(saved: AdminValues, next: AdminValues): AdminValuesPatch {
	const { fields: savedFields, editor: savedEditor, list: savedList, ...savedFlat } = saved;
	const { fields: nextFields, editor: nextEditor, list: nextList, ...nextFlat } = next;
	const patch: Record<string, unknown> = { ...diffKeys(savedFlat, nextFlat) };
	const fields: Record<string, unknown> = {};
	for (const field of new Set([...Object.keys(savedFields ?? {}), ...Object.keys(nextFields ?? {})])) {
		const changed = nextFields?.[field]
			? diffKeys(savedFields?.[field], nextFields[field])
			: savedFields?.[field]
				? null
				: undefined;
		if (changed !== undefined) fields[field] = changed;
	}
	if (Object.keys(fields).length > 0) patch.fields = fields;
	const editor = nextEditor ? diffKeys(savedEditor, nextEditor) : savedEditor ? null : undefined;
	if (editor !== undefined) patch.editor = editor;
	const list = nextList ? diffKeys(savedList, nextList) : savedList ? null : undefined;
	if (list !== undefined) patch.list = list;
	return patch as AdminValuesPatch;
}
