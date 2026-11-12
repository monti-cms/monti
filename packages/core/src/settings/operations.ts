import { z } from "zod";
import { CheckError, ForbiddenError } from "../errors";
import { defineOperation, type OperationContext, type RecordRef } from "../operation";
import { AdminValues } from "../schema/admin-values";
import { readSchemaState } from "../schema/apply";
import type { CollectionDefinition, Schema } from "../schema/define";
import {
	AnswersInput,
	adminValuesOf,
	adminValuesRecord,
	applySchema,
	CollectionsInput,
	checkApply,
	LocalesInput,
	RenameInput,
} from "../schema/operations";
import { type Answers, type Rename, schemaHash } from "../schema/plan";
import { AdminPreferences, readSettings, SiteValues, writeSettings } from "./values";

const SaveInput = z.object({
	/** The site's admin values that changed: its name, how it writes. */
	site: SiteValues.optional(),
	/** Structure: the site's languages, whole. Only on the dev server. */
	locales: LocalesInput.optional(),
	/** Structure: every collection of the draft. Only on the dev server. */
	collections: CollectionsInput.optional(),
	renames: z.array(RenameInput).default([]),
	answers: AnswersInput,
	/** Each changed collection's admin values, whole, under the draft's field names. */
	adminValues: z.record(z.string(), AdminValues).default({}),
});
type SaveInput = z.infer<typeof SaveInput>;

/** The schema a save asks for: what it names over what the site runs with. `null` when it names no structure. */
function draftOf(input: SaveInput, ctx: OperationContext): Schema | null {
	if (input.locales === undefined && input.collections === undefined) return null;
	const current = ctx.site.schema();
	return { locales: input.locales ?? current.locales, collections: input.collections ?? current.collections };
}

/** Whether the draft differs from the file or from what the database follows: only then is there a structure change to write. */
async function differs(ctx: OperationContext, draft: Schema, renames: Rename[]) {
	const hash = schemaHash(draft);
	const state = await readSchemaState(ctx.db);
	return renames.length > 0 || hash !== schemaHash(ctx.site.schema()) || (state !== null && hash !== state.hash);
}

/**
 * A collection's admin values under the field names the applied schema has. They are saved before the structure change (doc 12), so a change that
 * then fails leaves them matching the structure that stayed: a renamed field's values go back under its old name, and a field on its way out keeps
 * what it had. The structure change moves and drops them itself when it goes through.
 */
function underAppliedNames(
	values: AdminValues,
	saved: AdminValues | undefined,
	applied: CollectionDefinition,
	draft: CollectionDefinition | undefined,
	renames: Rename[],
): AdminValues {
	if (!draft) return values;
	const back = new Map(
		renames.filter((rename) => applied.fields[rename.from] && draft.fields[rename.to]).map((r) => [r.to, r.from]),
	);
	const sources = new Set(back.values());
	const name = (field: string) => back.get(field) ?? field;
	const fields: NonNullable<AdminValues["fields"]> = {};
	// A new field that takes the name a renamed field leaves waits for the structure change; the renamed field's values hold that name until then.
	for (const [field, value] of Object.entries(values.fields ?? {}))
		if (!sources.has(field)) fields[name(field)] = value;
	for (const field of Object.keys(applied.fields)) {
		const leaving = !draft.fields[field] && !sources.has(field);
		if (leaving && saved?.fields?.[field]) fields[field] = saved.fields[field];
	}
	return {
		...values,
		...(Object.keys(fields).length > 0 ? { fields } : { fields: undefined }),
		...(values.layout
			? {
					layout: values.layout.map((tab) => ({
						tab: tab.tab,
						fields: tab.fields.map((each) =>
							typeof each === "string" ? name(each) : { group: each.group, fields: each.fields.map(name) },
						),
					})),
				}
			: {}),
		...(values.list
			? {
					list: {
						...values.list,
						...(values.list.order ? { order: values.list.order.map(name) } : {}),
						...(values.list.hidden ? { hidden: values.list.hidden.map(name) } : {}),
						...(values.list.widths
							? {
									widths: Object.fromEntries(
										Object.entries(values.list.widths).map(([id, width]) => [name(id), width]),
									),
								}
							: {}),
					},
				}
			: {}),
	};
}

