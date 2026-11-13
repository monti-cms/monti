import { type RawBuilder, sql } from "kysely";
import { z } from "zod";
import { CheckError } from "../errors";
import { mediaValueOf } from "../media/value";
import { defineOperation, type OperationContext } from "../operation";
import type { PluginTab } from "../plugins/define";
import { DateRange, dateRangeSql, likePattern } from "../query";
import { type AdminValues, ListPrefs } from "../schema/admin-values";
import {
	type CollectionDefinition,
	choseIn,
	chosenValues,
	type FieldDefinition,
	type LocalesDefinition,
	placesOf,
	type StoredField,
	storedFields,
	translates,
} from "../schema/define";
import { adminValuesRecord, writeAdminValues } from "../schema/operations";
import { translationSql } from "../translations/count";
import type { EntryState } from "./operations";

/** What a list column is, which decides its menu: how it sorts and what it filters by (doc 06, columns). */
export type ColumnKind = "status" | "title" | "locale" | "date" | "relation" | "media" | "select" | "text";

const STATES = ["published", "changed", "draft", "archived"] as const satisfies readonly EntryState[];
const DATE_COLUMNS = ["updatedAt", "publishedAt", "createdAt"] as const;
const SORTS = ["title", "slug", ...DATE_COLUMNS] as const;
export const PAGE_SIZES = [25, 50, 100] as const;

const Filter = z.discriminatedUnion("on", [
	z.object({ on: z.literal("status"), any: z.array(z.enum(STATES)).min(1) }),
	z.object({ on: z.literal("relation"), field: z.string(), any: z.array(z.string().nullable()).min(1) }),
	z.object({ on: z.literal("select"), field: z.string(), any: z.array(z.string().nullable()).min(1) }),
	z.object({ on: z.literal("locale"), any: z.array(z.string()).min(1) }),
	z.object({
		on: z.literal("date"),
		field: z.enum(DATE_COLUMNS),
		range: DateRange,
	}),
	z.object({ on: z.literal("empty"), field: z.string() }),
	/** Entries by their translation group: what a body link (`monti:entry/<group>`) and a relation point at. */
	z.object({ on: z.literal("group"), any: z.array(z.string()).min(1) }),
	/**
	 * Groups by their translations in `locales` (every language but the source when left out): one missing, one whose source changed since it was
	 * translated, or all there and up to date (doc 04). Several leave the groups of any of them, as every filter's values do.
	 */
	z.object({
		on: z.literal("translation"),
		any: z.array(z.enum(["missing", "sourceChanged", "upToDate"])).min(1),
		locales: z.array(z.string()).min(1).optional(),
	}),
]);
export type Filter = z.infer<typeof Filter>;

/**
 * The list query (doc 06): the screen's address, the agent's `entries.query` and the column menus' counts all hold this one shape, so what a person
 * filters and what the agent filters are the same rows.
 */
export const ListQuery = z.object({
	collection: z.string(),
	/** `null` is the top level; left out, every folder. */
	folder: z.string().nullable().optional(),
	/** Inside a folder: that folder (`here`), or the whole collection (`all`). */
	scope: z.enum(["here", "all"]).default("here"),
	/** Everywhere (`all`), or only the title, the address or the body's text. */
	search: z.object({ text: z.string(), in: z.enum(["all", "title", "slug", "body"]).default("all") }).optional(),
	/** All must match; one filter's values match any. */
	filters: z.array(Filter).default([]),
	sort: z.object({ by: z.enum(SORTS), dir: z.enum(["asc", "desc"]) }).default({ by: "updatedAt", dir: "desc" }),
	page: z.number().int().min(1).default(1),
	/** The screen offers 25, 50 and 100; the agent may read up to 500 at once. */
	pageSize: z.number().int().min(1).max(500).default(25),
	/** The admin's time zone, for "today" and date ranges. */
	timeZone: z.string().default("UTC"),
});
export type ListQuery = z.infer<typeof ListQuery>;
type FilterOn = Filter["on"];

