"use client";

import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import type { ListEntriesItem } from "@monti-cms/core/runtime";
import { useQuery } from "@tanstack/react-query";
import { cmsFetch } from "../admin-api";
import { screensMessages } from "../messages";
import { formatDateOnly } from "../shared/format-date";
import { sharedMessages } from "../shared/messages";
import { schemaMessages } from "./messages";
import { fieldsOf, type Obj, optionsOf, titleFieldName } from "./schema-model";

/** The columns the list shows when the collection does not choose its own. */
const USUAL_COLUMNS = ["title", "status", "updatedAt"] as const;
const SAMPLE_ROWS = 3;

type Row = Pick<
	ListEntriesItem,
	| "title"
	| "slug"
	| "status"
	| "locale"
	| "values"
	| "relations"
	| "folderId"
	| "publishedAt"
	| "createdAt"
	| "updatedAt"
>;

/** Rows to draw before the writer has entries (or before the collection is saved): each field gets a value that fits its kind. */
function sampleRows(collection: Obj): Row[] {
	const fields = fieldsOf(collection);
	const titleName = titleFieldName(collection);
	const now = new Date();
	return Array.from({ length: SAMPLE_ROWS }, (_, index) => {
		const values: Record<string, string> = {};
		const relations: Record<string, { id: string; title: string | null }[]> = {};
		for (const [name, field] of Object.entries(fields)) {
			if (field.kind === "text") values[name] = `${typeof field.label === "string" ? field.label : name} ${index + 1}`;
			else if (field.kind === "select") values[name] = Object.keys(optionsOf(field))[0] ?? "";
			else if (field.kind === "relation") relations[name] = [{ id: `r${index}`, title: `${name} ${index + 1}` }];
		}
		return {
			title: titleName ? (values[titleName] ?? null) : null,
			slug: `sample-${index + 1}`,
			status: index === 0 ? "draft" : "published",
			locale: "en",
			values,
			relations,
			folderId: null,
			publishedAt: index === 0 ? null : now,
			createdAt: now,
			updatedAt: now,
		} as Row;
	});
}

/**
 * The entry list as the choice of columns would show it: the latest entries of the collection when it has some, else sample rows. Only the header and the cells
 * are drawn (no sorting, filters or paging), enough to see which columns appear and in what order.
 */
export function ListPreview({
	name,
	collection,
	columns,
	saved,
}: {
	name: string;
	collection: Obj;
	/** The columns being chosen; `undefined` for the usual ones. */
	columns: readonly string[] | undefined;
	/** Whether the collection is in the file on disk, so it can have entries. */
	saved: boolean;
}) {
	const site = useSite();
	const t = useTranslator(schemaMessages);
	const screens = useTranslator(screensMessages);
	const shared = useTranslator(sharedMessages);
	const query = useQuery({
		queryKey: ["cms", "schema", "list-preview", name],
		queryFn: ({ signal }) =>
			cmsFetch<{ items: Row[] }>(
				site,
				cmsApiUrl(
					`/v1/entries?${new URLSearchParams({ collection: name, sortField: "updatedAt", sortDirection: "desc", page: "1", pageSize: "25" })}`,
				),
				{ signal },
			),
		enabled: saved,
		staleTime: 30_000,
		retry: false,
	});
	const real = (query.data?.items ?? []).slice(0, 5);
	const useReal = real.length > 0;
	const rows = useReal ? real : sampleRows(collection);
	const shown = columns ?? USUAL_COLUMNS;
	const fields = fieldsOf(collection);
	const titleName = titleFieldName(collection);
	const SYSTEM = ["status", "locale", "updatedAt", "publishedAt", "createdAt", "slug", "folder"] as const;

	const header = (column: string): string => {
		const field = fields[column];
		if (field) return typeof field.label === "string" && field.label !== "" ? field.label : column;
		if (column === "title") return screens("column.title");
		return (SYSTEM as readonly string[]).includes(column)
			? screens(`column.${column as (typeof SYSTEM)[number]}`)
			: column;
	};
	const cell = (row: Row, column: string): string => {
		if (column === "title" || column === titleName) return row.title ?? "";
		if (column === "slug" || fields[column]?.kind === "slug") return row.slug ?? "";
		if (column === "status") return shared(row.status === "published" ? "status.published" : "status.draft");
		if (column === "locale") return row.locale;
		if (column === "folder") return row.folderId ? "—" : "";
		if (column === "updatedAt" || column === "createdAt" || column === "publishedAt") {
			const value = row[column];
			return value ? formatDateOnly(site, value) : "—";
		}
		const field = fields[column];
		if (field?.kind === "relation") return (row.relations[column] ?? []).map((item) => item.title ?? "").join(", ");
		const value = row.values[column] ?? "";
		return field?.kind === "select" ? (optionsOf(field)[value] ?? value) : value;
	};

	return (
		<div className="flex flex-col gap-1.5" data-testid="list-preview">
			<h4 className="font-medium text-sm">{t("list.preview")}</h4>
			<p className="text-cms-muted-foreground text-xs">{useReal ? t("list.previewReal") : t("list.previewSample")}</p>
			{shown.length === 0 ? (
				<p className="rounded-md border border-dashed p-3 text-cms-muted-foreground text-xs">{t("list.previewNone")}</p>
			) : (
				<div className="overflow-x-auto rounded-md border">
					<table className="w-full text-left text-sm">
						<thead className="bg-cms-muted/40 text-xs">
							<tr>
								{shown.map((column) => (
									<th key={column} scope="col" className="px-3 py-1.5 font-medium">
										{header(column)}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((row, index) => (
								<tr key={`${row.slug ?? ""}-${index}`} className="border-t">
									{shown.map((column) => (
										<td key={column} className="max-w-48 truncate px-3 py-1.5">
											{cell(row, column) || <span className="text-cms-muted-foreground">—</span>}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
