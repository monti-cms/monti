"use client";

import type { Site } from "@monti-cms/core/client";
import { useSite } from "@monti-cms/core/client";

import type { ComponentType } from "react";
import type { CmsAdminComponents, ListCellProps } from "../admin-components";
import { fieldColumnOf } from "./list-columns";
import { FittingTags } from "./shared/fitting-tags";

const EMPTY = <span className="text-cms-muted-foreground">—</span>;

/**
 * Finds a column's cell component in the admin extension (`listCells`). The column name comes first, otherwise the field's `input` name.
 * `undefined` if none (the default cell is drawn).
 */
export function customListCell(
	site: Site,
	listCells: CmsAdminComponents["listCells"],
	collection: string,
	column: string,
): ComponentType<ListCellProps> | undefined {
	if (!listCells) return undefined;
	if (Object.hasOwn(listCells, column)) return listCells[column];
	const input = fieldColumnOf(site, collection, column)?.field.input;
	return input !== undefined && Object.hasOwn(listCells, input) ? listCells[input] : undefined;
}

/**
 * Default cell of a field column. Relations show names (chips if several), select shows the option label, text and media show the stored text.
 * `—` when there is no value. Dates are drawn separately by the system columns (updated, created, published).
 */
export function DefaultFieldCell({ collection, column, entry }: ListCellProps) {
	const site = useSite();
	const stored = fieldColumnOf(site, collection, column);
	if (!stored) return EMPTY;
	const { field } = stored;
	if (field.kind === "relation") {
		const values = (entry.relations[column] ?? []).flatMap(({ id, title }) => (title ? [{ id, title }] : []));
		if (!values.length) return EMPTY;
		return field.many ? <FittingTags tags={values} /> : values[0]?.title;
	}
	const value = entry.values[column];
	if (!value) return EMPTY;
	if (field.kind === "select") return Object.hasOwn(field.options, value) ? field.options[value] : value;
	if (field.kind === "media") return <span className="font-mono text-cms-muted-foreground text-xs">{value}</span>;
	return value;
}
