import { sql } from "kysely";
import { z } from "zod";
import { randomUUID } from "../bytes";
import { pathKept, publicPath, publicPaths } from "../entries/paths";
import { CheckError } from "../errors";
import { checkMediaValues } from "../media/uses";
import { defineOperation, type Preview, type RecordRef } from "../operation";
import {
	generateUniqueSlug,
	resolveInlineCreation,
	syncEntryLinks,
	syncRelationsForEntry,
	unlinkTargetGroup,
} from "./sync";

export { unlinkTargetGroup };

const ref = (id: string): RecordRef => ({ kind: "entry", id });

export type RelationOption = {
	group: string;
	entryId: string;
	title: string;
	slug: string;
	locale: string;
	fallback: boolean;
	status: "draft" | "published" | "archived";
	published: boolean;
	position: number;
};

export type RelationOptionsResult = {
	options: RelationOption[];
	/** Targets in the trash, by group: a field that still points at one names it and says where it is (doc 08). They are no choices. */
	trashed: { group: string; title: string }[];
	canCreate: boolean;
	exactMatch: boolean;
	targetCollection: string;
	targetKind: "document" | "item";
};

export type UsageItem = {
	group: string;
	title: string;
	position: number;
	usageCount: number;
	firstRef?: { collection: string; field: string };
	locales: Record<
		string,
		{ id: string; title: string; slug: string; values: Record<string, unknown>; updatedAt: string }
	>;
	missingLocales: string[];
};

export type UsageResult = {
	items: UsageItem[];
};

export type MergeResult = {
	intoGroup: string;
	intoTitle: string;
	affectedCount: number;
	trashedItems: { group: string; title: string; slugs: string[] }[];
	removedUrls: string[];
};

