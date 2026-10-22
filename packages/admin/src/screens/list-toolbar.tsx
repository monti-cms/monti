"use client";

import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import { AlignLeft, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { commonMessages } from "../lib/common.messages";
import type { TranslatorFor } from "../translator";
import { Button } from "../ui/button";
import { IconButton } from "../ui/icon-button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { Toggle } from "../ui/toggle";
import { clearPatchFor } from "./column-header";
import { type ColumnFilter, columnLabel, columnsFor, filterFor, isColumnFiltered } from "./list-columns";
import { clearFiltersPatch, LIST_STATUSES, type ListState, type ListStatus } from "./list-state";
import { screensMessages } from "./messages";
import { statusLabels } from "./shared/entry-status";
import { useDebouncedInput } from "./shared/use-debounced";
import type { TaxonomyOption, TaxonomyOptions } from "./shared/use-taxonomy";

export interface FilterChip {
	key: string;
	label: string;
	clear: Partial<ListState>;
}

const nameOf = (t: TranslatorFor<typeof screensMessages>, options: readonly TaxonomyOption[], id: string) =>
	options.find((option) => option.id === id)?.title ?? t("toolbar.unknown");

function describe(site: Site, filter: ColumnFilter, state: ListState, options: TaxonomyOptions) {
	const t = site.createTranslator(screensMessages);
	switch (filter.kind) {
		case "text":
			return `"${state[filter.key].trim()}"`;
		case "status":
			return [
				...state.statuses.map((status) => statusLabels(site)[status]),
				...(state.hasChanges ? [t("filter.editing")] : []),
			].join(", ");
		case "relation":
			return (state.relations[filter.field] ?? []).map((id) => nameOf(t, options[filter.field] ?? [], id)).join(", ");
		case "locale":
			return state.locales.map((locale) => site.localeLabel(locale)).join(", ");
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
export function filterChips(site: Site, state: ListState, options: TaxonomyOptions): FilterChip[] {
	const t = site.createTranslator(screensMessages);
	const tc = site.createTranslator(commonMessages);
	const chips: FilterChip[] = [];
	if (state.search.trim()) {
		chips.push({
			key: "search",
			label: `${state.includeBody ? t("toolbar.chipBodySearch") : tc("search")}: "${state.search.trim()}"`,
			clear: { search: "", includeBody: false },
		});
	}
	for (const column of columnsFor(site, state.collection).available) {
		const filter = filterFor(site, state.collection, column);
		if (!isColumnFiltered(state, filter)) continue;
		chips.push({
			key: column,
			label: `${columnLabel(site, state.collection, column)}: ${describe(site, filter, state, options)}`,
			clear: clearPatchFor(filter, state),
		});
	}
	return chips;
}

/**
 * Search box in the header. Sends a server search when typing pauses. Document collections get a small toggle inside the box
 * that widens the search to the body.
 */
export function ListSearch({
	state,
	onChange,
	allowBody = true,
}: {
	state: ListState;
	onChange: (patch: Partial<ListState>) => void;
	allowBody?: boolean;
}) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const [search, setSearch] = useDebouncedInput(state.search, (text) => onChange({ search: text }));

	const withBody = site.isDocumentCollection(state.collection) && allowBody;
	return (
		<InputGroup className="h-[34px] w-64">
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
			{withBody && (
				<InputGroupAddon align="inline-end">
					<Toggle
						size="sm"
						aria-label={t("toolbar.includeBody")}
						title={t("toolbar.includeBody")}
						pressed={state.includeBody}
						onPressedChange={(pressed) => onChange({ includeBody: pressed })}
						className="h-6 min-w-6 gap-1 px-2 text-monti-caption text-monti-muted aria-pressed:bg-monti-selected aria-pressed:text-monti-default"
					>
						<AlignLeft aria-hidden />
						{t("toolbar.includeBodyShort")}
					</Toggle>
				</InputGroupAddon>
			)}
		</InputGroup>
	);
}

/** The status the segments show for this state, `"all"` for no status filter, or `null` for what only the column header can set. */
export function activeStatusSegment(state: Pick<ListState, "statuses" | "hasChanges">): ListStatus | "all" | null {
	if (state.hasChanges) return null;
	if (state.statuses.length === 0) return "all";
	return state.statuses.length === 1 ? (state.statuses[0] ?? null) : null;
}

/** All / Draft / Published / Archived as underline tabs. Picking one sets exactly that status; "All" clears the status filter. */
function StatusSegments({ state, onChange }: { state: ListState; onChange: (patch: Partial<ListState>) => void }) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const active = activeStatusSegment(state);
	const segments: { key: ListStatus | "all"; label: string }[] = [
		{ key: "all", label: t("list.statusAll") },
		...LIST_STATUSES.map((status) => ({ key: status, label: statusLabels(site)[status] })),
	];
	return (
		<fieldset className="-mb-px flex items-stretch gap-4">
			<legend className="sr-only">{t("list.statusFilter")}</legend>
			{segments.map(({ key, label }) => (
				<button
					key={key}
					type="button"
					aria-pressed={active === key}
					className="-mb-px border-transparent border-b-2 text-monti-body text-monti-muted outline-none transition-colors hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-focus-soft aria-pressed:border-monti-accent aria-pressed:font-medium aria-pressed:text-monti-default"
					onClick={() => onChange({ statuses: key === "all" ? [] : [key], hasChanges: false })}
				>
					{label}
				</button>
			))}
		</fieldset>
	);
}

/**
 * The one row under the header: status segments (list mode), the applied filter chips, and the screen's own controls on the right.
 * The status chip shows only when the status filter is something the segments cannot show.
 */
export function ListSubToolbar({
	state,
	options,
	mode,
	onChange,
	trailing,
}: {
	state: ListState;
	options: TaxonomyOptions;
	mode: "list" | "trash";
	onChange: (patch: Partial<ListState>) => void;
	trailing?: ReactNode;
}) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const hasSegments = mode === "list" && filterFor(site, state.collection, "status", mode).kind === "status";
	const chips = filterChips(site, state, options).filter(
		(chip) => !(hasSegments && chip.key === "status" && activeStatusSegment(state) !== null),
	);
	return (
		<div className="flex min-h-11 shrink-0 items-stretch gap-4 border-b px-8">
			{hasSegments && <StatusSegments state={state} onChange={onChange} />}
			{chips.length === 0 ? (
				<div className="flex-1" />
			) : (
				<ul aria-label={t("toolbar.chips")} className="flex min-w-0 flex-1 flex-wrap items-center gap-2 py-2">
					{chips.map((chip) => (
						<li key={chip.key}>
							<span className="inline-flex h-6 items-center gap-1 rounded-sm bg-monti-selected pr-0.5 pl-2 font-medium text-monti-caption text-monti-default">
								<span className="max-w-72 truncate">{chip.label}</span>
								<IconButton
									size="icon-xs"
									className="size-5 text-monti-default hover:bg-monti-divider hover:text-monti-default"
									label={t("filter.clear")}
									onClick={() => onChange(chip.clear)}
								>
									<X aria-hidden />
								</IconButton>
							</span>
						</li>
					))}
					{chips.length >= 2 && (
						<li>
							<Button
								type="button"
								variant="ghost"
								size="xs"
								className="text-monti-caption text-monti-muted"
								onClick={() => onChange(clearFiltersPatch(state))}
							>
								{t("filter.clearAll")}
							</Button>
						</li>
					)}
				</ul>
			)}
			{trailing && <div className="flex items-center">{trailing}</div>}
		</div>
	);
}