export type ListColumn = {
	id: string;
	kind: ColumnKind;
	/** The field it shows (a schema field, or a date column). */
	field?: string;
	/** The field's label from the admin values; system columns are named by the screen. */
	label?: string;
	sortable: boolean;
	/** What its menu filters by; `null` for none. */
	filter: FilterOn | null;
	hidden: boolean;
	/** The width in px the admin dragged it to; without it the column has its kind's width (the title always takes the room left). */
	width?: number;
	/** A relation's target collection, and whether it holds many values. */
	to?: string;
	many?: boolean;
	/** A relation that must hold a value: picking one for it offers no "none". */
	required?: boolean;
	/** A select field's options, with their labels. */
	options?: { value: string; label: string }[];
};

export type ListRow = {
	id: string;
	translationGroup: string;
	title: string;
	slug: string;
	state: EntryState;
	locale: string;
	/** Every language the row's group has, its own first. */
	locales: string[];
	folderId: string | null;
	version: number;
	createdAt: Date;
	updatedAt: Date;
	publishedAt: Date | null;
	values: Record<string, unknown>;
	/** Relation fields' values: the target groups, named by their representative's title. */
	relations: Record<string, { id: string; title: string }[]>;
	/** Media fields' values, by field: the file's name and the picture to show for it (none for a file that is no image, or is not in the library). */
	media: Record<string, { name: string; thumbnail: string | null }>;
};

export type Facet = { value: string | null; label?: string; count: number };

const collectionOf = (ctx: OperationContext, collection: string): CollectionDefinition => {
	const definition = ctx.site.schema().collections[collection];
	if (!definition) throw new CheckError({ key: "collections.unknown", values: { collection } });
	return definition;
};

const fieldOf = (definition: CollectionDefinition, field: string, kinds: FieldDefinition["kind"][]) => {
	const found = storedFields(definition)[field];
	if (!found || !kinds.includes(found.kind) || field === "title" || field === "slug")
		throw new CheckError({ key: "list.badFilter", values: { field } });
	return found;
};

/** Each translation group's representative: its source-language entry, or its first while it has none (doc 06, principle 4; doc 04). */
const representatives = (collection: string, source: string) => sql`(
	select distinct on (e.translation_group) e.* from entries e
	where e.collection = ${collection} and e.trashed_at is null
	order by e.translation_group, e.locale = ${source} desc, e.created_at, e.id
)`;

const stateSql = sql`case when rep.status = 'published' and rep.has_unpublished_changes then 'changed' else rep.status end`;
/**
 * A field's value as the list reads it: of a conditional field's option, only where that option is chosen (doc 19). A value a stored copy still
 * holds for another option is no value: it is not filtered on, counted or shown.
 */
const valueSql = (definition: CollectionDefinition, field: string) =>
	chosenValueSql(storedFields(definition)[field], field);
/** The same of a stored field: the value where every choice above the field is made (a conditional field in an option of another). */
const chosenValueSql = (stored: StoredField | undefined, field: string) =>
	stored?.under
		? sql`(case when ${sql.join(
				placesOf(stored.under).map((place) => sql`rep.values ->> ${place.field} = ${place.option}`),
				sql` and `,
			)} then rep.values -> ${field} end)`
		: sql`(rep.values -> ${field})`;
const emptySql = (definition: CollectionDefinition, field: string) =>
	sql`(${valueSql(definition, field)} is null or ${valueSql(definition, field)} in ('null'::jsonb, '""'::jsonb, '[]'::jsonb))`;
const list = (values: readonly unknown[]) => sql.join(values.map((value) => sql`${value}`));
const dateColumn = (field: (typeof DATE_COLUMNS)[number]) =>
	field === "publishedAt"
		? sql.ref("p.published_at")
		: sql.ref(field === "createdAt" ? "rep.created_at" : "rep.updated_at");