/** The admin values a structure change carries for what it makes (doc 01): a new collection's in full, a new field's of an existing one. */
function firstValues(input: SaveInput, applied: Schema, draft: Schema): Record<string, AdminValues> {
	const out: Record<string, AdminValues> = {};
	for (const [collection, values] of Object.entries(input.adminValues)) {
		const made = draft.collections[collection];
		if (!made) continue;
		const saved = applied.collections[collection];
		if (!saved) {
			out[collection] = values;
			continue;
		}
		const fresh = Object.keys(made.fields).filter(
			(field) =>
				!saved.fields[field] &&
				!input.renames.some((rename) => rename.collection === collection && rename.to === field),
		);
		const fields = Object.fromEntries(
			fresh.flatMap((field) => (values.fields?.[field] ? [[field, values.fields[field]]] : [])),
		);
		if (Object.keys(fields).length > 0) out[collection] = { fields };
	}
	return out;
}

/** Drops the keys an `undefined` left behind, so the stored JSON says only what is set. */
const set = <T extends Record<string, unknown>>(values: T) =>
	Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined && value !== "")) as T;

/** Where each value of the settings screen lives (doc 12, "where values live"): the database, or the schema file (structure, locked on the live site). */
const PLACES = [
	{ value: "site.name", where: "database" },
	{ value: "site.writing", where: "database" },
	{ value: "locales.prefix", where: "file" },
	{ value: "locales.list", where: "file" },
	{ value: "locales.source", where: "file" },
	{ value: "collections", where: "file" },
	{ value: "adminValues", where: "database" },
	{ value: "admin.language", where: "database" },
	{ value: "admin.templates", where: "database" },
] as const;

