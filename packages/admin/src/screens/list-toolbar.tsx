"use client";

import { createTranslator, isDocumentCollection, localeLabel } from "@monti-cms/core/client";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { IconButton } from "../ui/icon-button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { clearPatchFor } from "./column-header";
import { type ColumnFilter, columnLabel, columnsFor, filterFor, isColumnFiltered } from "./list-columns";
import { clearFilters, type ListState } from "./list-state";
import { screensMessages } from "./messages";
import { STATUS_LABELS } from "./shared/entry-status";
import type { TaxonomyOption, TaxonomyOptions } from "./shared/use-taxonomy";

const t = createTranslator(screensMessages);

export interface FilterChip {
	key: string;
	label: string;
	clear: Partial<ListState>;
}

const nameOf = (options: readonly TaxonomyOption[], id: string) =>
	options.find((option) => option.id === id)?.title ?? t("toolbar.unknown");

function describe(filter: ColumnFilter, state: ListState, options: TaxonomyOptions) {
	switch (filter.kind) {
		case "text":
			return `"${state[filter.key].trim()}"`;
		case "status":
			return [
				...state.statuses.map((status) => STATUS_LABELS[status]),
				...(state.hasChanges ? [t("filter.editing")] : []),
			].join(", ");
		case "relation":
			return (state.relations[filter.field] ?? []).map((id) => nameOf(options[filter.field] ?? [], id)).join(", ");
		case "locale":
			return state.locales.map((locale) => localeLabel(locale)).join(", ");
		case "date":
			return `${state[filter.from] || t("filter.rangeStart")} ~ ${state[filter.to] || t("filter.rangeEnd")}`;
		case "none":
			return "";
	}
}

/**
 * Applied filter chips. Even when a column is hidden, filters on it keep showing as chips
 * to prevent "why can't I see my posts?".
 */
export function filterChips(state: ListState, options: TaxonomyOptions): FilterChip[] {
	const chips: FilterChip[] = [];
	if (state.search.trim()) {
		chips.push({
			key: "search",
			label: `${state.includeBody ? t("toolbar.chipBodySearch") : t("toolbar.chipSearch")}: "${state.search.trim()}"`,
			clear: { search: "", includeBody: false },
		});
	}
	for (const column of columnsFor(state.collection).available) {
		const filter = filterFor(state.collection, column);
		if (!isColumnFiltered(state, filter)) continue;
		chips.push({
			key: column,
			label: `${columnLabel(state.collection, column)}: ${describe(filter, state, options)}`,
			clear: clearPatchFor(filter, state),
		});
	}
	return chips;
}

/** Search box in the header. Sends a server search when typing pauses. Posts and memos can turn on body search. */
export function ListSearch({
	state,
	onChange,
	allowBody = true,
}: {
	state: ListState;
	onChange: (patch: Partial<ListState>) => void;
	allowBody?: boolean;
}) {
	const [search, setSearch] = useState(state.search);
	useEffect(() => setSearch(state.search), [state.search]);
	useEffect(() => {
		if (search === state.search) return;
		const timer = setTimeout(() => onChange({ search }), 300);
		return () => clearTimeout(timer);
	}, [search, state.search, onChange]);

	const isContent = isDocumentCollection(state.collection);
	return (
		<div className="flex items-center gap-3">
			<InputGroup className="h-8 w-64">
				<InputGroupAddon>
					<Search aria-hidden />
				</InputGroupAddon>
				<InputGroupInput
					type="search"
					aria-label={t("toolbar.searchLabel")}
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder={state.includeBody ? t("toolbar.searchBodyPlaceholder") : t("toolbar.searchPlaceholder")}
				/>
			</InputGroup>
			{isContent && allowBody && (
				<Label className="font-normal text-cms-muted-foreground text-xs">
					<Switch
						size="sm"
						checked={state.includeBody}
						onCheckedChange={(checked) => onChange({ includeBody: checked === true })}
					/>
					{t("toolbar.includeBody")}
				</Label>
			)}
		</div>
	);
}

/** Row of applied filter chips. Not drawn when there are no filters. */
export function FilterChipBar({
	state,
	options,
	onChange,
}: {
	state: ListState;
	options: TaxonomyOptions;
	onChange: (patch: Partial<ListState>) => void;
}) {
	const chips = filterChips(state, options);
	if (chips.length === 0) return null;
	return (
		<ul aria-label={t("toolbar.chips")} className="flex min-h-11 flex-wrap items-center gap-1.5 border-b px-5 py-2">
			{chips.map((chip) => (
				<li key={chip.key}>
					<span className="inline-flex h-6 items-center gap-1 rounded-md bg-cms-primary/10 pr-0.5 pl-2 font-medium text-cms-primary text-xs">
						<span className="max-w-72 truncate">{chip.label}</span>
						<IconButton
							size="icon-xs"
							className="size-5 text-cms-primary hover:bg-cms-primary/15 hover:text-cms-primary"
							label={t("filter.clear")}
							onClick={() => onChange(chip.clear)}
						>
							<X aria-hidden />
						</IconButton>
					</span>
				</li>
			))}
			<li>
				<Button
					type="button"
					variant="ghost"
					size="xs"
					className="text-cms-muted-foreground"
					onClick={() => {
						const {
							collection: _c,
							folder: _f,
							includeDescendants: _d,
							pageSize: _p,
							...cleared
						} = clearFilters(state);
						onChange(cleared);
					}}
				>
					{t("filter.clearAll")}
				</Button>
			</li>
		</ul>
	);
}