/** The languages a translation filter asks about: the translations among the ones given, or every language but the source. */
function targetsOf(locales: LocalesDefinition, given?: string[]): string[] {
	const picked = given?.filter((code) => code !== locales.source) ?? [];
	return picked.length > 0
		? picked
		: locales.list.map((locale) => locale.code).filter((code) => code !== locales.source);
}

function filterSql(
	filter: Filter,
	query: ListQuery,
	definition: CollectionDefinition,
	now: Date,
	locales: LocalesDefinition,
): RawBuilder<unknown> {
	switch (filter.on) {
		case "status":
			return sql`${stateSql} in (${list(filter.any)})`;
		case "group":
			return sql`rep.translation_group in (${list(filter.any)})`;
		case "translation":
			return sql`(${sql.join(
				filter.any.map((is) => translationSql(is, targetsOf(locales, filter.locales), locales.source)),
				sql` or `,
			)})`;
		case "locale":
			return sql`exists (select 1 from entries x where x.translation_group = rep.translation_group and x.trashed_at is null
				and x.locale in (${list(filter.any)}))`;
		case "relation": {
			fieldOf(definition, filter.field, ["relation"]);
			const targets = filter.any.filter((value): value is string => value !== null);
			const parts = [];
			if (targets.length)
				parts.push(sql`exists (select 1 from entry_links l where l.from_group = rep.translation_group and l.field = ${filter.field}
					and l.to_group in (${list(targets)}))`);
			if (filter.any.includes(null))
				parts.push(
					sql`not exists (select 1 from entry_links l where l.from_group = rep.translation_group and l.field = ${filter.field})`,
				);
			return sql`(${sql.join(parts, sql` or `)})`;
		}
		case "select": {
			fieldOf(definition, filter.field, ["select"]);
			const options = filter.any.filter((value): value is string => value !== null);
			const parts = [];
			if (options.length)
				parts.push(sql`coalesce(${valueSql(definition, filter.field)} ?| array[${list(options)}]::text[], false)`);
			if (filter.any.includes(null)) parts.push(emptySql(definition, filter.field));
			return sql`(${sql.join(parts, sql` or `)})`;
		}
		case "empty":
			fieldOf(definition, filter.field, ["text", "media", "select", "relation"]);
			return storedFields(definition)[filter.field]?.kind === "relation"
				? sql`not exists (select 1 from entry_links l where l.from_group = rep.translation_group and l.field = ${filter.field})`
				: emptySql(definition, filter.field);
		case "date":
			return dateRangeSql(dateColumn(filter.field), filter.range, query.timeZone, now);
	}
}

/** The conditions of a query on its collection's representatives. `skip` leaves out the filters on one column, for that column's counts. */
function whereSql(ctx: OperationContext, query: ListQuery, skip?: (filter: Filter) => boolean): RawBuilder<unknown> {
	const definition = collectionOf(ctx, query.collection);
	const now = ctx.now();
	const parts: RawBuilder<unknown>[] = [sql`true`];
	const text = query.search?.text.trim();
	// A folder lists what sits right in it; a search or a filter looks for entries, so inside a folder it goes through its subfolders, and at the top
	// level through every folder (doc 07, inside a folder; T54).
	const looking = Boolean(text) || query.filters.length > 0;
	if (query.folder !== undefined && query.scope === "here") {
		if (query.folder !== null && looking)
			parts.push(sql`rep.folder_id in (with recursive tree as (
				select id from folders where id = ${query.folder}
				union all select f.id from folders f join tree on f.parent_id = tree.id where f.trashed_at is null
			) select id from tree)`);
		else if (query.folder !== null) parts.push(sql`rep.folder_id = ${query.folder}`);
		else if (!looking) parts.push(sql`rep.folder_id is null`);
	}
	if (text) {
		const pattern = likePattern(text);
		const where = query.search?.in ?? "all";
		const columns = where === "all" ? ["title", "slug", "body_text"] : [where === "body" ? "body_text" : where];
		parts.push(
			sql`(${sql.join(
				columns.map((column) => sql`${sql.ref(`rep.${column}`)} ilike ${pattern}`),
				sql` or `,
			)})`,
		);
	}
	const kept = query.filters.filter((filter) => !skip?.(filter));
	// Archived entries leave the list until the status menu asks for them (doc 02, archive).
	if (!query.filters.some((filter) => filter.on === "status")) parts.push(sql`rep.status <> 'archived'`);
	for (const filter of kept) parts.push(filterSql(filter, query, definition, now, ctx.site.schema().locales));
	return sql.join(parts, sql` and `);
}

