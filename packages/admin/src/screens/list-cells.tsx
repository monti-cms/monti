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
 * Default cell of a field column. Relations show their items' names in one line ("React · Next"), select shows the option label, text and media show
 * the stored text.
 * `—` when there is no value. Dates are drawn separately by the system columns (updated, created, published).
 */
export function DefaultFieldCell({ collection, column, entry }: ListCellProps) {
	const site = useSite();
	const stored = fieldColumnOf(site, collection, column);
	if (!stored) return EMPTY;
	const { field } = stored;
	if (field.kind === "relation") {
		const names = (entry.relations[column] ?? []).flatMap(({ title }) => (title ? [title] : []));
		return names.length > 0 ? names.join(" · ") : EMPTY;
	}
	const value = entry.values[column];
	if (!value) return EMPTY;
	if (field.kind === "select") return Object.hasOwn(field.options, value) ? field.options[value] : value;
	if (field.kind === "media")
		return (
			<Text variant="caption" tone="muted" mono>
				{value}
			</Text>
		);
	return value;
}