export const settingsOperations = [
	defineOperation({
		name: "settings.read",
		kind: "read",
		description:
			"Read the settings: the site's name and how it writes (the tone and rules to follow), the admin's preferences, the languages, every collection with its admin values, where each value lives (the database, or the schema file) and whether it is locked (structure values on the live site), with the versions a save names.",
		input: z.object({}),
		async run(_input, ctx) {
			const schema = ctx.site.schema();
			const state = await readSchemaState(ctx.db);
			const hash = schemaHash(schema);
			const locked = ctx.site.files === null;
			const [site, admin] = await Promise.all([readSettings(ctx.db, "site"), readSettings(ctx.db, "admin")]);
			const siteValues = SiteValues.parse(site.values);
			const preferences = AdminPreferences.parse(admin.values);
			return {
				site: { name: siteValues.name ?? "", writing: siteValues.writing ?? "", version: site.version },
				admin: {
					language: preferences.language ?? null,
					templates: preferences.templates ?? true,
					version: admin.version,
				},
				schema,
				hash,
				version: state?.version ?? 0,
				adminValues: await adminValuesOf(ctx.db),
				locked,
				places: PLACES.map((place) => ({ ...place, locked: place.where === "file" && locked })),
				/** The file differs from what the database follows: a hand edit on the dev server, or `monti db:migrate` not run on the live site. */
				fileChanged: state !== null && state.hash !== hash,
				failedChange: state?.failedChange ?? null,
			};
		},
	}),
	defineOperation({
		name: "settings.save",
		kind: "write",
		description:
			"Save the settings screen's changes in one go. Admin values (site: the name and how the site writes; adminValues: collections' labels, help, layout) go to the database, on the live site too. Structure (locales: the languages, whole; collections: every collection, with renames) goes to monti.schema.ts and the database on the dev server only, the way schema.apply does, and needs the answers schema.plan's choices ask for. A save that names structure on the live site is refused whole.",
		input: SaveInput,
		touches(input, ctx) {
			const refs: RecordRef[] = [];
			if (input.site) refs.push({ kind: "settings", id: "site" });
			for (const collection of Object.keys(input.adminValues))
				if (ctx.site.schema().collections[collection]) refs.push({ kind: "collectionAdminValues", id: collection });
			if (draftOf(input, ctx)) refs.push({ kind: "schema", id: "current" });
			return refs;
		},
		async check(input, ctx) {
			const draft = draftOf(input, ctx);
			// Named, not compared: on the live site no entry point takes a structure value, changed or not (doc 12).
			if (draft && ctx.site.files === null)
				throw new ForbiddenError({ key: "errors.structureLocked", values: { operation: "settings.save" } });
			const collections = draft?.collections ?? ctx.site.schema().collections;
			for (const collection of Object.keys(input.adminValues))
				if (!collections[collection] && !ctx.site.schema().collections[collection])
					throw new CheckError({ key: "collections.unknown", values: { collection } });
			if (draft && (await differs(ctx, draft, input.renames)))
				await checkApply(ctx, draft, input.renames, input.answers as Answers);
		},
		async run(input, ctx) {
			const applied = ctx.site.schema();
			const draft = draftOf(input, ctx);

			// Admin values first (doc 12): whatever happens to the structure after, they are saved.
			if (input.site) {
				const current = await readSettings(ctx.db, "site");
				await writeSettings(ctx.db, "site", set({ ...current.values, ...input.site }));
			}
			const saved = await adminValuesOf(ctx.db);
			const valuesSaved: string[] = [];
			for (const [collection, values] of Object.entries(input.adminValues)) {
				const definition = applied.collections[collection];
				// A collection the draft makes gets its values with the structure change (`firstAdminValues`).
				if (!definition) continue;
				const existed = saved[collection] !== undefined;
				const { version: _version, ...before } = saved[collection] ?? { version: 0 };
				await adminValuesRecord.restore(
					ctx.db,
					collection,
					underAppliedNames(values, before, definition, draft?.collections[collection], input.renames),
				);
				if (!existed) ctx.created({ kind: "collectionAdminValues", id: collection });
				valuesSaved.push(collection);
			}

			if (!draft || !(await differs(ctx, draft, input.renames)))
				return { site: input.site !== undefined, adminValues: valuesSaved, structure: null };

			// Then the structure, on doc 01's path: the files, then the database.
			const structure = await applySchema(
				ctx,
				draft,
				input.renames,
				input.answers as Answers,
				firstValues(input, applied, draft),
			);
			if (structure.written) ctx.changedStructure();
			// The change moved a renamed field's values to its new name; what the person set beside it (a label, the layout) goes on top, under the names now.
			if (structure.applied)
				for (const [collection, values] of Object.entries(input.adminValues))
					if (draft.collections[collection]) await adminValuesRecord.restore(ctx.db, collection, values);
			return {
				site: input.site !== undefined,
				adminValues: valuesSaved,
				structure: {
					changeId: structure.changeId,
					/** `false`: the schema file could not be written, so no structure value changed and the admin values are saved. */
					written: structure.written,
					/** `false` with `written`: the files are saved and the database step failed; `schema.retry` applies them. */
					applied: structure.applied,
					changes: structure.changes,
				},
			};
		},
		summary: (_input, output) =>
			output.structure?.written && !output.structure.applied
				? { key: "schema.applyFailed", values: { change: output.structure.changeId } }
				: { key: "settings.saved" },
	}),
	defineOperation({
		name: "admin.setPreference",
		kind: "write",
		description:
			"Set the admin's own preferences, saved at once: the language of the admin screen (ko or en) and whether body templates are offered.",
		input: AdminPreferences.refine((input) => Object.keys(set(input)).length > 0, { message: "Name a preference." }),
		touches: () => [{ kind: "settings", id: "admin" }],
		async run(input, ctx) {
			const current = await readSettings(ctx.db, "admin");
			const next = set({ ...current.values, ...input });
			await writeSettings(ctx.db, "admin", next);
			return AdminPreferences.parse(next);
		},
		summary: () => ({ key: "admin.setPreference" }),
	}),
];