const icu = new WeakMap<object, Promise<boolean>>();
/**
 * Titles mix Korean and English, so they sort by Unicode's rules (ICU) where the database has them: a libc collation such as macOS's `en_US.UTF-8`
 * puts a title starting with a later syllable before an earlier one.
 */
function hasIcu(ctx: OperationContext): Promise<boolean> {
	let known = icu.get(ctx.db);
	if (!known) {
		known = sql<{ found: boolean }>`select exists (select 1 from pg_collation where collname = 'und-x-icu') as found`
			.execute(ctx.db)
			.then((result) => result.rows[0]?.found === true);
		icu.set(ctx.db, known);
	}
	return known;
}

async function sortSql(ctx: OperationContext, query: ListQuery) {
	const { by, dir } = query.sort;
	const text = by === "title" || by === "slug";
	const column = text ? sql.ref(`rep.${by}`) : dateColumn(by);
	const collated = text && (await hasIcu(ctx)) ? sql`${column} collate "und-x-icu"` : column;
	return sql`${collated} ${sql.raw(dir === "asc" ? "asc" : "desc")} nulls last, rep.id`;
}

type RepRow = {
	id: string;
	translation_group: string;
	title: string;
	slug: string;
	state: EntryState;
	locale: string;
	locales: string[];
	folder_id: string | null;
	version: number;
	created_at: Date;
	updated_at: Date;
	published_at: Date | null;
	values: Record<string, unknown>;
	total: string | number;
};

/** The representative titles of translation groups, for relation values. */
async function groupTitles(ctx: OperationContext, groups: string[]) {
	if (groups.length === 0) return new Map<string, string>();
	const { rows } = await sql<{ translation_group: string; title: string }>`
		select distinct on (translation_group) translation_group, title from entries
		where translation_group in (${list(groups)}) and trashed_at is null
		order by translation_group, locale = ${ctx.site.schema().locales.source} desc, created_at, id`.execute(ctx.db);
	return new Map(rows.map((row) => [row.translation_group, row.title]));
}

