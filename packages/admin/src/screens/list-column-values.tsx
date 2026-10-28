"use client";

import { type FieldCondition, type TranslationFilter, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Calendar,
	DropdownMenuCheckboxItem,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuScroll,
	DropdownMenuSearch,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	MenuShortcut,
	MenuTick,
} from "@monti-cms/ui";
import { Fragment, useState } from "react";
import { adminCalendarLocale } from "../ui/calendar-locale";
import { useRelationSearch } from "./entries/use-relation-search";
import type { ColumnFilter, ColumnMenu, DateKey } from "./list-column-menu";
import { DATE_PRESETS, type DateFilter } from "./list-dates";
import { type FilterField, hasCondition, toggleCondition } from "./list-filter-fields";
import { LIST_STATUS_ORDER, type ListState } from "./list-state";
import { screensMessages } from "./messages";
import { dateToDay, dayToDate } from "./shared/date-range-picker";
import { statusLabels } from "./shared/entry-status";
import { useListCounts } from "./use-list-counts";

type Change = (patch: Partial<ListState>) => void;

/** A condition on a field, turned on or off in the state. A field with no condition left is left out. */
function withCondition(state: ListState, name: string, condition: FieldCondition): Partial<ListState> {
	const next = toggleCondition(state.fields[name], condition);
	const { [name]: _off, ...rest } = state.fields;
	return { fields: next.length > 0 ? { ...rest, [name]: next } : rest };
}

/** A row of values where several can be on: a box, the name, and how many rows have it. */
function ValueRow({
	checked,
	onToggle,
	count,
	children,
}: {
	checked: boolean;
	onToggle: () => void;
	count: number | undefined;
	children: React.ReactNode;
}) {
	return (
		<DropdownMenuCheckboxItem box checked={checked} onCheckedChange={onToggle}>
			{children}
			{count !== undefined && <MenuShortcut>{count}</MenuShortcut>}
		</DropdownMenuCheckboxItem>
	);
}

/** The values of a relation: the items found by the search row, each with its number, and "none" above them. */
function RelationValues({ field, state, onChange }: { field: FilterField; state: ListState; onChange: Change }) {
	const t = useTranslator(screensMessages);
	const [text, setText] = useState("");
	const conditions = state.fields[field.name];
	const picked = (conditions ?? []).flatMap((condition) => (condition.kind === "is" ? [condition.value] : []));
	const search = useRelationSearch({ collection: field.to ?? "", selected: picked, limit: 50 });
	const counts = useListCounts(state, { field: field.name });
	return (
		<>
			<DropdownMenuSearch
				label={t("listMenu.valueSearch", { label: field.label })}
				value={text}
				onValueChange={(value) => {
					setText(value);
					search.search(value);
				}}
			/>
			<ValueRow
				checked={hasCondition(conditions, { kind: "empty" })}
				onToggle={() => onChange(withCondition(state, field.name, { kind: "empty" }))}
				count={counts?.empty}
			>
				{t("listMenu.none")}
			</ValueRow>
			<DropdownMenuSeparator />
			<DropdownMenuScroll>
				{(search.options ?? []).map((option) => (
					<ValueRow
						key={option.id}
						checked={hasCondition(conditions, { kind: "is", value: option.id })}
						onToggle={() => onChange(withCondition(state, field.name, { kind: "is", value: option.id }))}
						count={counts ? (counts.values[option.id] ?? 0) : undefined}
					>
						{option.title}
					</ValueRow>
				))}
			</DropdownMenuScroll>
		</>
	);
}

/** The options of a select: "none" first, a rule, then what the field offers, each with its number. */
function SelectValues({ field, state, onChange }: { field: FilterField; state: ListState; onChange: Change }) {
	const t = useTranslator(screensMessages);
	const counts = useListCounts(state, { field: field.name });
	const conditions = state.fields[field.name];
	const toggle = (condition: FieldCondition) => onChange(withCondition(state, field.name, condition));
	return (
		<>
			<ValueRow
				checked={hasCondition(conditions, { kind: "empty" })}
				onToggle={() => toggle({ kind: "empty" })}
				count={counts?.empty}
			>
				{t("listMenu.none")}
			</ValueRow>
			<DropdownMenuSeparator />
			{field.options?.map((option) => (
				<ValueRow
					key={option.value}
					checked={hasCondition(conditions, { kind: "is", value: option.value })}
					onToggle={() => toggle({ kind: "is", value: option.value })}
					count={counts ? (counts.values[option.value] ?? 0) : undefined}
				>
					{option.label}
				</ValueRow>
			))}
		</>
	);
}

