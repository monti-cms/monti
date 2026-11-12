import { type AdminValues, type SchemaProblem, sameJson } from "@monti-cms/core";
import { useCallback, useMemo } from "react";
import { type Path, useDraft } from "../../draft/use-draft";
import type { ProposalItem } from "../../draft/use-proposals";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import { ofCollection } from "./review-sheet";
import {
	at,
	build,
	type Catalog,
	collectionKeys,
	type DraftField,
	fieldKeys,
	flatten,
	type LocaleRow,
	localeProposalPaths,
	localeRows,
	placeOf,
	proposalPaths,
	type SettingsRead,
	savedValues,
	tabOf,
} from "./schema-draft";

/** The record the draft is kept under and the site's proposals aim at; the schema's proposals (`schema.apply`, `locales.apply`) join it. */
const TARGET = { kind: "settings", id: "site" };
const SCHEMA = { kind: "schema", id: "current" };

/** The words of the site tab's values, as the changes list names them. */
const SITE_VALUE: Record<string, string> = {
	[at.site("name")]: "settings.site.name",
	[at.site("writing")]: "settings.site.writing",
	[at.localePrefix]: "settings.site.prefix",
};

/** The words of a collection's own admin values, as the changes list names them. */
const COLLECTION_VALUE = {
	label: "settings.collection.label",
	folders: "settings.collection.folders",
	layout: "settings.collection.layout",
} as const;

/** One line of the changes list: a thing the person changed, with every place it holds, so its undo puts all of them back. */
export type ChangeRow = {
	id: string;
	/** The collection it belongs to; absent for a change of the site or language tab. */
	collection?: string;
	tab: "site" | "languages" | "collections";
	name: string;
	tag: string;
	tone: "warning" | "danger" | "success";
	paths: Path[];
};

/** The input of an assistant's `settings.save`, as far as the screen draws it. */
type SaveProposal = {
	site?: { name?: string; writing?: string };
	locales?: SettingsRead["schema"]["locales"];
	collections?: SettingsRead["schema"]["collections"];
	renames?: Parameters<typeof proposalPaths>[1]["renames"];
	adminValues?: Record<string, AdminValues>;
};

/** The places a pending proposal item writes, as the settings screen reads its input. */
function proposalPlaces(data: SettingsRead, item: ProposalItem): Record<Path, unknown> {
	if (item.operation === "schema.apply") return proposalPaths(data, item.input as Parameters<typeof proposalPaths>[1]);
	if (item.operation === "locales.apply")
		return localeProposalPaths(data, (item.input as { locales?: SettingsRead["schema"]["locales"] }).locales);
	if (item.operation !== "settings.save") return {};
	const input = item.input as SaveProposal;
	const out: Record<Path, unknown> = {};
	if (input.site?.name !== undefined) out[at.site("name")] = input.site.name;
	if (input.site?.writing !== undefined) out[at.site("writing")] = input.site.writing;
	return {
		...out,
		...(input.collections
			? proposalPaths(data, {
					draft: { locales: input.locales ?? data.schema.locales, collections: input.collections },
					renames: input.renames,
					adminValues: input.adminValues,
				})
			: localeProposalPaths(data, input.locales)),
	};
}

/**
 * The settings screen as one draft (docs 05 and 12): the site's admin values, the languages, the schema's collections and their admin values
 * flattened to places, the assistant's pending proposals over them, and my changes on top. The four tabs read and change this one draft, so the
 * changes are counted, undone and saved together. It says what the draft makes (`build`), what is wrong with it (`schema.check`) and the lines of the
 * changes list.
 */
