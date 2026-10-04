"use client";

import { createTranslator, LOCALES, localeLabel } from "@monti-cms/core/client";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, ListFilter } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils/cn";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Separator } from "../ui/separator";
import { type AdminListColumn, type ColumnFilter, columnConfig, isColumnFiltered } from "./list-columns";
import { LIST_STATUSES, type ListState } from "./list-state";
import { screensMessages } from "./messages";
import { DateRangeCalendar } from "./shared/date-range-picker";
import { STATUS_LABELS } from "./shared/entry-status";
import type { TaxonomyOption, TaxonomyOptions } from "./shared/use-taxonomy";

const t = createTranslator(screensMessages);

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
	const [draft, setDraft] = useState(value);
	useEffect(() => setDraft(value), [value]);
	return (
		<form
			className="flex gap-2"
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
				className="h-8"
			/>
			<Button type="submit" size="sm">
				{t("filter.apply")}
			</Button>
		</form>
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
		<Label className="flex items-center gap-2 rounded-sm px-2 py-1.5 font-normal hover:bg-cms-accent">
			<Checkbox checked={checked} onCheckedChange={(next) => onChange(next === true)} />
			{label}
		</Label>
	);
}

function StatusFilter({ state, onChange }: { state: ListState; onChange: (patch: Partial<ListState>) => void }) {
	const toggle = (status: (typeof LIST_STATUSES)[number], on: boolean) =>
		onChange({ statuses: on ? [...state.statuses, status] : state.statuses.filter((item) => item !== status) });
	return (
		<fieldset className="space-y-0.5">
			<legend className="sr-only">{t("column.status")}</legend>
			{LIST_STATUSES.map((status) => (
				<CheckRow
					key={status}
					label={STATUS_LABELS[status]}
					checked={state.statuses.includes(status)}
					onChange={(on) => toggle(status, on)}
				/>
			))}
			<Separator className="my-1" />
			<CheckRow
				label={t("filter.editing")}
				checked={state.hasChanges}
				onChange={(on) => onChange({ hasChanges: on })}
			/>
		</fieldset>
	);
}

/** 언어 체크 목록(v2 B4). 여러 개를 고르면 하나라도 맞는 항목을 보여 준다. */
function LocaleFilter({ state, onChange }: { state: ListState; onChange: (patch: Partial<ListState>) => void }) {
	return (
		<fieldset className="space-y-0.5">
			<legend className="sr-only">{t("column.locale")}</legend>
			{LOCALES.map((locale) => (
				<CheckRow
					key={locale}
					label={localeLabel(locale)}
					checked={state.locales.includes(locale)}
					onChange={(on) =>
						onChange({ locales: on ? [...state.locales, locale] : state.locales.filter((item) => item !== locale) })
					}
				/>
			))}
		</fieldset>
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
	const toggle = (id: string) =>
		onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
	return (
		<div className="space-y-2">
			<Command className="bg-transparent p-0">
				<CommandInput placeholder={t("filter.search", { label })} aria-label={t("filter.search", { label })} />
				<CommandList className="mt-1 max-h-56">
					<CommandEmpty>{t("filter.empty", { label })}</CommandEmpty>
					<CommandGroup className="space-y-0.5 p-0">
						{options.map((option) => (
							<CommandItem key={option.id} value={`${option.title} ${option.id}`} onSelect={() => toggle(option.id)}>
								<Checkbox
									checked={selected.includes(option.id)}
									tabIndex={-1}
									aria-hidden
									className="pointer-events-none"
								/>
								{option.title}
							</CommandItem>
						))}
					</CommandGroup>
				</CommandList>
			</Command>
			<div className="flex justify-between">
				<Button type="button" variant="ghost" size="sm" onClick={() => onChange(options.map((option) => option.id))}>
					{t("filter.selectAll")}
				</Button>
				<Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
					{t("filter.clearAll")}
				</Button>
			</div>
		</div>
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
	return (
		<div className="space-y-2">
			<p className="px-1 text-cms-muted-foreground text-xs">{label}</p>
			<DateRangeCalendar from={from} to={to} onChange={onChange} />
			<p className="px-1 text-xs" aria-live="polite">
				{from || to ? `${from || t("filter.rangeStart")} ~ ${to || t("filter.rangeEnd")}` : t("filter.noRange")}
			</p>
		</div>
	);
}

/** 분류 필터 하나를 바꾼 `relations`. 빈 목록은 지운다. */
export function setRelation(state: ListState, field: string, ids: readonly string[]): Partial<ListState> {
	const { [field]: _removed, ...rest } = state.relations;
	return { relations: ids.length > 0 ? { ...rest, [field]: ids } : rest };
}

const clearRelation = (state: ListState, field: string) => setRelation(state, field, []);

/** 이 필터를 지우는 변경. 칩의 `✕`와 팝업의 `필터 해제`가 쓴다. */
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
 * 엑셀처럼 컬럼 헤더에서 여는 정렬·필터 팝업(v2 A1). 필터가 걸린 헤더는 아이콘 모양이 바뀌어
 * 색만으로 상태를 전달하지 않는다. 정렬 가능한 컬럼은 `aria-sort`를 헤더 셀에 둔다(호출하는 쪽).
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
	const config = columnConfig(state.collection, column);
	const sortField = config.sortField;
	const filtered = isColumnFiltered(state, filter);
	const sorted = sortField && state.sortField === sortField ? state.sortDirection : null;
	if (!sortField && filter.kind === "none") return <span>{config.label}</span>;

	const sortButton = (direction: "asc" | "desc") => (
		<Button
			type="button"
			variant={sorted === direction ? "secondary" : "ghost"}
			size="sm"
			aria-pressed={sorted === direction}
			className="justify-start"
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
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className={cn(
							"-ml-2 h-7 gap-1 px-2 font-normal text-cms-muted-foreground text-xs",
							filtered && "text-cms-primary",
						)}
						aria-label={`${config.label}${sorted ? t("filter.sortedSuffix", { direction: sorted === "asc" ? t("filter.sortAsc") : t("filter.sortDesc") }) : ""}${filtered ? t("filter.filteredSuffix") : ""}`}
					/>
				}
			>
				{config.label}
				{sorted === "asc" && <ArrowUpNarrowWide aria-hidden className="size-3.5" />}
				{sorted === "desc" && <ArrowDownWideNarrow aria-hidden className="size-3.5" />}
				{filtered ? (
					<ListFilter aria-hidden className="size-3.5 fill-current" data-filtered="" />
				) : (
					<ChevronDown aria-hidden className="size-3.5 opacity-60" />
				)}
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72 space-y-3 p-3">
				{sortField && (
					<fieldset className="flex flex-col gap-1">
						<legend className="sr-only">{t("filter.sortLegend", { label: config.label })}</legend>
						{sortButton("asc")}
						{sortButton("desc")}
					</fieldset>
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
						variant="outline"
						size="sm"
						className="w-full"
						onClick={() => onChange(clearPatchFor(filter, state))}
					>
						{t("filter.clear")}
					</Button>
				)}
			</PopoverContent>
		</Popover>
	);
}