/** A text or an image: one row, ticked to keep the rows where it is empty. */
function EmptyValue({ field, state, onChange }: { field: FilterField; state: ListState; onChange: Change }) {
	const t = useTranslator(screensMessages);
	const counts = useListCounts(state, { field: field.name });
	return (
		<ValueRow
			checked={hasCondition(state.fields[field.name], { kind: "empty" })}
			onToggle={() => onChange(withCondition(state, field.name, { kind: "empty" }))}
			count={counts?.empty}
		>
			{t("listMenu.empty")}
		</ValueRow>
	);
}

/** The four states of an entry, each with how many rows are in it. Several are OR. */
function StatusValues({ state, onChange }: { state: ListState; onChange: Change }) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const counts = useListCounts(state, "status");
	const names = { ...statusLabels(site), editing: t("filter.editing") };
	return (
		<>
			{LIST_STATUS_ORDER.map((status) => (
				<ValueRow
					key={status}
					checked={state.statuses.includes(status)}
					onToggle={() =>
						onChange({
							statuses: state.statuses.includes(status)
								? state.statuses.filter((candidate) => candidate !== status)
								: [...state.statuses, status],
						})
					}
					count={counts?.values[status]}
				>
					{names[status]}
				</ValueRow>
			))}
		</>
	);
}

/** Where a translation group stands: none, behind its source, up to date. */
function TranslationValues({ state, onChange }: { state: ListState; onChange: Change }) {
	const t = useTranslator(screensMessages);
	const counts = useListCounts(state, "translation");
	const names: Record<TranslationFilter, string> = {
		none: t("listMenu.translationNone"),
		changed: t("listMenu.translationChanged"),
		current: t("listMenu.translationCurrent"),
	};
	return (
		<>
			{(["none", "changed", "current"] as const).map((value) => (
				<ValueRow
					key={value}
					checked={state.translations.includes(value)}
					onToggle={() =>
						onChange({
							translations: state.translations.includes(value)
								? state.translations.filter((candidate) => candidate !== value)
								: [...state.translations, value],
						})
					}
					count={counts?.values[value]}
				>
					{names[value]}
				</ValueRow>
			))}
		</>
	);
}

/** The languages of the site, each on or off. Several are OR. */
function LocaleValues({ state, onChange }: { state: ListState; onChange: Change }) {
	const site = useSite();
	return (
		<>
			{site.LOCALES.map((locale) => (
				<ValueRow
					key={locale}
					checked={state.locales.includes(locale)}
					onToggle={() =>
						onChange({
							locales: state.locales.includes(locale)
								? state.locales.filter((candidate) => candidate !== locale)
								: [...state.locales, locale],
						})
					}
					count={undefined}
				>
					{site.localeLabel(locale)}
				</ValueRow>
			))}
		</>
	);
}

/** The current choice of a date filter as the radio group says it: a preset, or nothing (a period is the "pick a period" row's own tick). */
const dateValue = (filter: DateFilter | null): string => (filter?.kind === "preset" ? filter.preset : "");

/**
 * The calendar the "pick a period" row opens in a card at the side of the date menu, which stays open behind it. The first day clicked starts the period and
 * the second ends it (the same day twice is one day); the second click applies the period, and the calendar stays open showing it.
 */
function RangeCalendar({
	filter,
	onApply,
}: {
	filter: DateFilter | null;
	onApply: (from: string, to: string) => void;
}) {
	const site = useSite();
	const [start, setStart] = useState<Date | null>(null);
	const range = filter?.kind === "range" ? { from: dayToDate(filter.from), to: dayToDate(filter.to) } : undefined;
	return (
		<Calendar
			mode="range"
			numberOfMonths={1}
			selected={start ? { from: start, to: start } : range}
			defaultMonth={range?.from}
			locale={adminCalendarLocale(site)}
			onDayClick={(day) => {
				if (!start) return setStart(day);
				const [from, to] = start <= day ? [start, day] : [day, start];
				setStart(null);
				onApply(dateToDay(from), dateToDay(to));
			}}
		/>
	);
}