export function useSettingsDraft() {
	const { t } = useAdmin();
	const read = useRead<SettingsRead>("settings.read", {}, { afterWrites: true });
	// The editor tab lists every block of the site, whatever a collection allows.
	const catalog = useRead<Catalog>("blocks.catalog", {});
	const data = read.data;
	const base = useMemo(() => (data ? flatten(data, catalog.data) : null), [data, catalog.data]);
	// The draft's base is the site's values, the schema and every collection's admin values: its version names each of theirs.
	const version = data
		? [
				data.version,
				`site:${data.site.version}`,
				...Object.entries(data.adminValues)
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([c, values]) => `${c}:${values.version}`),
			].join(" ")
		: null;
	const proposalValues = useCallback((item: ProposalItem) => (data ? proposalPlaces(data, item) : {}), [data]);
	const draft = useDraft({ target: TARGET, also: SCHEMA, base, version, proposalValues });

	const changed = useMemo(() => draft.changes.map((change) => change.path), [draft.changes]);
	/** The places the pending proposals write, so a proposed new field or collection is listed too. */
	const proposed = useMemo(() => draft.proposals.flatMap(({ values }) => Object.keys(values)), [draft.proposals]);
	const listed = useMemo(() => [...changed, ...proposed], [changed, proposed]);

	/** What a place shows: a pending proposal's value, else mine over saved. */
	const shown = useCallback(
		(path: Path) => {
			const cell = draft.cell(path);
			return cell.kind === "proposed" ? cell.value : draft.value(path);
		},
		[draft],
	);

	const built = useMemo(
		() => (data ? build(data, changed, draft.value, catalog.data) : null),
		[data, changed, draft.value, catalog.data],
	);
	const structureChanged = Boolean(data && built && (built.renames.length > 0 || !sameJson(built.schema, data.schema)));
	const check = useRead<SchemaProblem[]>("schema.check", { draft: built?.schema }, { skip: !built });
	const problems = structureChanged ? (check.data ?? []).filter(ofCollection) : [];

	const label = useCallback((c: string) => String(draft.value(at.collectionValue(c, "label")) ?? "") || c, [draft]);
	const fieldName = useCallback(
		(c: string, key: string) => {
			const field = (shown(at.field(c, key)) ?? draft.value(at.field(c, key))) as DraftField | null | undefined;
			return field?.name ?? key;
		},
		[shown, draft],
	);
	const fieldLabel = useCallback(
		(c: string, key: string) => String(shown(at.fieldValue(c, key, "label")) ?? "") || fieldName(c, key),
		[shown, fieldName],
	);

	const rows = useMemo<ChangeRow[]>(() => {
		if (!data) return [];
		const out = new Map<string, ChangeRow>();
		const add = (id: string, row: Omit<ChangeRow, "id" | "paths">, path: Path) => {
			const found = out.get(id);
			if (found) found.paths.push(path);
			else out.set(id, { id, ...row, paths: [path] });
		};
		const languages = localeRows(data, changed, draft.value);
		for (const path of changed) {
			const siteValue = SITE_VALUE[path];
			if (siteValue) {
				add(path, { tab: "site", name: t(siteValue), tag: t("changes.changed"), tone: "warning" }, path);
				continue;
			}
			if (path === at.localeOrder) {
				// Only a real change of order is a line: taking back a language that was moved leaves its code in the order, with nothing to show.
				if (orderChanged(data, languages))
					add(
						path,
						{ tab: "languages", name: t("settings.locales.order"), tag: t("changes.changed"), tone: "warning" },
						path,
					);
				continue;
			}
			if (path === at.localeSource) {
				const name = languages.find((row) => row.source)?.name ?? String(draft.value(path));
				add(path, { tab: "languages", name, tag: t("changes.source"), tone: "warning" }, path);
				continue;
			}
			if (path.startsWith("locale:")) {
				const row = languages.find((each) => each.code === path.slice(7));
				if (row)
					add(
						path,
						row.state === "gone"
							? { tab: "languages", name: row.name, tag: t("changes.removed"), tone: "danger" }
							: { tab: "languages", name: row.name, tag: t("changes.new"), tone: "success" },
						path,
					);
				continue;
			}
			const place = placeOf(path);
			if (!place) continue;
			const c = place.collection;
			const name = label(c);
			if (!data.schema.collections[c]) {
				add(`new:${c}`, { tab: "collections", collection: c, name, tag: t("changes.new"), tone: "success" }, path);
				continue;
			}
			if (place.kind === "collection")
				add(
					`drop:${c}`,
					{ tab: "collections", collection: c, name, tag: t("changes.dropCollection"), tone: "danger" },
					path,
				);
			else if (place.kind === "path")
				add(`path:${c}`, { tab: "collections", collection: c, name, tag: t("changes.path"), tone: "warning" }, path);
			else if (place.kind === "field" || place.kind === "fieldValue") {
				const saved = data.schema.collections[c]?.fields[place.key];
				const field = draft.value(at.field(c, place.key)) as DraftField | null | undefined;
				const tag = !saved
					? { tag: t("changes.new"), tone: "success" as const }
					: field === null
						? { tag: t("changes.removed"), tone: "danger" as const }
						: field && field.name !== place.key
							? { tag: t("changes.renamed"), tone: "warning" as const }
							: { tag: t("changes.changed"), tone: "warning" as const };
				add(
					`field:${c}:${place.key}`,
					{ tab: "collections", collection: c, name: fieldLabel(c, place.key), ...tag },
					path,
				);
			} else if (place.kind === "collectionValue")
				add(
					`${path}`,
					{
						tab: "collections",
						collection: c,
						name: `${name} · ${t(COLLECTION_VALUE[place.value])}`,
						tag: t("changes.changed"),
						tone: "warning",
					},
					path,
				);
			else {
				const item =
					place.what === "heading"
						? `H${place.name}`
						: (() => {
								const list = place.what === "block" ? catalog.data?.blocks : catalog.data?.marks;
								const found = list?.find((each) => each.type === place.name);
								return found ? t(typeof found.label === "string" ? found.label : found.label.key) : place.name;
							})();
				add(path, { tab: "collections", collection: c, name: item, tag: t("changes.changed"), tone: "warning" }, path);
			}
		}
		return [...out.values()];
	}, [data, changed, draft, label, fieldLabel, catalog.data, t]);

	/** The languages as the draft and the pending proposals have them: the language tab's rows. */
	const locales = useMemo(() => (data ? localeRows(data, listed, shown) : []), [data, listed, shown]);

	/** Takes back the change of one language (added or taken out); an order that only it had changed goes back with it. */
	const revertLocale = useCallback(
		(code: string) => {
			draft.revert(at.locale(code));
			if (!data || !changed.includes(at.localeOrder)) return;
			const rest = localeRows(
				data,
				changed.filter((path) => path !== at.locale(code)),
				(path) => (path === at.locale(code) ? flatten(data, null)[path] : draft.value(path)),
			);
			if (!orderChanged(data, rest)) draft.revert(at.localeOrder);
		},
		[draft, data, changed],
	);

	/** Puts the languages that are not the source in a new order. The order they were saved in is no change. */
	const setLocaleOrder = useCallback(
		(codes: string[]) => {
			if (!data) return;
			const source = String(draft.value(at.localeSource) ?? data.schema.locales.source);
			const saved = data.schema.locales.list.map((locale) => locale.code).filter((code) => code !== source);
			const kept = (list: string[], other: string[]) => list.filter((code) => other.includes(code));
			if (sameJson(kept(codes, saved), kept(saved, codes))) draft.revert(at.localeOrder);
			else draft.set(at.localeOrder, [source, ...codes]);
		},
		[draft, data],
	);

	/** The tabs that hold something unsaved or proposed: the dot on a tab that is not open (doc 05). */
	const marks = useMemo(() => {
		const out: Partial<Record<"site" | "languages" | "collections", "warning" | "proposal">> = {};
		for (const path of proposed) if (draft.cell(path).kind === "proposed") out[tabOf(path)] = "proposal";
		for (const row of rows) out[row.tab] = "warning";
		return out;
	}, [proposed, rows, draft]);

	/** The collections' admin values the draft changed, whole, under the fields' names now: what the save sends beside the structure. */
	const changedValues = useMemo(() => {
		const out: Record<string, AdminValues> = {};
		if (!data || !built) return out;
		const touched = new Set(changed.flatMap((path) => placeOf(path)?.collection ?? []));
		for (const [c, values] of Object.entries(built.adminValues)) {
			if (!touched.has(c)) continue;
			if (data.schema.collections[c] && sameJson(values, savedValues(data, c))) continue;
			out[c] = values;
		}
		return out;
	}, [data, built, changed]);

	return {
		read,
		data,
		locked: data?.locked ?? true,
		locales,
		revertLocale,
		setLocaleOrder,
		marks,
		changedValues,
		catalog: catalog.data,
		draft,
		changed,
		listed,
		shown,
		built,
		structureChanged,
		problems,
		rows,
		label,
		fieldName,
		fieldLabel,
		collections: data ? collectionKeys(data, listed) : [],
		fields: (c: string) => (data ? fieldKeys(data, listed, c) : []),
	};
}

export type SettingsDraft = ReturnType<typeof useSettingsDraft>;

/** Whether the languages both the saved list and the draft have stand in another order (the source apart: it is always first). */
function orderChanged(data: SettingsRead, rows: LocaleRow[]) {
	const saved = data.schema.locales.list.map((locale) => locale.code);
	const now = rows.filter((row) => !row.source).map((row) => row.code);
	const kept = (codes: string[], other: string[]) => codes.filter((code) => other.includes(code));
	const before = saved.filter((code) => !rows.some((row) => row.source && row.code === code));
	return !sameJson(kept(now, before), kept(before, now));
}