/** Runs a list query: the page's rows, one per translation group, and how many rows match in all. */
export async function runListQuery(
	ctx: OperationContext,
	query: ListQuery,
): Promise<{ rows: ListRow[]; total: number }> {
	const definition = collectionOf(ctx, query.collection);
	const { rows } = await sql<RepRow>`
		select rep.id, rep.translation_group, rep.title, rep.slug, ${stateSql} as state, rep.locale, rep.folder_id, rep.version,
			rep.created_at, rep.updated_at, rep.values, p.published_at, count(*) over () as total,
			array(select x.locale from entries x where x.translation_group = rep.translation_group and x.trashed_at is null
				order by x.locale = rep.locale desc, x.locale) as locales
		from ${representatives(query.collection, ctx.site.schema().locales.source)} rep
		left join entry_published p on p.entry_id = rep.id
		where ${whereSql(ctx, query)}
		order by ${await sortSql(ctx, query)}
		limit ${query.pageSize} offset ${(query.page - 1) * query.pageSize}`.execute(ctx.db);
	const relationFields = Object.entries(storedFields(definition))
		.filter(([, field]) => field.kind === "relation")
		.map(([name]) => name);
	const groups = rows.map((row) => row.translation_group);
	// A row shows the chosen option's values only (doc 19), whatever its stored copy still holds.
	for (const row of rows) row.values = chosenValues(definition, row.values);
	const stored = storedFields(definition);
	const shownIn = (values: Record<string, unknown>, field: string) => choseIn(stored[field]?.under, values);
	const links =
		relationFields.length && groups.length
			? await ctx.db
					.selectFrom("entry_links")
					.select(["from_group", "field", "to_group"])
					.where("from_group", "in", groups)
					.where("field", "in", relationFields)
					.orderBy("position")
					.orderBy("to_group")
					.execute()
			: [];
	const titles = await groupTitles(ctx, [...new Set(links.map((link) => link.to_group))]);
	const mediaFields = Object.entries(storedFields(definition))
		.filter(([, field]) => field.kind === "media")
		.map(([name]) => name);
	const fileIds = rows.flatMap((row) =>
		mediaFields.flatMap((field) => {
			const value = mediaValueOf(row.values[field]);
			return value ? [value.media] : [];
		}),
	);
	const files =
		fileIds.length > 0
			? await ctx.db
					.selectFrom("media")
					.select(["id", "name", "kind", "web_key", "original_key"])
					.where("id", "in", fileIds)
					.execute()
			: [];
	const fileOf = new Map(files.map((file) => [file.id, file]));
	let total = rows.length ? Number(rows[0].total) : 0;
	// A page past the end still says how many there are.
	if (!rows.length && query.page > 1) total = (await runListQuery(ctx, { ...query, page: 1, pageSize: 1 })).total;
	return {
		total,
		rows: rows.map((row) => ({
			id: row.id,
			translationGroup: row.translation_group,
			title: row.title,
			slug: row.slug,
			state: row.state,
			locale: row.locale,
			locales: row.locales,
			folderId: row.folder_id,
			version: row.version,
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at),
			publishedAt: row.published_at ? new Date(row.published_at) : null,
			values: row.values,
			relations: Object.fromEntries(
				relationFields.map((field) => [
					field,
					links
						.filter(
							(link) => link.from_group === row.translation_group && link.field === field && shownIn(row.values, field),
						)
						.map((link) => ({ id: link.to_group, title: titles.get(link.to_group) ?? "" })),
				]),
			),
			media: Object.fromEntries(
				mediaFields.flatMap((field) => {
					const value = mediaValueOf(row.values[field]);
					const file = value ? fileOf.get(value.media) : undefined;
					if (!file) return [];
					const thumbnail =
						file.kind === "image" ? (ctx.site.storage?.url(file.web_key ?? file.original_key) ?? null) : null;
					return [[field, { name: file.name, thumbnail }]];
				}),
			),
		})),
	};
}

/** The column a filter belongs to, so a column's counts leave out its own filter. */
const columnOf = (filter: Filter) =>
	filter.on === "status" || filter.on === "locale" || filter.on === "group" || filter.on === "translation"
		? filter.on
		: filter.field;

