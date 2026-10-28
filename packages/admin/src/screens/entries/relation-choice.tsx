"use client";

import type { BulkOp, ListEntriesItem } from "@monti-cms/core/site";
import { useTranslator } from "@monti-cms/core/site";
import {
	DropdownMenuCheckboxItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuScroll,
	DropdownMenuSearch,
	DropdownMenuSeparator,
	MenuShortcut,
} from "@monti-cms/ui";
import { useState } from "react";
import type { BulkParams, BulkSelection } from "../../api/entries";
import { bulkBarMessages } from "./bulk-bar.messages";
import { type ChangeableRelation, heldIds, holding, sharedValue, toSelection } from "./bulk-model";
import { useRelationSearch } from "./use-relation-search";

/** What a change of the picked rows' relation runs: the bulk request, labelled for the notification after it. */
export type RunBulk = (
	op: BulkOp,
	label: string,
	targets: BulkSelection[],
	params?: BulkParams,
) => Promise<void> | void;

/** The value of the "none" row of a single choice. An entry's id is never this. */
const NONE = "@none";

/**
 * The values of one relation field for the rows picked, as the rows of a menu (the bar's Change menu and the right-click menu of several rows both show it).
 *
 * A field that holds many is a list under a search row, each value a box: on when every picked row holds it, a bar (with how many) when some do, empty
 * when none. Pressing an empty or barred value adds it to all the picked rows, pressing a ticked one takes it off all of them, and the menu stays open
 * while the boxes follow the rows. A field that holds one is a single choice: ✓ on the value every row shares, "none" unless the field is required;
 * picking one sets it on all the picked rows and closes the menu. Nothing asks first: the change is undone in the same menu.
 */
export function RelationChoice({
	field,
	rows,
	onRun,
}: {
	field: ChangeableRelation;
	rows: readonly ListEntriesItem[];
	onRun: RunBulk;
}) {
	const t = useTranslator(bulkBarMessages);
	const [text, setText] = useState("");
	const held = heldIds(rows, field.name);
	const search = useRelationSearch({
		collection: field.to,
		publishedOnly: field.publishedOnly,
		limit: 50,
		selected: held,
	});
	const targets = rows.map(toSelection);
	// Before anything is typed what the rows hold comes first; a search shows what it found.
	const found = search.options ?? [];
	const entries =
		text.trim() === ""
			? [
					...held.flatMap((id) => {
						const entry = search.entryOf(id);
						return entry ? [entry] : [];
					}),
					...found.filter((entry) => !held.includes(entry.id)),
				]
			: found;
	const searchRow = (
		<DropdownMenuSearch
			label={t("search", { label: field.label })}
			value={text}
			onValueChange={(value) => {
				setText(value);
				search.search(value);
			}}
		/>
	);

	if (field.many) {
		return (
			<>
				{searchRow}
				<DropdownMenuScroll>
					{entries.map((entry) => {
						const { state, count } = holding(rows, field.name, entry.id);
						return (
							<DropdownMenuCheckboxItem
								key={entry.id}
								box
								checked={state === "all"}
								mixed={state === "some"}
								onCheckedChange={(on) =>
									void onRun(
										on ? "relation.add" : "relation.remove",
										t(on ? "relation.add" : "relation.remove", { label: field.label }),
										targets,
										{ field: field.name, ids: [entry.id] },
									)
								}
							>
								{entry.title}
								{state === "some" && (
									<MenuShortcut aria-label={t("holding", { count, total: rows.length })}>
										{count}/{rows.length}
									</MenuShortcut>
								)}
							</DropdownMenuCheckboxItem>
						);
					})}
				</DropdownMenuScroll>
			</>
		);
	}

	const shared = sharedValue(rows, field.name);
	const noneHeld = rows.every((row) => (row.relations[field.name] ?? []).length === 0);
	return (
		<>
			{searchRow}
			<DropdownMenuRadioGroup
				value={shared ?? (noneHeld ? NONE : "")}
				onValueChange={(value) =>
					void onRun("relation.set", t("relation.set", { label: field.label }), targets, {
						field: field.name,
						id: value === NONE ? null : value,
					})
				}
			>
				{!field.required && (
					<>
						<DropdownMenuRadioItem value={NONE}>{t("option.none")}</DropdownMenuRadioItem>
						{entries.length > 0 && <DropdownMenuSeparator />}
					</>
				)}
				<DropdownMenuScroll>
					{entries.map((entry) => (
						<DropdownMenuRadioItem key={entry.id} value={entry.id}>
							{entry.title}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuScroll>
			</DropdownMenuRadioGroup>
		</>
	);
}