/** One date of the list: a preset (today, the last 7 or 30 days) or a period picked on a calendar beside the menu. One at a time, the pick has the ✓. */
function DateValues({ dateKey, state, onChange }: { dateKey: DateKey; state: ListState; onChange: Change }) {
	const t = useTranslator(screensMessages);
	const filter = state[dateKey];
	return (
		<>
			<DropdownMenuRadioGroup
				value={dateValue(filter)}
				onValueChange={(value) => {
					const preset = DATE_PRESETS.find((candidate) => candidate === value);
					if (preset) onChange({ [dateKey]: { kind: "preset", preset } });
				}}
			>
				{DATE_PRESETS.map((preset) => (
					<DropdownMenuRadioItem key={preset} value={preset} closeOnClick={false}>
						{t(`listMenu.${preset}`)}
					</DropdownMenuRadioItem>
				))}
			</DropdownMenuRadioGroup>
			<DropdownMenuSub>
				<DropdownMenuSubTrigger chevron={false}>
					{t("listMenu.range")}
					{filter?.kind === "range" && <MenuTick />}
				</DropdownMenuSubTrigger>
				<DropdownMenuSubContent bare>
					<RangeCalendar filter={filter} onApply={(from, to) => onChange({ [dateKey]: { kind: "range", from, to } })} />
				</DropdownMenuSubContent>
			</DropdownMenuSub>
		</>
	);
}

/** The language, with the translation state of the group under its own name. */
function LanguageValues({
	translation,
	state,
	onChange,
}: {
	translation: boolean;
	state: ListState;
	onChange: Change;
}) {
	const t = useTranslator(screensMessages);
	return (
		<>
			<LocaleValues state={state} onChange={onChange} />
			{translation && (
				<>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuLabel>{t("listMenu.translation")}</DropdownMenuLabel>
						<TranslationValues state={state} onChange={onChange} />
					</DropdownMenuGroup>
				</>
			)}
		</>
	);
}

/** The values a column can be filtered by: the status, the language, a date, or what one stored field takes. */
function FilterValues({ filter, state, onChange }: { filter: ColumnFilter; state: ListState; onChange: Change }) {
	switch (filter.kind) {
		case "status":
			return <StatusValues state={state} onChange={onChange} />;
		case "language":
			return <LanguageValues translation={filter.translation} state={state} onChange={onChange} />;
		case "date":
			return <DateValues dateKey={filter.key} state={state} onChange={onChange} />;
		case "field":
			if (filter.field.kind === "relation")
				return <RelationValues field={filter.field} state={state} onChange={onChange} />;
			if (filter.field.kind === "select")
				return <SelectValues field={filter.field} state={state} onChange={onChange} />;
			return <EmptyValue field={filter.field} state={state} onChange={onChange} />;
	}
}

/** The sort of a column: its two orders as one pick, the current one with a ✓. Picking one applies it and closes the menu. */
function SortValues({
	sort,
	state,
	onChange,
}: {
	sort: NonNullable<ColumnMenu["sort"]>;
	state: ListState;
	onChange: Change;
}) {
	const t = useTranslator(screensMessages);
	const directions = sort.reads === "text" ? (["asc", "desc"] as const) : (["desc", "asc"] as const);
	return (
		<DropdownMenuRadioGroup
			value={state.sortField === sort.field ? state.sortDirection : ""}
			onValueChange={(value) => {
				const direction = directions.find((candidate) => candidate === value);
				if (direction) onChange({ sortField: sort.field, sortDirection: direction });
			}}
		>
			{directions.map((direction) => (
				<DropdownMenuRadioItem key={direction} value={direction}>
					{t(`sort.${sort.reads}.${direction}`)}
				</DropdownMenuRadioItem>
			))}
		</DropdownMenuRadioGroup>
	);
}

/**
 * The rows of a column's menu, top to bottom: sort, the values to filter by, hide the column. A section the column does not have is left out, and a rule
 * separates the ones that are there. Several values of one column are OR and different columns are AND; picking a value leaves the menu open, so several
 * are set in one go (Escape or a click outside closes it).
 */
export function ColumnMenuContent({
	menu,
	state,
	onChange,
	onHide,
}: {
	menu: ColumnMenu;
	state: ListState;
	onChange: Change;
	onHide: () => void;
}) {
	const t = useTranslator(screensMessages);
	const sections = [
		menu.sort && { key: "sort", node: <SortValues sort={menu.sort} state={state} onChange={onChange} /> },
		menu.filter && { key: "filter", node: <FilterValues filter={menu.filter} state={state} onChange={onChange} /> },
		menu.hide && { key: "hide", node: <DropdownMenuItem onClick={onHide}>{t("column.hide")}</DropdownMenuItem> },
	].filter((section) => section !== null && section !== undefined && section !== false);
	return sections.map((section, index) => (
		<Fragment key={section.key}>
			{index > 0 && <DropdownMenuSeparator />}
			{section.node}
		</Fragment>
	));
}
