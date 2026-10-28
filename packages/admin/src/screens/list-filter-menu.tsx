"use client";

import { type FieldCondition, type TranslationFilter, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Calendar,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
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
	DropdownMenuTrigger,
	FilterButton,
	MenuShortcut,
	MenuTick,
} from "@monti-cms/ui";
import { Fragment, useState } from "react";
import { adminCalendarLocale } from "../ui/calendar-locale";
import { useRelationSearch } from "./entries/use-relation-search";
import { DATE_PRESETS, type DateFilter } from "./list-dates";
import { type FilterField, hasCondition, toggleCondition } from "./list-filter-fields";
import { type FilterRow, filterRowsOf, rowMatches } from "./list-filter-model";
import type { ListState } from "./list-state";
import { screensMessages } from "./messages";
import { dateToDay, dayToDate } from "./shared/date-range-picker";
import { useListCounts } from "./use-list-counts";

type Change = (patch: Partial<ListState>) => void;

/** The text of a condition's row, by the kind of field it is on. */
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

/** The values of a select or a relation (`README.md` of the design system: "none" first, then what the field has). */
function FieldValues({ field, state, onChange }: { field: FilterField; state: ListState; onChange: Change }) {
	const t = useTranslator(screensMessages);
	const counts = useListCounts(state, { field: field.name }, field.kind !== "relation");
	if (field.kind === "relation") return <RelationValues field={field} state={state} onChange={onChange} />;
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
			{field.kind === "select" && (
				<>
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
			)}
		</>
	);
}

/** The texts and images of "Blank", each ticked to keep the rows where it is empty. Several are OR, like the values of one field. */
function BlankValues({
	fields,
	state,
	onChange,
}: {
	fields: readonly FilterField[];
	state: ListState;
	onChange: Change;
}) {
	return (
		<>
			{fields.map((field) => (
				<ValueRow
					key={field.name}
					checked={hasCondition(state.fields[field.name], { kind: "empty" })}
					onToggle={() => onChange(withCondition(state, field.name, { kind: "empty" }))}
					count={undefined}
				>
					{field.label}
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

type DateKey = "updated" | "published";

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

/** Updated date, and (for a document collection) published date: each a preset or a period. */
function DateValues({
	state,
	onChange,
	onApplyRange,
}: {
	state: ListState;
	onChange: Change;
	onApplyRange: (key: DateKey, from: string, to: string) => void;
}) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const keys: DateKey[] = site.isDocumentCollection(state.collection) ? ["updated", "published"] : ["updated"];
	return (
		<>
			{keys.map((key, index) => (
				<Fragment key={key}>
					{index > 0 && <DropdownMenuSeparator />}
					<DropdownMenuGroup>
						<DropdownMenuLabel>{t(`listMenu.${key}`)}</DropdownMenuLabel>
						<DropdownMenuRadioGroup
							value={dateValue(state[key])}
							onValueChange={(value) => {
								const preset = DATE_PRESETS.find((candidate) => candidate === value);
								if (preset) onChange({ [key]: { kind: "preset", preset } });
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
								{state[key]?.kind === "range" && <MenuTick />}
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent side="left" bare>
								<RangeCalendar filter={state[key]} onApply={(from, to) => onApplyRange(key, from, to)} />
							</DropdownMenuSubContent>
						</DropdownMenuSub>
					</DropdownMenuGroup>
				</Fragment>
			))}
		</>
	);
}

/** One row of the first level, with the values it opens at the side. */
function Row({
	row,
	state,
	onChange,
	onApplyRange,
}: {
	row: FilterRow;
	state: ListState;
	onChange: Change;
	onApplyRange: (key: DateKey, from: string, to: string) => void;
}) {
	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>{row.label}</DropdownMenuSubTrigger>
			<DropdownMenuSubContent side="left">
				{row.kind === "locale" && <LocaleValues state={state} onChange={onChange} />}
				{row.kind === "translation" && <TranslationValues state={state} onChange={onChange} />}
				{row.kind === "date" && <DateValues state={state} onChange={onChange} onApplyRange={onApplyRange} />}
				{row.kind === "field" && <FieldValues field={row.field} state={state} onChange={onChange} />}
				{row.kind === "blank" && <BlankValues fields={row.fields} state={state} onChange={onChange} />}
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}

/**
 * The "Filter" menu of a list: a search row, then only the names of what can be filtered (language, translation and date; the fields with values to pick;
 * "Blank" for the texts and images), each opening its values at the side. Several values of one field can be on at once (they are OR); different fields narrow each other (AND). Picking a
 * value leaves the menu open, so several filters are set in one go; Escape or a click outside closes it.
 */
export function ListFilterMenu({ state, onChange }: { state: ListState; onChange: Change }) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const [text, setText] = useState("");
	const { top, fields, blank } = filterRowsOf(site, state.collection);
	// The groups that have a row matching the search, with a rule between them.
	const groups = [top, fields, blank]
		.map((rows) => rows.filter((row) => rowMatches(row, text)))
		.filter((rows) => rows.length > 0);
	const rowKey = (row: FilterRow) => (row.kind === "field" ? `field:${row.field.name}` : row.kind);
	const pick = {
		state,
		onChange,
		onApplyRange: (key: DateKey, from: string, to: string) => onChange({ [key]: { kind: "range", from, to } }),
	};
	return (
		<DropdownMenu
			onOpenChange={(next) => {
				if (next) setText("");
			}}
		>
			<DropdownMenuTrigger render={<FilterButton />}>{t("listMenu.filter")}</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuSearch label={t("listMenu.filterSearch")} value={text} onValueChange={setText} />
				{groups.map((rows, index) => (
					<Fragment key={rowKey(rows[0] as FilterRow)}>
						{index > 0 && <DropdownMenuSeparator />}
						{rows.map((row) => (
							<Row key={rowKey(row)} row={row} {...pick} />
						))}
					</Fragment>
				))}
				{groups.length === 0 && <DropdownMenuItem disabled>{t("listMenu.noMatch")}</DropdownMenuItem>}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