/** For one column's menu: each value with how many rows have it, the other columns' filters still applied (doc 06, `entries.facets`). */
export async function runFacets(ctx: OperationContext, query: ListQuery, column: string): Promise<Facet[]> {
	const definition = collectionOf(ctx, query.collection);
	const from = sql`${representatives(query.collection, ctx.site.schema().locales.source)} rep left join entry_published p on p.entry_id = rep.id`;
	if (column === "status") {
		// The status menu offers archived entries too, so its counts do not hide them.
		const every = { ...query, filters: [...query.filters, { on: "status" as const, any: [...STATES] }] };
		const { rows } = await sql<{ state: EntryState; count: string }>`
			select ${stateSql} as state, count(*) as count from ${from}
			where ${whereSql(ctx, every, (filter) => filter.on === "status")} group by 1`.execute(ctx.db);
		return STATES.map((state) => ({
			value: state,
			count: Number(rows.find((row) => row.state === state)?.count ?? 0),
		}));
	}
	const where = whereSql(ctx, query, (filter) => columnOf(filter) === column);
	if (column === "translation") {
		// The translation filters' menu rows: how many rows each would leave, for the languages the locale filter picked (or all).
		const { locales } = ctx.site.schema();
		const picked = query.filters.find((filter) => filter.on === "locale");
		const targets = targetsOf(locales, picked?.on === "locale" ? picked.any : undefined);
		return Promise.all(
			(["missing", "sourceChanged", "upToDate"] as const).map(async (is) => {
				const { rows } = await sql<{ count: string }>`select count(*) as count from ${from}
					where ${where} and ${translationSql(is, targets, locales.source)}`.execute(ctx.db);
				return { value: is, count: Number(rows[0]?.count ?? 0) };
			}),
		);
	}
	if (column === "locale") {
		// The groups are picked first (materialized, so the planner keeps it so): joined to their entries before the filters, a translation filter
		// would run once per entry and per group, which grows with the square of the list.
		const { rows } = await sql<{ locale: string; count: string }>`
			with picked as materialized (select rep.translation_group from ${from} where ${where})
			select x.locale, count(distinct picked.translation_group) as count from picked
			join entries x on x.translation_group = picked.translation_group and x.trashed_at is null
			group by x.locale order by count(distinct picked.translation_group) desc, x.locale`.execute(ctx.db);
		return rows.map((row) => ({ value: row.locale, count: Number(row.count) }));
	}
	const field = fieldOf(definition, column, ["relation", "select", "text", "media"]);
	if (field.kind === "relation") {
		const { rows } = await sql<{ to_group: string | null; count: string }>`
			select l.to_group, count(distinct rep.translation_group) as count from ${from}
			left join entry_links l on l.from_group = rep.translation_group and l.field = ${column}
			where ${where} group by l.to_group`.execute(ctx.db);
		const counts = new Map(rows.map((row) => [row.to_group, Number(row.count)]));
		const { rows: targets } = await sql<{ translation_group: string; title: string }>`
			select rep.translation_group, rep.title from ${representatives(field.to, ctx.site.schema().locales.source)} rep where rep.status <> 'archived'`.execute(
			ctx.db,
		);
		const facets = targets
			.map((target) => ({
				value: target.translation_group,
				label: target.title,
				count: counts.get(target.translation_group) ?? 0,
			}))
			.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
		return [{ value: null, count: counts.get(null) ?? 0 }, ...facets];
	}
	if (field.kind === "select") {
		// Of a conditional field's option, only where that option is chosen (doc 19).
		const value = chosenValueSql(field, column);
		const { rows } = await sql<{ option: string | null; count: string }>`
			select o.option, count(*) as count from ${from}
			left join lateral (
				select jsonb_array_elements_text(case jsonb_typeof(${value}) when 'array' then ${value}
					when 'string' then jsonb_build_array(${value}) else '[]'::jsonb end) as option
			) o on true
			where ${where} group by o.option`.execute(ctx.db);
		const counts = new Map(rows.map((row) => [row.option, Number(row.count)]));
		const labels = (await adminValues(ctx, query.collection)).fields?.[column]?.optionLabels ?? {};
		return [
			{ value: null, count: counts.get(null) ?? 0 },
			...field.options.map((option) => ({
				value: option,
				label: labels[option] ?? option,
				count: counts.get(option) ?? 0,
			})),
		];
	}
	const { rows } = await sql<{
		count: string;
	}>`select count(*) as count from ${from} where ${where} and ${emptySql(definition, column)}`.execute(ctx.db);
	return [{ value: "empty", count: Number(rows[0]?.count ?? 0) }];
}

async function adminValues(ctx: OperationContext, collection: string): Promise<AdminValues> {
	const [record] = await adminValuesRecord.load(ctx.db, [collection]);
	return (record?.data as AdminValues | undefined) ?? {};
}

