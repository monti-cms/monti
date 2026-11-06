import { type SchemaProblem, sameJson } from "@monti-cms/core";
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
	placeOf,
	proposalPaths,
	type SchemaRead,
} from "./schema-draft";

const TARGET = { kind: "schema", id: "current" };

/** The words of a collection's own admin values, as the changes list names them. */
const COLLECTION_VALUE = {
	label: "settings.collection.label",
	folders: "settings.collection.folders",
	layout: "settings.collection.layout",
} as const;

/** One line of the changes list: a thing the person changed, with every place it holds, so its undo puts all of them back. */
export type ChangeRow = {
	id: string;
	collection: string;
	name: string;
	tag: string;
	tone: "warning" | "danger" | "success";
	paths: Path[];
};

/**
 * Settings › collections as one draft (doc 05): the schema and the collections' admin values flattened to places, the assistant's pending
 * `schema.apply` over them, and my changes on top. It says what the draft makes (`build`), what is wrong with it (`schema.check`) and the
 * lines of the changes list.
 */
export function useCollectionsDraft() {
	const { t } = useAdmin();
	const read = useRead<SchemaRead>("schema.read", {}, { afterWrites: true });
	// The editor tab lists every block of the site, whatever a collection allows.
	const catalog = useRead<Catalog>("blocks.catalog", {});
	const data = read.data;
	const base = useMemo(() => (data ? flatten(data, catalog.data) : null), [data, catalog.data]);
	// The draft's base is the schema and every collection's admin values: its version names each of theirs.
	const version = data
		? [
				data.version,
				...Object.entries(data.adminValues)
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([c, values]) => `${c}:${values.version}`),
			].join(" ")
		: null;
	const proposalValues = useCallback(
		(item: ProposalItem) =>
			data && item.operation === "schema.apply"
				? proposalPaths(data, item.input as Parameters<typeof proposalPaths>[1])
				: {},
		[data],
	);
	const draft = useDraft({ target: TARGET, base, version, proposalValues });

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
		for (const path of changed) {
			const place = placeOf(path);
			if (!place) continue;
			const c = place.collection;
			const name = label(c);
			if (!data.schema.collections[c]) {
				add(`new:${c}`, { collection: c, name, tag: t("changes.new"), tone: "success" }, path);
				continue;
			}
			if (place.kind === "collection")
				add(`drop:${c}`, { collection: c, name, tag: t("changes.dropCollection"), tone: "danger" }, path);
			else if (place.kind === "path")
				add(`path:${c}`, { collection: c, name, tag: t("changes.path"), tone: "warning" }, path);
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
				add(`field:${c}:${place.key}`, { collection: c, name: fieldLabel(c, place.key), ...tag }, path);
			} else if (place.kind === "collectionValue")
				add(
					`${path}`,
					{
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
				add(path, { collection: c, name: item, tag: t("changes.changed"), tone: "warning" }, path);
			}
		}
		return [...out.values()];
	}, [data, changed, draft, label, fieldLabel, catalog.data, t]);

	return {
		read,
		data,
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

export type CollectionsDraft = ReturnType<typeof useCollectionsDraft>;
