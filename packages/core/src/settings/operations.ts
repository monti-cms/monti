import { z } from "zod";
import { CheckError, ForbiddenError } from "../errors";
import { sameJson } from "../json";
import { defineOperation, type OperationContext, type RecordRef } from "../operation";
import { type AdminValues, AdminValuesPatch, mergeAdminValues } from "../schema/admin-values";
import { readSchemaState } from "../schema/apply";
import { type CollectionDefinition, type Schema, storedFields } from "../schema/define";
import {
	AnswersInput,
	adminValuesOf,
	applySchema,
	CollectionsInput,
	checkApply,
	heldByStructure,
	LocalesInput,
	RenameInput,
	writeAdminValues,
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
	/** What changes of each collection's admin values, under the draft's field names: a key given is set, `null` clears it, the rest stay. */
	adminValues: z.record(z.string(), AdminValuesPatch).default({}),
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
 * A patch of a collection's admin values under the field names the applied schema has. Admin values are saved before the structure change (doc 12),
 * so a change that then fails leaves them matching the structure that stayed: what is said of a renamed field goes under its old name. The
 * structure change moves it to the new name (and drops a removed field's) when it goes through.
 */
function underAppliedNames(
	patch: AdminValuesPatch,
	applied: CollectionDefinition,
	draft: CollectionDefinition | undefined,
	renames: Rename[],
): AdminValuesPatch {
	if (!draft) return patch;
	const back = new Map(
		renames
			.filter((rename) => !rename.of && storedFields(applied)[rename.from] && storedFields(draft)[rename.to])
			.map((r) => [r.to, r.from]),
	);
	if (back.size === 0) return patch;
	const sources = new Set(back.values());
	const name = (field: string) => back.get(field) ?? field;
	return {
		...patch,
		...(patch.fields
			? {
					// A new field that takes the name a renamed field leaves waits for the structure change: the renamed field holds that name until then.
					fields: Object.fromEntries(
						Object.entries(patch.fields)
							.filter(([field]) => !sources.has(field))
							.map(([field, values]) => [name(field), values]),
					),
				}
			: {}),
		...(patch.layout
			? {
					layout: patch.layout.map((tab) => ({
						tab: tab.tab,
						fields: tab.fields.map((each) =>
							typeof each === "string" ? name(each) : { group: each.group, fields: each.fields.map(name) },
						),
					})),
				}
			: {}),
		...(patch.list
			? {
					list: {
						...patch.list,
						...(patch.list.order ? { order: patch.list.order.map(name) } : {}),
						...(patch.list.hidden ? { hidden: patch.list.hidden.map(name) } : {}),
						...(patch.list.widths
							? {
									widths: Object.fromEntries(Object.entries(patch.list.widths).map(([id, width]) => [name(id), width])),
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
	for (const [collection, patch] of Object.entries(input.adminValues)) {
		const made = draft.collections[collection];
		if (!made) continue;
		const values = mergeAdminValues({}, patch);
		const saved = applied.collections[collection];
		if (!saved) {
			out[collection] = values;
			continue;
		}
		const fresh = Object.keys(made.fields).filter(
			(field) =>
				!saved.fields[field] &&
				!input.renames.some((rename) => !rename.of && rename.collection === collection && rename.to === field),
		);
		const fields = Object.fromEntries(
			fresh.flatMap((field) => (values.fields?.[field] ? [[field, values.fields[field]]] : [])),
		);
		if (Object.keys(fields).length > 0) out[collection] = { fields };
	}
	return out;
}

/** The site's values after the save, or `null` when what it names is what is saved already. */
async function siteWrite(input: SaveInput, ctx: OperationContext): Promise<Record<string, unknown> | null> {
	if (!input.site) return null;
	const current = await readSettings(ctx.db, "site");
	const next = set({ ...current.values, ...input.site });
	return sameJson(next, set(current.values)) ? null : next;
}

/**
 * The collections whose admin values the save changes before the structure: those the applied schema has, each with its values after the patch.
 * A patch that says what is saved already writes nothing.
 */
async function adminWrites(
	input: SaveInput,
	ctx: OperationContext,
): Promise<{ collection: string; next: AdminValues }[]> {
	const applied = ctx.site.schema();
	const draft = draftOf(input, ctx);
	const saved = await adminValuesOf(ctx.db);
	const writes: { collection: string; next: AdminValues }[] = [];
	for (const [collection, patch] of Object.entries(input.adminValues)) {
		const definition = applied.collections[collection];
		// A collection the draft makes gets its values with the structure change (`firstAdminValues`).
		if (!definition) continue;
		const { version: _version, ...before } = saved[collection] ?? { version: 0 };
		const next = mergeAdminValues(
			before,
			underAppliedNames(patch, definition, draft?.collections[collection], input.renames),
		);
		if (!sameJson(next, before)) writes.push({ collection, next });
	}
	return writes;
}

/** Drops the keys an `undefined` left behind, so the stored JSON says only what is set. */
const set = <T extends Record<string, unknown>>(values: T) =>
	Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined && value !== "")) as T;

/** Where each value of the settings screen lives (doc 12, "where values live"): the database, or the schema file (structure, locked on the live site). */
const PLACES = [
	{ value: "site.name", where: "database" },
	{ value: "site.writingStyle", where: "database" },
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
				site: { name: siteValues.name ?? "", writingStyle: siteValues.writingStyle ?? "", version: site.version },
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
			"Save the settings screen's changes in one go. Admin values go to the database, on the live site too: site (the name and how the site writes) and adminValues (a patch per collection of its label, folders, field labels and descriptions, layout and editor allowance: only the keys given change, null clears one, the rest stay as saved). Structure (locales: the languages, whole; collections: every collection, with renames) goes to monti.schema.ts and the database on the dev server only, the way schema.apply does, and needs the answers schema.plan's choices ask for. A save that names structure on the live site is refused whole, and so is one that would change nothing.",
		input: SaveInput,
		touches(input, ctx) {
			// Everything the save names, whether or not it differs from what is saved right now: the records are held first and what needs
			// writing is decided after, so a value another save changes meanwhile is neither written over nor let past its version.
			const refs: RecordRef[] = [];
			if (Object.keys(input.site ?? {}).length > 0) refs.push({ kind: "settings", id: "site" });
			for (const collection of Object.keys(input.adminValues))
				if (ctx.site.schema().collections[collection]) refs.push({ kind: "collectionAdminValues", id: collection });
			if (draftOf(input, ctx)) refs.push({ kind: "schema", id: "current" });
			return refs;
		},
		// A structure change moves every collection's admin values with its fields: they are held with the schema.
		holds: async (input, ctx) => {
			const draft = draftOf(input, ctx);
			return draft ? heldByStructure(ctx, draft) : [];
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
			const structure = draft !== null && (await differs(ctx, draft, input.renames));
			if (draft && structure) await checkApply(ctx, draft, input.renames, input.answers as Answers);
			// Nothing of it differs from what is saved: there is nothing to write, and no line for the activity log.
			if (!structure && !(await siteWrite(input, ctx)) && (await adminWrites(input, ctx)).length === 0)
				throw new CheckError({ key: "settings.nothingToSave" });
		},
		async run(input, ctx) {
			const applied = ctx.site.schema();
			const draft = draftOf(input, ctx);

			// Admin values first (doc 12): whatever happens to the structure after, they are saved.
			const site = await siteWrite(input, ctx);
			if (site) await writeSettings(ctx.db, "site", site);
			const valuesSaved: string[] = [];
			for (const { collection, next } of await adminWrites(input, ctx)) {
				await writeAdminValues(ctx.db, collection, next);
				valuesSaved.push(collection);
			}
			// What only the admin reads changed (`settings.saved`): no public address moves with it.
			if (site || valuesSaved.length > 0)
				ctx.emit({ type: "settings.saved", ids: [...(site ? ["site"] : []), ...valuesSaved] });

			if (!draft || !(await differs(ctx, draft, input.renames)))
				return { site: site !== null, adminValues: valuesSaved, structure: null };

			// Then the structure, on doc 01's path: the files, then the database.
			const structure = await applySchema(
				ctx,
				draft,
				input.renames,
				input.answers as Answers,
				firstValues(input, applied, draft),
			);
			// The schema file could not be written and nothing else was to be saved: the save wrote nothing, so it is refused like `schema.apply`
			// (no activity row, and the proposal items taken with it stay pending).
			if (!structure.written && !site && valuesSaved.length === 0) throw new CheckError({ key: "schema.notWritten" });
			// The change moved a renamed field's values to its new name; what the person set beside it (a label, the layout) goes on top, under the
			// names now, and a collection the change made gets what is said of it.
			if (structure.applied) {
				const now = await adminValuesOf(ctx.db);
				for (const [collection, patch] of Object.entries(input.adminValues)) {
					if (!draft.collections[collection]) continue;
					const { version: _version, ...before } = now[collection] ?? { version: 0 };
					const next = mergeAdminValues(before, patch);
					if (!sameJson(next, before)) await writeAdminValues(ctx.db, collection, next);
				}
			}
			return {
				site: site !== null,
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
		log: "settings",
		summary: (_input, output) =>
			output.structure?.written && !output.structure.applied
				? { key: "schema.applyFailed", values: { change: output.structure.changeId } }
				: { key: "settings.saved" },
		where: () => ({ key: "activity.where.settings" }),
	}),
	defineOperation({
		name: "admin.setPreference",
		kind: "write",
		// The admin's own screen: nothing draws a proposal of it and nobody could take one, so the assistant has no such tool (doc 12).
		humanOnly: true,
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
		// The admin's own screen, no change to the site: written, and not listed in the log (doc 13).
		log: false,
		summary: () => ({ key: "admin.setPreference" }),
	}),
];