/** A column for every kind of field but the address, which has its own place in the title. A media field's cell shows the picture (doc 09, T59). */
const KIND_OF: Partial<Record<FieldDefinition["kind"], ColumnKind>> = {
	media: "media",
	relation: "relation",
	select: "select",
	text: "text",
};

/** Every column a collection's list can show, in the default order, with whether it shows before the admin changes it (doc 06, columns). */
function schemaColumns(
	definition: CollectionDefinition,
	values: AdminValues,
	multilingual: boolean,
	pluginTabs: readonly PluginTab[],
): (ListColumn & { shown: boolean })[] {
	const theirs = new Map(pluginTabs.flatMap((tab) => tab.fields.map((field) => [field.name, field] as const)));
	const fields = Object.entries(storedFields(definition)).flatMap(([name, field]) => {
		const kind = KIND_OF[field.kind];
		if (!kind || name === "title" || name === "slug") return [];
		// A plugin's field is a column when its plugin says so (doc 06, plugin columns), named as the plugin names it until the admin's
		// values have a name for it, and hidden until a person adds it.
		const plugin = theirs.get(name);
		if (plugin && !plugin.column) return [];
		const saved = values.fields?.[name];
		const labels = plugin
			? {
					label: saved?.label ?? plugin.label,
					optionLabels: { ...plugin.optionLabels, ...saved?.optionLabels },
				}
			: saved;
		return [
			{
				id: name,
				kind,
				field: name,
				label: labels?.label,
				sortable: false,
				filter: field.kind === "relation" ? "relation" : field.kind === "select" ? "select" : "empty",
				hidden: false,
				shown: field.kind === "relation" && !plugin,
				...(field.kind === "relation"
					? { to: field.to, many: field.many ?? false, ...(field.required ? { required: true } : {}) }
					: {}),
				...(field.kind === "select"
					? {
							many: field.many ?? false,
							options: field.options.map((option) => ({
								value: option,
								label: labels?.optionLabels?.[option] ?? option,
							})),
						}
					: {}),
			} satisfies ListColumn & { shown: boolean },
		];
	});
	const date = (id: (typeof DATE_COLUMNS)[number], shown: boolean) =>
		({ id, kind: "date", field: id, sortable: true, filter: "date", hidden: false, shown }) satisfies ListColumn & {
			shown: boolean;
		};
	// An item collection (tags, categories) is live on save: it has no state to show and no publish date (doc 02, principles).
	const document = definition.kind === "document";
	return [
		...(document
			? [{ id: "status", kind: "status", sortable: false, filter: "status", hidden: false, shown: true } as const]
			: []),
		{ id: "title", kind: "title", sortable: true, filter: null, hidden: false, shown: true },
		...fields,
		// The language column is there only when the site writes in more than one language (doc 04, T52).
		...(multilingual
			? [{ id: "locale", kind: "locale", sortable: false, filter: "locale", hidden: false, shown: true } as const]
			: []),
		date("updatedAt", true),
		...(document ? [date("publishedAt", false)] : []),
		date("createdAt", false),
	];
}

/**
 * The columns in the admin's order, with what they hid. The screen saves the whole order, so a column the order does not name is new since then: it
 * goes last and keeps its default visibility.
 */
export function listColumns(
	definition: CollectionDefinition,
	values: AdminValues,
	multilingual: boolean,
	pluginTabs: readonly PluginTab[] = [],
): { columns: ListColumn[]; pageSize: number } {
	const all = schemaColumns(definition, values, multilingual, pluginTabs);
	const prefs = values.list ?? {};
	const order = prefs.order ?? [];
	const known = new Set(order);
	const placed = [
		...order.flatMap((id) => all.filter((column) => column.id === id)),
		...all.filter((column) => !known.has(column.id)),
	];
	return {
		pageSize: prefs.pageSize ?? 25,
		columns: placed.map(({ shown, ...column }) => {
			const width = prefs.widths?.[column.id];
			return {
				...column,
				hidden:
					column.id !== "title" && ((prefs.hidden ?? []).includes(column.id) || (!known.has(column.id) && !shown)),
				...(width === undefined || column.id === "title" ? {} : { width }),
			};
		}),
	};
}

