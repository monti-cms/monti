"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
	Checkbox,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Inline,
	Input,
	Label,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Separator,
	Stack,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, ListFilter } from "lucide-react";
import { useEffect, useState } from "react";
import { commonMessages } from "../lib/common.messages";
import { type AdminListColumn, type ColumnFilter, columnConfig, isColumnFiltered } from "./list-columns";
import { LIST_STATUSES, type ListState } from "./list-state";
import { screensMessages } from "./messages";
import { DateRangeCalendar } from "./shared/date-range-picker";
import { statusLabels } from "./shared/entry-status";
import type { TaxonomyOption, TaxonomyOptions } from "./shared/use-taxonomy";

function TextFilter({
	value,
	placeholder,
	label,
	onApply,
}: {
	value: string;
	placeholder: string;
	label: string;
	onApply: (value: string) => void;
}) {
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
	const [draft, setDraft] = useState(value);
	useEffect(() => setDraft(value), [value]);
	return (
		<Inline
			as="form"
			gap={8}
			onSubmit={(event) => {
				event.preventDefault();
				onApply(draft);
			}}
		>
			<Input
				aria-label={t("filter.label", { label })}
				value={draft}
				placeholder={placeholder}
				onChange={(event) => setDraft(event.target.value)}
				size="sm"
			/>
			<Button type="submit" size="sm">
				{tc("apply")}
			</Button>
		</Inline>
	);
}

function CheckRow({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (next: boolean) => void;
}) {
	return (
		<Box radius="sm" padding={8} hover>
			<Label>
				<Checkbox checked={checked} onCheckedChange={(next) => onChange(next === true)} />
				{label}
			</Label>
		</Box>
	);
}

function StatusFilter({ state, onChange }: { state: ListState; onChange: (patch: Partial<ListState>) => void }) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const toggle = (status: (typeof LIST_STATUSES)[number], on: boolean) =>
		onChange({ statuses: on ? [...state.statuses, status] : state.statuses.filter((item) => item !== status) });
	return (
		<Stack gap={2} role="group" aria-label={t("column.status")}>
			{LIST_STATUSES.map((status) => (
				<CheckRow
					key={status}
					label={statusLabels(site)[status]}
					checked={state.statuses.includes(status)}
					onChange={(on) => toggle(status, on)}
				/>
			))}
			<Box paddingY={4}>
				<Separator />
			</Box>
			<CheckRow
				label={t("filter.editing")}
				checked={state.hasChanges}
				onChange={(on) => onChange({ hasChanges: on })}
			/>
		</Stack>
	);
}

/** Locale checklist. Choosing several shows items matching any of them. */
function LocaleFilter({ state, onChange }: { state: ListState; onChange: (patch: Partial<ListState>) => void }) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	return (
		<Stack gap={2} role="group" aria-label={t("column.locale")}>
			{site.LOCALES.map((locale) => (
				<CheckRow
					key={locale}
					label={site.localeLabel(locale)}
					checked={state.locales.includes(locale)}
					onChange={(on) =>
						onChange({ locales: on ? [...state.locales, locale] : state.locales.filter((item) => item !== locale) })
					}
				/>
			))}
		</Stack>
	);
}

function TaxonomyFilter({
	label,
	options,
	selected,
	onChange,
}: {
	label: string;
	options: readonly TaxonomyOption[];
	selected: readonly string[];
	onChange: (ids: string[]) => void;
}) {
	const t = useTranslator(screensMessages);
	const toggle = (id: string) =>
		onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
	return (
		<Stack gap={8}>
			<Command>
				<CommandInput placeholder={t("filter.search", { label })} aria-label={t("filter.search", { label })} />
				<CommandList>
					<CommandEmpty>{t("filter.empty", { label })}</CommandEmpty>
					<CommandGroup>
						{options.map((option) => (
							<CommandItem key={option.id} value={`${option.title} ${option.id}`} onSelect={() => toggle(option.id)}>
								<Checkbox checked={selected.includes(option.id)} tabIndex={-1} aria-hidden />
								{option.title}
							</CommandItem>
						))}
					</CommandGroup>
				</CommandList>
			</Command>
			<Inline justify="between">
				<TextButton type="button" onClick={() => onChange(options.map((option) => option.id))}>
					{t("filter.selectAll")}
				</TextButton>
				<TextButton type="button" onClick={() => onChange([])}>
					{t("filter.clearAll")}
				</TextButton>
			</Inline>
		</Stack>
	);
}

function DateFilter({
	label,
	from,
	to,
	onChange,
}: {
	label: string;
	from: string;
	to: string;
	onChange: (from: string, to: string) => void;
}) {
	const t = useTranslator(screensMessages);
	return (
		<Stack gap={8}>
			<Box paddingX={4}>
				<Text as="p" variant="caption" tone="muted">
					{label}
				</Text>
			</Box>
			<DateRangeCalendar from={from} to={to} onChange={onChange} />
			<Box paddingX={4}>
				<Text as="p" variant="caption" aria-live="polite">
					{from || to ? `${from || t("filter.rangeStart")} ~ ${to || t("filter.rangeEnd")}` : t("filter.noRange")}
				</Text>
			</Box>
		</Stack>
	);
}

