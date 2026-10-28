"use client";

import type { Site } from "@monti-cms/core/site";
import { useSite } from "@monti-cms/core/site";

import { Text } from "@monti-cms/ui";
import type { ComponentType } from "react";
import type { AdminComponents, ListCellProps } from "../admin-components";
import { fieldColumnOf } from "./list-columns";

const EMPTY = <Text tone="muted">—</Text>;

/**
 * Finds a column's cell component in the admin extension (`listCells`). The column name comes first, otherwise the field's `input` name.
 * `undefined` if none (the default cell is drawn).
 */
export function customListCell(
	site: Site,
	listCells: AdminComponents["listCells"],
	collection: string,
	column: string,
): ComponentType<ListCellProps> | undefined {
	if (!listCells) return undefined;
	if (Object.hasOwn(listCells, column)) return listCells[column];
	const input = fieldColumnOf(site, collection, column)?.field.input;
	return input !== undefined && Object.hasOwn(listCells, input) ? listCells[input] : undefined;
}

/**
 * What a field column says of a row, as one line of text: a relation's items' names ("React · Next"), a select's option label, a text or media's stored
 * text. `undefined` where there is no value. A cell that is cut to its column ends in "…", and this is the text its `title` gives whole.
 */
export function fieldCellText(
	site: Site,
	collection: string,
	column: string,
	entry: ListCellProps["entry"],
): string | undefined {
	const stored = fieldColumnOf(site, collection, column);
	if (!stored) return undefined;
	const { field } = stored;
	if (field.kind === "relation") {
		const names = (entry.relations[column] ?? []).flatMap(({ title }) => (title ? [title] : []));
		return names.length > 0 ? names.join(" · ") : undefined;
	}
	const value = entry.values[column];
	if (!value) return undefined;
	if (field.kind === "select") return Object.hasOwn(field.options, value) ? String(field.options[value]) : value;
	return value;
}

/**
 * Default cell of a field column: the text of {@link fieldCellText}, in the mono caption for a media value. `—` when there is no value. Dates are drawn
 * separately by the system columns (updated, created, published).
 */
export function DefaultFieldCell({ collection, column, entry }: ListCellProps) {
	const site = useSite();
	const text = fieldCellText(site, collection, column, entry);
	if (text === undefined) return EMPTY;
	if (fieldColumnOf(site, collection, column)?.field.kind === "media")
		return (
			<Text variant="caption" tone="muted" mono>
				{text}
			</Text>
		);
	return text;
}
