"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useSite } from "@monti-cms/core/client";
import { fieldColumnOf } from "./list-columns.js";
import { FittingTags } from "./shared/fitting-tags.js";
const EMPTY = _jsx("span", { className: "text-cms-muted-foreground", children: "\u2014" });
/**
 * Finds a column's cell component in the admin extension (`listCells`). The column name comes first, otherwise the field's `input` name.
 * `undefined` if none (the default cell is drawn).
 */
export function customListCell(site, listCells, collection, column) {
    if (!listCells)
        return undefined;
    if (Object.hasOwn(listCells, column))
        return listCells[column];
    const input = fieldColumnOf(site, collection, column)?.field.input;
    return input !== undefined && Object.hasOwn(listCells, input) ? listCells[input] : undefined;
}
/**
 * Default cell of a field column. Relations show names (chips if several), select shows the option label, text and media show the stored text.
 * `—` when there is no value. Dates are drawn separately by the system columns (updated, created, published).
 */
export function DefaultFieldCell({ collection, column, entry }) {
    const site = useSite();
    const stored = fieldColumnOf(site, collection, column);
    if (!stored)
        return EMPTY;
    const { field } = stored;
    if (field.kind === "relation") {
        const values = (entry.relations[column] ?? []).flatMap(({ id, title }) => (title ? [{ id, title }] : []));
        if (!values.length)
            return EMPTY;
        return field.many ? _jsx(FittingTags, { tags: values }) : values[0]?.title;
    }
    const value = entry.values[column];
    if (!value)
        return EMPTY;
    if (field.kind === "select")
        return Object.hasOwn(field.options, value) ? field.options[value] : value;
    if (field.kind === "media")
        return _jsx("span", { className: "font-mono text-cms-muted-foreground text-xs", children: value });
    return value;
}
