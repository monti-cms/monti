"use client";

import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
	IconButton,
	Inline,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	PageTabs,
	Stack,
	Tabs,
	TabsTrigger,
	Text,
	Toggle,
} from "@monti-cms/ui";
import { AlignLeft, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { commonMessages } from "../lib/common.messages";
import type { TranslatorFor } from "../translator";
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
		<Box width="panel">
			<InputGroup>
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
						>
							<AlignLeft aria-hidden />
							{t("toolbar.includeBodyShort")}
						</Toggle>
					</InputGroupAddon>
				)}
			</InputGroup>
		</Box>
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
		<Tabs
			value={active ?? ""}
			onValueChange={(key) => onChange({ statuses: key === "all" ? [] : [key as ListStatus], hasChanges: false })}
		>
			<PageTabs inset="none" aria-label={t("list.statusFilter")}>
				{segments.map(({ key, label }) => (
					<TabsTrigger key={key} value={key}>
						{label}
					</TabsTrigger>
				))}
			</PageTabs>
		</Tabs>
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
	const chipList =
		chips.length === 0 ? null : (
			<Inline as="ul" wrap gap="condensed" grow minWidth={0} paddingY="condensed" aria-label={t("toolbar.chips")}>
				{chips.map((chip) => (
					<Box as="li" key={chip.key}>
						<Inline as="span" gap="tight" background="selected" radius="sm" paddingX="condensed">
							<Box as="span" minWidth={0} maxWidth="panel-lg">
								<Text variant="caption" weight="medium" tone="default" truncate>
									{chip.label}
								</Text>
							</Box>
							<IconButton size="icon-xs" label={t("filter.clear")} onClick={() => onChange(chip.clear)}>
								<X aria-hidden />
							</IconButton>
						</Inline>
					</Box>
				))}
				{chips.length >= 2 && (
					<Box as="li">
						<Button type="button" variant="quiet" size="xs" onClick={() => onChange(clearFiltersPatch(state))}>
							{t("filter.clearAll")}
						</Button>
					</Box>
				)}
			</Inline>
		);
	if (hasSegments) {
		// The status tabs draw the line under the row; the chips, when there are any, get a row of their own below.
		return (
			<Stack gap="none" shrink={false}>
				<Inline align="stretch" gap="none">
					<Box grow minWidth={0}>
						<StatusSegments state={state} onChange={onChange} />
					</Box>
					{trailing && (
						<Inline gap="tight" border="bottom">
							{trailing}
						</Inline>
					)}
				</Inline>
				{chipList && <Inline border="bottom">{chipList}</Inline>}
			</Stack>
		);
	}
	return (
		<Inline align="stretch" gap="comfortable" shrink={false} border="bottom" paddingY="tight">
			{chipList ?? <Box grow />}
			{trailing && <Inline gap="tight">{trailing}</Inline>}
		</Inline>
	);
}
