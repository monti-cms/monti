"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { useQuery } from "@tanstack/react-query";
import { cmsFetch } from "../admin-api.js";
import { screensMessages } from "../messages.js";
import { formatDateOnly } from "../shared/format-date.js";
import { sharedMessages } from "../shared/messages.js";
import { schemaMessages } from "./messages.js";
import { fieldsOf, optionsOf, titleFieldName } from "./schema-model.js";
/** The columns the list shows when the collection does not choose its own. */
const USUAL_COLUMNS = ["title", "status", "updatedAt"];
const SAMPLE_ROWS = 3;
/** Rows to draw before the writer has entries (or before the collection is saved): each field gets a value that fits its kind. */
function sampleRows(collection) {
    const fields = fieldsOf(collection);
    const titleName = titleFieldName(collection);
    const now = new Date();
    return Array.from({ length: SAMPLE_ROWS }, (_, index) => {
        const values = {};
        const relations = {};
        for (const [name, field] of Object.entries(fields)) {
            if (field.kind === "text")
                values[name] = `${typeof field.label === "string" ? field.label : name} ${index + 1}`;
            else if (field.kind === "select")
                values[name] = Object.keys(optionsOf(field))[0] ?? "";
            else if (field.kind === "relation")
                relations[name] = [{ id: `r${index}`, title: `${name} ${index + 1}` }];
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
        };
    });
}
/**
 * The entry list as the choice of columns would show it: the latest entries of the collection when it has some, else sample rows. Only the header and the cells
 * are drawn (no sorting, filters or paging), enough to see which columns appear and in what order.
 */
export function ListPreview({ name, collection, columns, saved, }) {
    const site = useSite();
    const t = useTranslator(schemaMessages);
    const screens = useTranslator(screensMessages);
    const shared = useTranslator(sharedMessages);
    const query = useQuery({
        queryKey: ["cms", "schema", "list-preview", name],
        queryFn: ({ signal }) => cmsFetch(site, cmsApiUrl(`/v1/entries?${new URLSearchParams({ collection: name, sortField: "updatedAt", sortDirection: "desc", page: "1", pageSize: "25" })}`), { signal }),
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
    const SYSTEM = ["status", "locale", "updatedAt", "publishedAt", "createdAt", "slug", "folder"];
    const header = (column) => {
        const field = fields[column];
        if (field)
            return typeof field.label === "string" && field.label !== "" ? field.label : column;
        if (column === "title")
            return screens("column.title");
        return SYSTEM.includes(column)
            ? screens(`column.${column}`)
            : column;
    };
    const cell = (row, column) => {
        if (column === "title" || column === titleName)
            return row.title ?? "";
        if (column === "slug" || fields[column]?.kind === "slug")
            return row.slug ?? "";
        if (column === "status")
            return shared(row.status === "published" ? "status.published" : "status.draft");
        if (column === "locale")
            return row.locale;
        if (column === "folder")
            return row.folderId ? "—" : "";
        if (column === "updatedAt" || column === "createdAt" || column === "publishedAt") {
            const value = row[column];
            return value ? formatDateOnly(site, value) : "—";
        }
        const field = fields[column];
        if (field?.kind === "relation")
            return (row.relations[column] ?? []).map((item) => item.title ?? "").join(", ");
        const value = row.values[column] ?? "";
        return field?.kind === "select" ? (optionsOf(field)[value] ?? value) : value;
    };
    return (_jsxs("div", { className: "flex flex-col gap-1.5", "data-testid": "list-preview", children: [_jsx("h4", { className: "font-medium text-sm", children: t("list.preview") }), _jsx("p", { className: "text-cms-muted-foreground text-xs", children: useReal ? t("list.previewReal") : t("list.previewSample") }), shown.length === 0 ? (_jsx("p", { className: "rounded-md border border-dashed p-3 text-cms-muted-foreground text-xs", children: t("list.previewNone") })) : (_jsx("div", { className: "overflow-x-auto rounded-md border", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { className: "bg-cms-muted/40 text-xs", children: _jsx("tr", { children: shown.map((column) => (_jsx("th", { scope: "col", className: "px-3 py-1.5 font-medium", children: header(column) }, column))) }) }), _jsx("tbody", { children: rows.map((row, index) => (_jsx("tr", { className: "border-t", children: shown.map((column) => (_jsx("td", { className: "max-w-48 truncate px-3 py-1.5", children: cell(row, column) || _jsx("span", { className: "text-cms-muted-foreground", children: "\u2014" }) }, column))) }, `${row.slug ?? ""}-${index}`))) })] }) }))] }));
}