/** `relations` with one taxonomy filter changed. An empty list is removed. */
export function setRelation(state: ListState, field: string, ids: readonly string[]): Partial<ListState> {
	const { [field]: _removed, ...rest } = state.relations;
	return { relations: ids.length > 0 ? { ...rest, [field]: ids } : rest };
}

const clearRelation = (state: ListState, field: string) => setRelation(state, field, []);

/** Change that clears this filter. Used by the chip's `✕` and the popup's "Clear filter". */
export function clearPatchFor(filter: ColumnFilter, state: ListState): Partial<ListState> {
	switch (filter.kind) {
		case "text":
			return { [filter.key]: "" };
		case "status":
			return { statuses: [], hasChanges: false };
		case "relation":
			return clearRelation(state, filter.field);
		case "locale":
			return { locales: [] };
		case "date":
			return { [filter.from]: "", [filter.to]: "" };
		case "none":
			return {};
	}
}

/**
 * Sort/filter popup opened from the column header, like Excel. A header with a filter changes its icon shape
 * so state is not conveyed by color alone. Sortable columns put `aria-sort` on the header cell (done by the caller).
 */
export function ColumnHeader({
	column,
	filter,
	state,
	options,
	onChange,
}: {
	column: AdminListColumn;
	filter: ColumnFilter;
	state: ListState;
	options: TaxonomyOptions;
	onChange: (patch: Partial<ListState>) => void;
}) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const config = columnConfig(site, state.collection, column);
	const sortField = config.sortField;
	const filtered = isColumnFiltered(state, filter);
	const sorted = sortField && state.sortField === sortField ? state.sortDirection : null;
	if (!sortField && filter.kind === "none") return <span>{config.label}</span>;

	const sortButton = (direction: "asc" | "desc") => (
		<Button
			type="button"
			variant={sorted === direction ? "primary" : "secondary"}
			size="sm"
			aria-pressed={sorted === direction}
			onClick={() => sortField && onChange({ sortField, sortDirection: direction })}
		>
			{direction === "asc" ? <ArrowUpNarrowWide /> : <ArrowDownWideNarrow />}
			{direction === "asc" ? t("filter.sortAsc") : t("filter.sortDesc")}
		</Button>
	);

	return (
		<Popover>
			<PopoverTrigger
				render={
					<TextButton
						variant={filtered ? "plain" : "quiet"}
						aria-label={`${config.label}${sorted ? t("filter.sortedSuffix", { direction: sorted === "asc" ? t("filter.sortAsc") : t("filter.sortDesc") }) : ""}${filtered ? t("filter.filteredSuffix") : ""}`}
					/>
				}
			>
				<Inline as="span" gap={4}>
					{config.label}
					{sorted === "asc" && <ArrowUpNarrowWide aria-hidden size={14} />}
					{sorted === "desc" && <ArrowDownWideNarrow aria-hidden size={14} />}
					{filtered ? <ListFilter aria-hidden size={14} data-filtered="" /> : <ChevronDown aria-hidden size={14} />}
				</Inline>
			</PopoverTrigger>
			<PopoverContent align="start" width="md">
				<Stack gap={12}>
					{sortField && (
						<Stack gap={4} role="group" aria-label={t("filter.sortLegend", { label: config.label })}>
							{sortButton("asc")}
							{sortButton("desc")}
						</Stack>
					)}
					{sortField && filter.kind !== "none" && <Separator />}
					{filter.kind === "text" && (
						<TextFilter
							value={state[filter.key]}
							placeholder={filter.placeholder}
							label={config.label}
							onApply={(value) => onChange({ [filter.key]: value })}
						/>
					)}
					{filter.kind === "status" && <StatusFilter state={state} onChange={onChange} />}
					{filter.kind === "locale" && <LocaleFilter state={state} onChange={onChange} />}
					{filter.kind === "relation" && (
						<TaxonomyFilter
							label={config.label}
							options={options[filter.field] ?? []}
							selected={state.relations[filter.field] ?? []}
							onChange={(ids) => onChange(setRelation(state, filter.field, ids))}
						/>
					)}
					{filter.kind === "date" && (
						<DateFilter
							label={config.label}
							from={state[filter.from]}
							to={state[filter.to]}
							onChange={(from, to) => onChange({ [filter.from]: from, [filter.to]: to })}
						/>
					)}
					{filtered && (
						<Button
							type="button"
							variant="secondary"
							size="sm"
							width="full"
							onClick={() => onChange(clearPatchFor(filter, state))}
						>
							{t("filter.clear")}
						</Button>
					)}
				</Stack>
			</PopoverContent>
		</Popover>
	);
}