export const relationOperations = [
	defineOperation({
		name: "relations.options",
		kind: "read",
		description:
			"Find choices for a relation field: active entries in the target collection, with title in the requested language (or fallback to source language) and publish state.",
		input: z.object({
			collection: z.string(),
			field: z.string(),
			locale: z.string().optional(),
			search: z.string().optional(),
			entryGroup: z.string().optional(),
		}),
		async check(input, ctx) {
			const schema = ctx.site.schema();
			const colDef = schema.collections[input.collection];
			if (!colDef) throw new CheckError({ key: "collections.unknown", values: { collection: input.collection } });
			const fieldDef = colDef.fields[input.field];
			if (!fieldDef) throw new CheckError({ key: "entries.unknownField", values: { field: input.field } });
			if (fieldDef.kind !== "relation")
				throw new CheckError({ key: "relations.notRelation", values: { field: input.field } });
		},
		async run(input, ctx): Promise<RelationOptionsResult> {
			const schema = ctx.site.schema();
			const colDef = schema.collections[input.collection];
			const fieldDef = colDef.fields[input.field];
			if (!fieldDef || fieldDef.kind !== "relation") {
				throw new CheckError({ key: "relations.notRelation", values: { field: input.field } });
			}
			const targetCol = fieldDef.to;
			const targetKind = schema.collections[targetCol]?.kind ?? "item";

			const rows = await ctx.db
				.selectFrom("entries as e")
				.leftJoin("entry_published as p", "p.entry_id", "e.id")
				.select([
					"e.id",
					"e.translation_group",
					"e.locale",
					"e.title",
					"e.slug",
					"e.status",
					"e.position",
					"p.entry_id as published_id",
				])
				.where("e.collection", "=", targetCol)
				.where("e.trashed_at", "is", null)
				.execute();

			const groupsMap = new Map<string, typeof rows>();
			for (const row of rows) {
				if (input.entryGroup && row.translation_group === input.entryGroup) continue;
				const list = groupsMap.get(row.translation_group) ?? [];
				list.push(row);
				groupsMap.set(row.translation_group, list);
			}

			const targetLocale = input.locale ?? schema.locales.source;
			const searchLower = input.search?.trim().toLowerCase();

			const options: RelationOption[] = [];
			for (const [group, groupRows] of groupsMap) {
				const hasPublished = targetKind === "item" || groupRows.some((r) => r.published_id !== null);

				const matchingLocaleRow = groupRows.find((r) => r.locale === targetLocale && r.title.trim() !== "");
				const sourceLocaleRow = groupRows.find((r) => r.locale === schema.locales.source && r.title.trim() !== "");
				const selected = matchingLocaleRow ?? sourceLocaleRow ?? groupRows[0];
				const fallback = !matchingLocaleRow && selected.locale !== targetLocale;

				if (searchLower) {
					const anyMatches = groupRows.some(
						(r) => r.title.toLowerCase().includes(searchLower) || r.slug.toLowerCase().includes(searchLower),
					);
					if (!anyMatches) continue;
				}

				options.push({
					group,
					entryId: selected.id,
					title: selected.title,
					slug: selected.slug,
					locale: selected.locale,
					fallback,
					status: selected.status as "draft" | "published" | "archived",
					published: hasPublished,
					position: selected.position ?? 0,
				});
			}

			options.sort((a, b) => a.title.localeCompare(b.title, targetLocale));

			const gone = await ctx.db
				.selectFrom("entries")
				.select(["translation_group", "locale", "title"])
				.where("collection", "=", targetCol)
				.where("trashed_at", "is not", null)
				.execute();
			const trashed = new Map<string, { group: string; title: string; locale: string }>();
			for (const row of gone) {
				const seen = trashed.get(row.translation_group);
				// The requested language's name, else the source language's, else any.
				const better =
					!seen ||
					row.locale === targetLocale ||
					(row.locale === schema.locales.source && seen.locale !== targetLocale);
				if (better && !groupsMap.has(row.translation_group))
					trashed.set(row.translation_group, { group: row.translation_group, title: row.title, locale: row.locale });
			}

			const exactMatch = Boolean(searchLower && options.some((opt) => opt.title.toLowerCase() === searchLower));
			const canCreate = Boolean(fieldDef.createMissing && searchLower && !exactMatch);

			return {
				options,
				trashed: [...trashed.values()].map(({ group, title }) => ({ group, title })),
				canCreate,
				exactMatch,
				targetCollection: targetCol,
				targetKind,
			};
		},
	}),

	defineOperation({
		name: "relations.usage",
		kind: "read",
		description: "How many entries use each item in a collection, with titles in all languages and missing languages.",
		input: z.object({
			collection: z.string(),
			groups: z.array(z.string()).optional(),
			locale: z.string().optional(),
		}),
		async check(input, ctx) {
			const schema = ctx.site.schema();
			if (!schema.collections[input.collection]) {
				throw new CheckError({ key: "collections.unknown", values: { collection: input.collection } });
			}
		},
		async run(input, ctx): Promise<UsageResult> {
			const schema = ctx.site.schema();
			let query = ctx.db
				.selectFrom("entries")
				.selectAll()
				.where("collection", "=", input.collection)
				.where("trashed_at", "is", null);
			if (input.groups && input.groups.length > 0) {
				query = query.where("translation_group", "in", input.groups);
			}
			const rows = await query.orderBy("position", "asc").orderBy("created_at", "asc").execute();

			const groupsMap = new Map<string, typeof rows>();
			for (const r of rows) {
				const list = groupsMap.get(r.translation_group) ?? [];
				list.push(r);
				groupsMap.set(r.translation_group, list);
			}

			// Default firstRef from schema
			let defaultFirstRef: { collection: string; field: string } | undefined;
			for (const [colName, colDef] of Object.entries(schema.collections)) {
				for (const [fName, fDef] of Object.entries(colDef.fields)) {
					if (fDef.kind === "relation" && fDef.to === input.collection) {
						defaultFirstRef = { collection: colName, field: fName };
						break;
					}
				}
				if (defaultFirstRef) break;
			}

			const targetLocale = input.locale ?? schema.locales.source;
			const items: UsageItem[] = [];

			for (const [group, groupRows] of groupsMap) {
				const usageQuery = await sql<{ count: string }>`
					select count(distinct l.from_group) as count
					from entry_links l
					inner join entries e on e.translation_group = l.from_group and e.trashed_at is null
					where l.to_group = ${group}
				`.execute(ctx.db);
				const usageCount = Number(usageQuery.rows[0]?.count ?? 0);

				const refQuery = await sql<{ collection: string; field: string }>`
					select distinct e.collection, l.field
					from entry_links l
					inner join entries e on e.translation_group = l.from_group and e.trashed_at is null
					where l.to_group = ${group}
					limit 1
				`.execute(ctx.db);
				const firstRef = refQuery.rows[0] ?? defaultFirstRef;

				const locales: UsageItem["locales"] = {};
				for (const r of groupRows) {
					locales[r.locale] = {
						id: r.id,
						title: r.title,
						slug: r.slug,
						values: r.values as Record<string, unknown>,
						updatedAt: r.updated_at.toISOString(),
					};
				}

				const resolvedTitle =
					locales[targetLocale]?.title || locales[schema.locales.source]?.title || groupRows[0]?.title || "";

				const missingLocales = schema.locales.list
					.map((l) => l.code)
					.filter((code) => !locales[code] || locales[code].title.trim() === "");

				items.push({
					group,
					title: resolvedTitle,
					position: groupRows[0]?.position ?? 0,
					usageCount,
					firstRef,
					locales,
					missingLocales,
				});
			}

			return { items };
		},
	}),

	defineOperation({
		name: "relations.edit",
		kind: "write",
		description: "Add, remove or set relation values across one or more entries in a collection.",
		input: z.object({
			collection: z.string(),
			entryIds: z.array(z.string()).optional(),
			groups: z.array(z.string()).optional(),
			field: z.string(),
			add: z.array(z.string()).optional(),
			remove: z.array(z.string()).optional(),
			set: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
		}),
		async touches(input, ctx) {
			const groupsSet = new Set<string>(input.groups ?? []);
			if (input.entryIds && input.entryIds.length > 0) {
				const rows = await ctx.db
					.selectFrom("entries")
					.select("translation_group")
					.where("id", "in", input.entryIds)
					.execute();
				for (const r of rows) groupsSet.add(r.translation_group);
			}
			const targetGroups = [...groupsSet];
			if (targetGroups.length === 0) return [];

			const rows = await ctx.db
				.selectFrom("entries")
				.select(["id", "values", "translation_group"])
				.where("collection", "=", input.collection)
				.where("translation_group", "in", targetGroups)
				.where("trashed_at", "is", null)
				.execute();

			const touchedIds = new Set<string>(rows.map((r) => r.id));

			const fieldDef = ctx.site.schema().collections[input.collection]?.fields[input.field];
			if (fieldDef?.kind === "relation" && fieldDef.via !== undefined) {
				const targetCol = fieldDef.to;
				const viaGroups = new Set<string>();
				for (const r of rows) {
					const val = (r.values as Record<string, unknown>)[input.field];
					if (Array.isArray(val))
						for (const g of val)
							if (typeof g === "string") viaGroups.add(g);
							else if (typeof val === "string" && val) viaGroups.add(val);
				}
				if (input.add) for (const g of input.add) viaGroups.add(g);
				if (input.remove) for (const g of input.remove) viaGroups.add(g);
				if (Array.isArray(input.set)) for (const g of input.set) viaGroups.add(g);
				else if (typeof input.set === "string" && input.set) viaGroups.add(input.set);

				if (viaGroups.size > 0) {
					const targetRows = await ctx.db
						.selectFrom("entries")
						.select("id")
						.where("collection", "=", targetCol)
						.where("translation_group", "in", [...viaGroups])
						.where("trashed_at", "is", null)
						.execute();
					for (const tr of targetRows) touchedIds.add(tr.id);
				}
			}

			return [...touchedIds].map(ref);
		},
		async check(input, ctx) {
			const schema = ctx.site.schema();
			const colDef = schema.collections[input.collection];
			if (!colDef) throw new CheckError({ key: "collections.unknown", values: { collection: input.collection } });
			const fieldDef = colDef.fields[input.field];
			if (!fieldDef) throw new CheckError({ key: "entries.unknownField", values: { field: input.field } });
			if (fieldDef.kind !== "relation")
				throw new CheckError({ key: "relations.notRelation", values: { field: input.field } });
		},
		async run(input, ctx) {
			const schema = ctx.site.schema();
			const colDef = schema.collections[input.collection];
			/** Says that what the site shows of a live item changed, so a site that keeps its pages draws them again. */
			const shown = (entry: { id: string; collection: string; locale: string; slug: string }) =>
				ctx.emit({
					type: "entry.published",
					ids: [entry.id],
					collection: entry.collection,
					locale: entry.locale,
					paths: publicPaths(schema, entry.collection, entry.locale, [entry.slug]),
				});
			const fieldDef = colDef.fields[input.field];
			if (!fieldDef || fieldDef.kind !== "relation") {
				throw new CheckError({ key: "relations.notRelation", values: { field: input.field } });
			}

			// Gather translation groups
			const groupsSet = new Set<string>(input.groups ?? []);
			if (input.entryIds && input.entryIds.length > 0) {
				const rows = await ctx.db
					.selectFrom("entries")
					.select("translation_group")
					.where("id", "in", input.entryIds)
					.execute();
				for (const r of rows) groupsSet.add(r.translation_group);
			}

			const targetGroups = [...groupsSet];
			if (targetGroups.length === 0) return { updatedGroups: [], count: 0 };

			// Resolve inline creation in add or set if createMissing
			let toAdd = input.add ? [...input.add] : undefined;
			let toSet = input.set;
			if (fieldDef.createMissing) {
				if (toAdd) {
					const resolvedObj = await resolveInlineCreation(ctx, input.collection, { [input.field]: toAdd });
					toAdd = resolvedObj[input.field] as string[];
				}
				if (toSet !== undefined && toSet !== null) {
					const resolvedObj = await resolveInlineCreation(ctx, input.collection, { [input.field]: toSet });
					toSet = resolvedObj[input.field] as string | string[];
				}
			}

			for (const group of targetGroups) {
				const entriesInGroup = await ctx.db
					.selectFrom("entries")
					.selectAll()
					.where("collection", "=", input.collection)
					.where("translation_group", "=", group)
					.where("trashed_at", "is", null)
					.execute();

				for (const entry of entriesInGroup) {
					const prevValues = { ...entry.values };
					const values = entry.values as Record<string, unknown>;

					if (fieldDef.via !== undefined) {
						let currentViaTargets: string[] = [];
						if (Array.isArray(values[input.field])) {
							currentViaTargets = values[input.field] as string[];
						} else if (typeof values[input.field] === "string" && values[input.field]) {
							currentViaTargets = [values[input.field] as string];
						}

						let nextViaTargets = [...currentViaTargets];
						if (toSet !== undefined) {
							nextViaTargets = toSet === null ? [] : Array.isArray(toSet) ? toSet : [toSet];
						} else {
							if (input.remove) {
								nextViaTargets = nextViaTargets.filter((x) => !input.remove?.includes(x));
							}
							if (toAdd) {
								for (const item of toAdd) {
									if (!nextViaTargets.includes(item)) nextViaTargets.push(item);
								}
							}
						}
						values[input.field] = fieldDef.many ? nextViaTargets : (nextViaTargets[0] ?? null);

						await ctx.db
							.updateTable("entries")
							.set({ values: JSON.stringify(values), updated_at: ctx.now() })
							.where("id", "=", entry.id)
							.execute();
						if (colDef.kind === "item") {
							await ctx.db
								.updateTable("entry_published")
								.set({ values: JSON.stringify(values) })
								.where("entry_id", "=", entry.id)
								.execute();
							// An item is live as saved: what the site shows of it changed.
							shown(entry);
						}
						await syncRelationsForEntry(
							ctx,
							{
								id: entry.id,
								collection: entry.collection,
								translationGroup: entry.translation_group,
								locale: entry.locale,
							},
							values,
							prevValues,
						);
					} else {
						if (fieldDef.many) {
							const current = Array.isArray(values[input.field]) ? (values[input.field] as string[]) : [];
							let next = [...current];
							if (toSet !== undefined) {
								next = toSet === null ? [] : Array.isArray(toSet) ? toSet : [toSet];
							} else {
								if (input.remove) {
									next = next.filter((x) => !input.remove?.includes(x));
								}
								if (toAdd) {
									for (const item of toAdd) {
										if (!next.includes(item)) next.push(item);
									}
								}
							}
							values[input.field] = [...new Set(next)];
						} else {
							if (toSet !== undefined) {
								values[input.field] =
									typeof toSet === "string" ? toSet : Array.isArray(toSet) ? (toSet[0] ?? null) : null;
							} else if (toAdd?.length) {
								values[input.field] = toAdd[0];
							} else if (input.remove?.length) {
								if (input.remove.includes(values[input.field] as string)) {
									values[input.field] = null;
								}
							}
						}

						await ctx.db
							.updateTable("entries")
							.set({ values: JSON.stringify(values), updated_at: ctx.now() })
							.where("id", "=", entry.id)
							.execute();
						if (colDef.kind === "item") {
							await ctx.db
								.updateTable("entry_published")
								.set({ values: JSON.stringify(values) })
								.where("entry_id", "=", entry.id)
								.execute();
							// An item is live as saved: what the site shows of it changed.
							shown(entry);
						}
						await syncRelationsForEntry(
							ctx,
							{
								id: entry.id,
								collection: entry.collection,
								translationGroup: entry.translation_group,
								locale: entry.locale,
							},
							values,
							prevValues,
						);
					}
				}
			}

			return { updatedGroups: targetGroups, count: targetGroups.length };
		},
		log: "save",
		summary: (_input, output) => ({ key: "relations.edit", values: { count: output.count } }),
		where: (input) => ({ key: "activity.where.collection", values: { collection: input.collection } }),
	}),

	defineOperation({
		name: "relations.merge",
		kind: "write",
		description:
			"Merge multiple items in a collection into one surviving item, updating all pointing entries and sending merged items to trash.",
		input: z.object({
			collection: z.string(),
			intoGroup: z.string(),
			fromGroups: z.array(z.string()).min(1),
		}),
		async touches(input, ctx) {
			const pointingLinks = await ctx.db
				.selectFrom("entry_links")
				.select("from_group")
				.where("to_group", "in", input.fromGroups)
				.execute();
			const fromGroups = [...new Set(pointingLinks.map((l) => l.from_group))];

			const pointingEntries =
				fromGroups.length > 0
					? await ctx.db
							.selectFrom("entries")
							.select("id")
							.where("translation_group", "in", fromGroups)
							.where("trashed_at", "is", null)
							.execute()
					: [];

			const mergedItems = await ctx.db
				.selectFrom("entries")
				.select("id")
				.where("collection", "=", input.collection)
				.where("translation_group", "in", input.fromGroups)
				.execute();

			const touched = new Set<string>([...pointingEntries.map((e) => e.id), ...mergedItems.map((e) => e.id)]);
			return [...touched].map(ref);
		},
		async check(input, ctx) {
			const schema = ctx.site.schema();
			if (!schema.collections[input.collection]) {
				throw new CheckError({ key: "collections.unknown", values: { collection: input.collection } });
			}
			if (input.fromGroups.includes(input.intoGroup)) {
				throw new CheckError({ key: "relations.sameMergeGroup" });
			}
			const intoExists = await ctx.db
				.selectFrom("entries")
				.select("id")
				.where("collection", "=", input.collection)
				.where("translation_group", "=", input.intoGroup)
				.where("trashed_at", "is", null)
				.executeTakeFirst();
			if (!intoExists) {
				throw new CheckError({ key: "relations.unknownGroup", values: { group: input.intoGroup } });
			}
			for (const fg of input.fromGroups) {
				const fromExists = await ctx.db
					.selectFrom("entries")
					.select("id")
					.where("collection", "=", input.collection)
					.where("translation_group", "=", fg)
					.where("trashed_at", "is", null)
					.executeTakeFirst();
				if (!fromExists) {
					throw new CheckError({ key: "relations.unknownGroup", values: { group: fg } });
				}
			}
		},
		async preview(
			input,
			ctx,
		): Promise<
			Preview & {
				intoTitle: string;
				intoGroup: string;
				affectedCount: number;
				trashedItems: { group: string; title: string; slugs: string[] }[];
				removedUrls: string[];
			}
		> {
			const schema = ctx.site.schema();
			const intoRows = await ctx.db
				.selectFrom("entries")
				.select(["title", "locale"])
				.where("collection", "=", input.collection)
				.where("translation_group", "=", input.intoGroup)
				.where("trashed_at", "is", null)
				.execute();
			const intoRow =
				intoRows.find((r) => r.locale === schema.locales.source && r.title.trim() !== "") ??
				intoRows.find((r) => r.title.trim() !== "") ??
				intoRows[0];
			const intoTitle = intoRow?.title ?? input.intoGroup;

			const fromEntries = await ctx.db
				.selectFrom("entries")
				.select(["id", "translation_group", "title", "slug", "locale"])
				.where("collection", "=", input.collection)
				.where("translation_group", "in", input.fromGroups)
				.where("trashed_at", "is", null)
				.execute();

			const trashedItems: { group: string; title: string; slugs: string[] }[] = [];
			const removedUrls: string[] = [];
			for (const fg of input.fromGroups) {
				const items = fromEntries.filter((e) => e.translation_group === fg);
				const title = items.find((e) => e.locale === schema.locales.source)?.title || items[0]?.title || "";
				const slugs = items.map((e) => e.slug).filter(Boolean);
				trashedItems.push({ group: fg, title, slugs });
				for (const item of items) {
					const path = publicPath(schema, input.collection, item.slug, item.locale);
					if (path) removedUrls.push(path);
				}
			}

			const links = await ctx.db
				.selectFrom("entry_links")
				.innerJoin("entries", "entries.translation_group", "entry_links.from_group")
				.select(["entry_links.from_group", "entries.id"])
				.where("entry_links.to_group", "in", input.fromGroups)
				.where("entries.trashed_at", "is", null)
				.execute();

			const distinctFromGroups = [...new Set(links.map((l) => l.from_group))];
			const affectedCount = distinctFromGroups.length;

			return {
				summary: { key: "relations.merge", values: { count: affectedCount, intoTitle } },
				changes: [...new Set(links.map((l) => l.id)), ...fromEntries.map((e) => e.id)].map(ref),
				intoGroup: input.intoGroup,
				intoTitle,
				affectedCount,
				trashedItems,
				removedUrls,
			};
		},
		async run(input, ctx): Promise<MergeResult> {
			const schema = ctx.site.schema();
			const intoRows = await ctx.db
				.selectFrom("entries")
				.select(["title", "locale"])
				.where("collection", "=", input.collection)
				.where("translation_group", "=", input.intoGroup)
				.where("trashed_at", "is", null)
				.execute();
			const intoRow =
				intoRows.find((r) => r.locale === schema.locales.source && r.title.trim() !== "") ??
				intoRows.find((r) => r.title.trim() !== "") ??
				intoRows[0];
			const intoTitle = intoRow?.title ?? input.intoGroup;

			const fromEntries = await ctx.db
				.selectFrom("entries")
				.select(["id", "translation_group", "title", "slug", "locale"])
				.where("collection", "=", input.collection)
				.where("translation_group", "in", input.fromGroups)
				.where("trashed_at", "is", null)
				.execute();

			const trashedItems: { group: string; title: string; slugs: string[] }[] = [];
			const removedUrls: string[] = [];
			for (const fg of input.fromGroups) {
				const items = fromEntries.filter((e) => e.translation_group === fg);
				const title = items.find((e) => e.locale === schema.locales.source)?.title || items[0]?.title || "";
				const slugs = items.map((e) => e.slug).filter(Boolean);
				trashedItems.push({ group: fg, title, slugs });
				for (const item of items) {
					const path = publicPath(schema, input.collection, item.slug, item.locale);
					if (path) removedUrls.push(path);
				}
			}

			// Find pointing entries
			const links = await ctx.db
				.selectFrom("entry_links")
				.select(["from_group", "field", "to_group"])
				.where("to_group", "in", input.fromGroups)
				.execute();

			const distinctFromGroups = [...new Set(links.map((l) => l.from_group))];
			const affectedCount = distinctFromGroups.length;

			for (const fromGroup of distinctFromGroups) {
				const entries = await ctx.db
					.selectFrom("entries")
					.selectAll()
					.where("translation_group", "=", fromGroup)
					.where("trashed_at", "is", null)
					.execute();

				for (const entry of entries) {
					const values = entry.values as Record<string, unknown>;
					const colFields = schema.collections[entry.collection]?.fields ?? {};

					for (const [fName, fDef] of Object.entries(colFields)) {
						if (fDef.kind === "relation" && fDef.to === input.collection) {
							if (fDef.many) {
								const current = Array.isArray(values[fName]) ? (values[fName] as string[]) : [];
								const replaced = current.map((g) => (input.fromGroups.includes(g) ? input.intoGroup : g));
								// Deduplicate preserving first seen position
								const seen = new Set<string>();
								values[fName] = replaced.filter((g) => {
									if (seen.has(g)) return false;
									seen.add(g);
									return true;
								});
							} else {
								if (input.fromGroups.includes(values[fName] as string)) {
									values[fName] = input.intoGroup;
								}
							}

							await syncEntryLinks(
								ctx,
								entry.translation_group,
								fName,
								fDef.many ? (values[fName] as string[]) : values[fName] ? [values[fName] as string] : [],
							);
						}
					}

					await ctx.db
						.updateTable("entries")
						.set({ values: JSON.stringify(values), updated_at: ctx.now() })
						.where("id", "=", entry.id)
						.execute();
					const live = await ctx.db
						.updateTable("entry_published")
						.set({ values: JSON.stringify(values) })
						.where("entry_id", "=", entry.id)
						.returning("slug")
						.executeTakeFirst();
					// What the site shows of an entry that pointed at a merged item changed: it points at the one they became.
					if (live)
						ctx.emit({
							type: "entry.published",
							ids: [entry.id],
							collection: entry.collection,
							locale: entry.locale,
							paths: publicPaths(schema, entry.collection, entry.locale, [live.slug]),
						});
				}
			}

			// Trash fromGroups items
			const now = ctx.now();
			for (const fe of fromEntries) {
				await ctx.db.updateTable("entries").set({ trashed_at: now, updated_at: now }).where("id", "=", fe.id).execute();
				const gone = await ctx.db
					.deleteFrom("entry_published")
					.where("entry_id", "=", fe.id)
					.returning("slug")
					.executeTakeFirst();
				// A merged item's own page is gone from the site.
				if (gone)
					ctx.emit({
						type: "entry.unpublished",
						ids: [fe.id],
						collection: input.collection,
						locale: fe.locale,
						paths: publicPaths(schema, input.collection, fe.locale, [gone.slug]),
					});
			}

			return {
				intoGroup: input.intoGroup,
				intoTitle,
				affectedCount,
				trashedItems,
				removedUrls,
			};
		},
		log: "save",
		summary: (_input, output) => ({
			key: "relations.merge",
			values: { count: output.affectedCount, intoTitle: output.intoTitle },
		}),
		where: (input) => ({ key: "activity.where.collection", values: { collection: input.collection } }),
	}),

	defineOperation({
		name: "items.saveGroup",
		kind: "write",
		description: "Save an item group's per-language titles, slugs, descriptions and values all at once.",
		input: z.object({
			collection: z.string(),
			group: z.string().optional(),
			locales: z.record(
				z.string(),
				z.object({
					title: z.string().optional(),
					slug: z.string().optional(),
					description: z.string().optional(),
					values: z.record(z.string(), z.unknown()).optional(),
				}),
			),
		}),
		async touches(input, ctx) {
			if (!input.group) return [];
			const rows = await ctx.db
				.selectFrom("entries")
				.select("id")
				.where("collection", "=", input.collection)
				.where("translation_group", "=", input.group)
				.execute();
			return rows.map((r) => ref(r.id));
		},
		async check(input, ctx) {
			const schema = ctx.site.schema();
			const colDef = schema.collections[input.collection];
			if (!colDef) throw new CheckError({ key: "collections.unknown", values: { collection: input.collection } });
			if (colDef.kind !== "item")
				throw new CheckError({ key: "items.notItem", values: { collection: input.collection } });
			for (const locale of Object.values(input.locales))
				await checkMediaValues(ctx.db, schema, input.collection, locale.values);
			// An item is on the site as soon as it is saved: a typed address that a deleted item was published under is refused (doc 11, principle 5).
			for (const [locale, data] of Object.entries(input.locales))
				if (data.slug && (await pathKept(ctx.db, input.collection, locale, data.slug)))
					throw new CheckError({ key: "items.pathKept", values: { slug: data.slug } });
		},
		async run(input, ctx) {
			const group = input.group ?? randomUUID();
			const existingRows = await ctx.db
				.selectFrom("entries")
				.selectAll()
				.where("collection", "=", input.collection)
				.where("translation_group", "=", group)
				.execute();

			let nextPosition: number;
			if (existingRows.length > 0) {
				nextPosition = existingRows[0].position ?? 0;
			} else {
				const maxRow = await ctx.db
					.selectFrom("entries")
					.select((eb) => eb.fn.max("position").as("max"))
					.where("collection", "=", input.collection)
					.executeTakeFirst();
				nextPosition = (Number(maxRow?.max) || 0) + 1;
			}

			const now = ctx.now();
			const localesOutput: Record<string, { id: string; title: string; slug: string }> = {};

			for (const [locale, data] of Object.entries(input.locales)) {
				const existing = existingRows.find((r) => r.locale === locale);
				const title = data.title !== undefined ? data.title : (existing?.title ?? "");
				const existingValues = existing?.values ? (existing.values as Record<string, unknown>) : {};
				const values = { ...existingValues, ...(data.values ?? {}) };
				if (data.description !== undefined) {
					values.description = data.description;
				}

				if (existing) {
					const slug =
						data.slug ||
						existing.slug ||
						(await generateUniqueSlug(ctx.db, input.collection, locale, title, existing.id, existing.id));
					const version = existing.version + 1;
					await ctx.db
						.updateTable("entries")
						.set({
							title,
							slug,
							values: JSON.stringify(values),
							status: "published",
							has_unpublished_changes: false,
							version,
							updated_at: now,
							trashed_at: null,
						})
						.where("id", "=", existing.id)
						.execute();

					await ctx.db
						.insertInto("entry_published")
						.values({
							entry_id: existing.id,
							collection: input.collection,
							locale,
							title,
							slug,
							values: JSON.stringify(values),
							doc: null,
							published_at: now,
							from_version: version,
							block_hashes: JSON.stringify({}),
						})
						.onConflict((conflict) =>
							conflict.column("entry_id").doUpdateSet({
								title,
								slug,
								values: JSON.stringify(values),
								from_version: version,
							}),
						)
						.execute();

					await syncRelationsForEntry(
						ctx,
						{ id: existing.id, collection: input.collection, translationGroup: group, locale },
						values,
					);

					ctx.emit({ type: "entry.saved", ids: [existing.id], collection: input.collection, locale, version });
					ctx.emit({
						type: "entry.published",
						ids: [existing.id],
						collection: input.collection,
						locale,
						paths: publicPaths(ctx.site.schema(), input.collection, locale, [slug, existing.slug]),
					});
					localesOutput[locale] = { id: existing.id, title, slug };
				} else {
					if (!data.title || data.title.trim() === "") continue;
					const id = randomUUID();
					const slug =
						data.slug || (await generateUniqueSlug(ctx.db, input.collection, locale, data.title, undefined, id));

					await ctx.db
						.insertInto("entries")
						.values({
							id,
							collection: input.collection,
							translation_group: group,
							locale,
							title: data.title,
							slug,
							status: "published",
							has_unpublished_changes: false,
							version: 1,
							position: nextPosition,
							values: JSON.stringify(values),
							doc: null,
							created_at: now,
							updated_at: now,
						})
						.execute();

					await ctx.db
						.insertInto("entry_published")
						.values({
							entry_id: id,
							collection: input.collection,
							locale,
							title: data.title,
							slug,
							values: JSON.stringify(values),
							doc: null,
							published_at: now,
							from_version: 1,
							block_hashes: JSON.stringify({}),
						})
						.execute();

					await syncRelationsForEntry(
						ctx,
						{ id, collection: input.collection, translationGroup: group, locale },
						values,
					);

					ctx.created(ref(id));
					ctx.emit({ type: "entry.saved", ids: [id], collection: input.collection, locale, version: 1 });
					ctx.emit({
						type: "entry.published",
						ids: [id],
						collection: input.collection,
						locale,
						paths: publicPaths(ctx.site.schema(), input.collection, locale, [slug]),
					});
					localesOutput[locale] = { id, title: data.title, slug };
				}
			}

			return { id: group, group, locales: localesOutput };
		},
		log: "save",
		summary: (_input, output) => ({
			key: "items.saveGroup",
			values: { title: Object.values(output.locales)[0]?.title ?? "" },
		}),
		where: (input) => ({ key: "activity.where.collection", values: { collection: input.collection } }),
	}),
];