const Show = ListQuery.pick({ collection: true, folder: true, scope: true, search: true, filters: true, sort: true });

export const listOperations = [
	defineOperation({
		name: "entries.query",
		kind: "read",
		description:
			"Find entries of a collection with the list's query: search everywhere or only the title, the address or the body, filter by status, relation values, select options, languages, dates or empty fields, sort, and read a page. One row per translation group. It is the same query the list screen runs, so what a person filters, you can filter.",
		input: ListQuery,
		run: (input, ctx) => runListQuery(ctx, input),
	}),
	defineOperation({
		name: "entries.facets",
		kind: "read",
		description:
			"For one column of a list query (status, locale, or a relation, select, text or media field): each value with how many rows have it, the other columns' filters applied. For a relation, every target with its count and `null` for none.",
		input: ListQuery.extend({ column: z.string() }),
		run: async (input, ctx) => ({ values: await runFacets(ctx, input, input.column) }),
	}),
	defineOperation({
		name: "list.columns",
		kind: "read",
		description:
			"The columns a collection's list can show, from its schema, in the admin's order with the hidden ones marked and the widths the admin dragged, and the page size the admin keeps.",
		input: z.object({ collection: z.string() }),
		async run(input, ctx) {
			return listColumns(
				collectionOf(ctx, input.collection),
				await adminValues(ctx, input.collection),
				translates(ctx.site.schema()),
				ctx.site.pluginTabs(input.collection),
			);
		},
	}),
	defineOperation({
		name: "list.savePrefs",
		kind: "write",
		description:
			"Keep how a collection's list looks: the column order, the hidden columns, the column widths in px (column id → width; a column left out has its kind's width) and the page size (25, 50 or 100). The title column cannot be hidden and has no width: it takes the room the others leave.",
		input: z.object({ collection: z.string() }).extend(ListPrefs.shape),
		touches: (input) => [{ kind: "collectionAdminValues", id: input.collection }],
		async check(input, ctx) {
			const ids = new Set(
				listColumns(
					collectionOf(ctx, input.collection),
					{},
					translates(ctx.site.schema()),
					ctx.site.pluginTabs(input.collection),
				).columns.map((column) => column.id),
			);
			const widths = Object.keys(input.widths ?? {});
			for (const id of [...(input.order ?? []), ...(input.hidden ?? []), ...widths])
				if (!ids.has(id)) throw new CheckError({ key: "list.unknownColumn", values: { column: id } });
			if (input.hidden?.includes("title")) throw new CheckError({ key: "list.titleHidden" });
			if (widths.includes("title")) throw new CheckError({ key: "list.titleWidth" });
		},
		async run({ collection, ...prefs }, ctx) {
			const values = await adminValues(ctx, collection);
			await writeAdminValues(ctx.db, collection, { ...values, list: { ...values.list, ...prefs } });
		},
		// How one admin's list looks is no change to the site: the row is written and the log does not list it.
		log: false,
		summary: (input) => ({ key: "list.savePrefs", values: { collection: input.collection } }),
	}),
	defineOperation({
		name: "list.show",
		kind: "screen",
		description:
			"Show the admin a list: open the collection with this query (search, filters, sort). Filters you set show as blue chips until the admin changes them. No data changes.",
		input: Show,
		run: (): null => {
			throw new Error("list.show runs in the browser.");
		},
	}),
	defineOperation({
		name: "list.select",
		kind: "screen",
		description:
			"Select rows on the list the admin sees (entry ids from entries.query), marked blue as yours until the admin touches them. No data changes.",
		input: z.object({ ids: z.array(z.string()) }),
		run: (): null => {
			throw new Error("list.select runs in the browser.");
		},
	}),
];
