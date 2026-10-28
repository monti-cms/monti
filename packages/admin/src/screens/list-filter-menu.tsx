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
	Popover,
	PopoverContent,
} from "@monti-cms/ui";
import { Fragment, useRef, useState } from "react";
import type { TranslatorFor } from "../translator";
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
function conditionLabel(t: TranslatorFor<typeof screensMessages>, field: FilterField, kind: "empty" | "filled") {
	if (field.kind === "text") return kind === "empty" ? t("listMenu.textEmpty") : t("listMenu.textFilled");
	return kind === "empty" ? t("listMenu.none") : t("listMenu.has");
}

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
				{conditionLabel(t, field, "empty")}
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

/** The values a field of this kind takes (`README.md` of the design system: "none" first, then what the kind has). */
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
				{conditionLabel(t, field, "empty")}
			</ValueRow>
			{(field.kind === "text" || field.kind === "media") && (
				<ValueRow
					checked={hasCondition(conditions, { kind: "filled" })}
					onToggle={() => toggle({ kind: "filled" })}
					count={counts?.filled}
				>
					{conditionLabel(t, field, "filled")}
				</ValueRow>
			)}
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

/** The current choice of a date filter as the radio group says it: a preset, `range`, or nothing. */
const dateValue = (filter: DateFilter | null): string =>
	filter === null ? "" : filter.kind === "preset" ? filter.preset : "range";

/** Updated date, and (for a document collection) published date: each a preset or a period. */
function DateValues({
	state,
	onChange,
	onPickRange,
}: {
	state: ListState;
	onChange: Change;
	onPickRange: (key: DateKey) => void;
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
								<DropdownMenuRadioItem key={preset} value={preset}>
									{t(`listMenu.${preset}`)}
								</DropdownMenuRadioItem>
							))}
							<DropdownMenuRadioItem value="range" onClick={() => onPickRange(key)}>
								{t("listMenu.range")}
							</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuGroup>
				</Fragment>
			))}
		</>
	);
}

/**
 * The calendar the "pick a period" row opens, at the filter button. The first day clicked starts the period and the second ends it (the same day twice is
 * one day); the period is applied and the calendar closes with the second.
 */
function RangePopover({
	filter,
	anchor,
	onApply,
	onClose,
}: {
	filter: DateFilter | null;
	anchor: React.RefObject<HTMLButtonElement | null>;
	onApply: (from: string, to: string) => void;
	onClose: () => void;
}) {
	const site = useSite();
	const [start, setStart] = useState<Date | null>(null);
	const range = filter?.kind === "range" ? { from: dayToDate(filter.from), to: dayToDate(filter.to) } : undefined;
	return (
		<Popover open onOpenChange={(open) => !open && onClose()}>
			<PopoverContent anchor={anchor} align="end" width="auto" padding="none">
				<Calendar
					mode="range"
					numberOfMonths={1}
					selected={start ? { from: start, to: start } : range}
					defaultMonth={range?.from}
					locale={adminCalendarLocale(site)}
					onDayClick={(day) => {
						if (!start) return setStart(day);
						const [from, to] = start <= day ? [start, day] : [day, start];
						onApply(dateToDay(from), dateToDay(to));
					}}
				/>
			</PopoverContent>
		</Popover>
	);
}

/** One row of the first level, with the values it opens at the side. */
function Row({
	row,
	state,
	onChange,
	onPickRange,
}: {
	row: FilterRow;
	state: ListState;
	onChange: Change;
	onPickRange: (key: DateKey) => void;
}) {
	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>{row.label}</DropdownMenuSubTrigger>
			<DropdownMenuSubContent side="left">
				{row.kind === "locale" && <LocaleValues state={state} onChange={onChange} />}
				{row.kind === "translation" && <TranslationValues state={state} onChange={onChange} />}
				{row.kind === "date" && <DateValues state={state} onChange={onChange} onPickRange={onPickRange} />}
				{row.kind === "field" && <FieldValues field={row.field} state={state} onChange={onChange} />}
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}

/**
 * The "Filter" menu of a list: a search row, then only the names of what can be filtered (language, translation and date, a rule, then the schema's fields),
 * each opening its values at the side. Several values of one field can be on at once (they are OR); different fields narrow each other (AND).
 */
export function ListFilterMenu({ state, onChange }: { state: ListState; onChange: Change }) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const [text, setText] = useState("");
	const [range, setRange] = useState<DateKey | null>(null);
	const anchor = useRef<HTMLButtonElement | null>(null);
	const { top, fields } = filterRowsOf(site, state.collection);
	const shown = (rows: FilterRow[]) => rows.filter((row) => rowMatches(row, text));
	const rowKey = (row: FilterRow) => (row.kind === "field" ? `field:${row.field.name}` : row.kind);
	const pick = { state, onChange, onPickRange: setRange };
	return (
		<>
			<DropdownMenu onOpenChange={(open) => open && setText("")}>
				<DropdownMenuTrigger render={<FilterButton ref={anchor} />}>{t("listMenu.filter")}</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuSearch label={t("listMenu.filterSearch")} value={text} onValueChange={setText} />
					{shown(top).map((row) => (
						<Row key={rowKey(row)} row={row} {...pick} />
					))}
					{shown(top).length > 0 && shown(fields).length > 0 && <DropdownMenuSeparator />}
					{shown(fields).map((row) => (
						<Row key={rowKey(row)} row={row} {...pick} />
					))}
					{shown(top).length + shown(fields).length === 0 && (
						<DropdownMenuItem disabled>{t("listMenu.noMatch")}</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			{range && (
				<RangePopover
					filter={state[range]}
					anchor={anchor}
					onApply={(from, to) => {
						onChange({ [range]: { kind: "range", from, to } });
						setRange(null);
					}}
					onClose={() => setRange(null)}
				/>
			)}
		</>
	);
}
