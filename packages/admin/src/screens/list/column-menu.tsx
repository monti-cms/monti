import type { EntryState, Facet, ListColumn, ListFilter } from "@monti-cms/core";
import {
	Calendar,
	DropdownMenuCheckboxItem,
	DropdownMenuItem,
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
import { useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import { filterColumn, type ListState } from "./list-query";

type Query = Record<string, unknown>;

const STATES: readonly EntryState[] = ["published", "changed", "draft", "archived"];
/** A relation's values past this many scroll inside the menu, under the search row. */
const LONG = 8;

/** The counts of one column's values, read when its menu opens, the other columns' filters applied (`entries.facets`). */
function useFacets(query: Query, column: string) {
	return useRead<{ values: Facet[] }>("entries.facets", { ...query, column }).data?.values ?? null;
}

const count = (facets: Facet[] | null, value: string | null) =>
	facets === null ? null : (facets.find((facet) => facet.value === value)?.count ?? 0);

function ValueRow({
	checked,
	onToggle,
	label,
	counted,
}: {
	checked: boolean;
	onToggle: () => void;
	label: string;
	counted: number | null;
}) {
	return (
		<DropdownMenuCheckboxItem box checked={checked} closeOnClick={false} onCheckedChange={onToggle}>
			{label}
			{counted !== null && <MenuShortcut>{counted}</MenuShortcut>}
		</DropdownMenuCheckboxItem>
	);
}

/** Toggles one value of a filter that takes several, dropping the filter when its last value goes. */
function toggled<T>(chosen: readonly T[], value: T): T[] {
	return chosen.includes(value) ? chosen.filter((each) => each !== value) : [...chosen, value];
}

type MenuProps = {
	column: ListColumn;
	label: string;
	state: ListState;
	query: Query;
	setFilter: (column: string, filter: ListFilter | null) => void;
	setSort: (sort: ListState["sort"]) => void;
	onHide: () => void;
};

const filterOf = (state: ListState, column: string) => state.filters.find((filter) => filterColumn(filter) === column);

function HideRow({ onHide }: { onHide: () => void }) {
	const { t } = useAdmin();
	return (
		<>
			<DropdownMenuSeparator />
			<DropdownMenuItem onClick={onHide}>{t("list.hide")}</DropdownMenuItem>
		</>
	);
}

function StatusMenu({ state, query, setFilter, onHide }: MenuProps) {
	const { t } = useAdmin();
	const facets = useFacets(query, "status");
	const current = filterOf(state, "status");
	const chosen = current?.on === "status" ? current.any : [];
	const names: Record<EntryState, string> = {
		published: t("list.state.published"),
		changed: t("list.state.changed"),
		draft: t("list.state.draft"),
		archived: t("list.state.archived"),
	};
	return (
		<>
			{STATES.map((value) => (
				<ValueRow
					key={value}
					label={names[value]}
					counted={count(facets, value)}
					checked={chosen.includes(value)}
					onToggle={() => {
						const any = toggled(chosen, value);
						setFilter("status", any.length ? { on: "status", any } : null);
					}}
				/>
			))}
			<HideRow onHide={onHide} />
		</>
	);
}

function LocaleMenu({ state, query, setFilter, onHide }: MenuProps) {
	const languageName = useLanguageName();
	const facets = useFacets(query, "locale");
	const current = filterOf(state, "locale");
	const chosen = current?.on === "locale" ? current.any : [];
	const locales = [...new Set([...(facets ?? []).map((facet) => facet.value ?? ""), ...chosen])].filter(Boolean);
	return (
		<>
			{locales.map((value) => (
				<ValueRow
					key={value}
					label={languageName(value)}
					counted={count(facets, value)}
					checked={chosen.includes(value)}
					onToggle={() => {
						const any = toggled(chosen, value);
						setFilter("locale", any.length ? { on: "locale", any } : null);
					}}
				/>
			))}
			<HideRow onHide={onHide} />
		</>
	);
}

/** A language's name in the admin's language ("en" reads "English" in English and its Korean name in Korean), its code when the browser has no name for it. */
export function useLanguageName() {
	const { language } = useAdmin();
	const names = new Intl.DisplayNames([language], { type: "language" });
	return (code: string) => {
		try {
			return names.of(code) ?? code.toUpperCase();
		} catch {
			return code.toUpperCase();
		}
	};
}

/** A relation or select column: "None", then each value with its count; a relation searches its values on top (components/list.md, column menu). */
function ValuesMenu({ column, state, query, setFilter, onHide }: MenuProps) {
	const { t } = useAdmin();
	const facets = useFacets(query, column.id);
	const [find, setFind] = useState("");
	const current = filterOf(state, column.id);
	const chosen = current?.on === "relation" || current?.on === "select" ? current.any : [];
	const kind = column.kind === "relation" ? "relation" : "select";
	const toggle = (value: string | null) => {
		const any = toggled(chosen, value);
		setFilter(column.id, any.length ? { on: kind, field: column.id, any } : null);
	};
	const values = (facets ?? []).filter(
		(facet): facet is Facet & { value: string } =>
			facet.value !== null && (facet.label ?? facet.value).toLowerCase().includes(find.trim().toLowerCase()),
	);
	const rows = values.map((facet) => (
		<ValueRow
			key={facet.value}
			label={facet.label ?? facet.value}
			counted={facet.count}
			checked={chosen.includes(facet.value)}
			onToggle={() => toggle(facet.value)}
		/>
	));
	return (
		<>
			{kind === "relation" && <DropdownMenuSearch value={find} onValueChange={setFind} label={t("list.findValue")} />}
			<ValueRow
				label={t("list.none")}
				counted={count(facets, null)}
				checked={chosen.includes(null)}
				onToggle={() => toggle(null)}
			/>
			<DropdownMenuSeparator />
			{kind === "relation" && (facets?.length ?? 0) > LONG ? <DropdownMenuScroll>{rows}</DropdownMenuScroll> : rows}
			<HideRow onHide={onHide} />
		</>
	);
}

function EmptyMenu({ column, state, query, setFilter, onHide }: MenuProps) {
	const { t } = useAdmin();
	const facets = useFacets(query, column.id);
	const on = filterOf(state, column.id)?.on === "empty";
	return (
		<>
			<ValueRow
				label={t("list.isEmpty")}
				counted={count(facets, "empty")}
				checked={on}
				onToggle={() => setFilter(column.id, on ? null : { on: "empty", field: column.id })}
			/>
			<HideRow onHide={onHide} />
		</>
	);
}

function TitleMenu({ state, setSort }: MenuProps) {
	const { t } = useAdmin();
	return (
		<DropdownMenuRadioGroup
			value={state.sort.by === "title" ? state.sort.dir : ""}
			onValueChange={(dir) => setSort({ by: "title", dir: dir as "asc" | "desc" })}
		>
			<DropdownMenuRadioItem value="asc">{t("list.sortAsc")}</DropdownMenuRadioItem>
			<DropdownMenuRadioItem value="desc">{t("list.sortDesc")}</DropdownMenuRadioItem>
		</DropdownMenuRadioGroup>
	);
}

const iso = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromIso = (value: string) => {
	const [year, month, day] = value.split("-").map(Number);
	return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
};

/**
 * A date column: sort newest or oldest first | today, 7 days, 30 days, or a range picked on a calendar beside the menu (flow 7, steps 05–05c). The
 * first day pressed starts the range, the next one ends it and applies it; the calendar stays open showing it.
 */
function DateMenu({ column, state, setFilter, setSort, onHide }: MenuProps) {
	const { t, language } = useAdmin();
	const field = column.id as "updatedAt" | "publishedAt" | "createdAt";
	const current = filterOf(state, column.id);
	const range = current?.on === "date" ? current.range : null;
	const [start, setStart] = useState<Date | null>(null);
	const ranged = range !== null && typeof range !== "string" ? range : null;
	const picked =
		start !== null
			? { from: start, to: undefined }
			: ranged
				? { from: fromIso(ranged.from), to: fromIso(ranged.to) }
				: undefined;
	const pick = (value: "today" | "7d" | "30d") =>
		setFilter(column.id, range === value ? null : { on: "date", field, range: value });
	return (
		<>
			<DropdownMenuRadioGroup
				value={state.sort.by === column.id ? state.sort.dir : ""}
				onValueChange={(dir) => setSort({ by: field, dir: dir as "asc" | "desc" })}
			>
				<DropdownMenuRadioItem value="desc">{t("list.newest")}</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="asc">{t("list.oldest")}</DropdownMenuRadioItem>
			</DropdownMenuRadioGroup>
			<DropdownMenuSeparator />
			<DropdownMenuRadioGroup value={typeof range === "string" ? range : ""}>
				<DropdownMenuRadioItem value="today" closeOnClick={false} onClick={() => pick("today")}>
					{t("list.today")}
				</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="7d" closeOnClick={false} onClick={() => pick("7d")}>
					{t("list.last7")}
				</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="30d" closeOnClick={false} onClick={() => pick("30d")}>
					{t("list.last30")}
				</DropdownMenuRadioItem>
			</DropdownMenuRadioGroup>
			<DropdownMenuSub>
				<DropdownMenuSubTrigger
					chevron={false}
					// Like the rows above, the picked row pressed again turns its filter off.
					onClick={() => {
						if (!ranged) return;
						setStart(null);
						setFilter(column.id, null);
					}}
				>
					{t("list.pickRange")}
					{ranged && <MenuTick />}
				</DropdownMenuSubTrigger>
				<DropdownMenuSubContent bare>
					<Calendar
						mode="range"
						language={language}
						// The calendar follows `selected` only when it has `onSelect`; the days pressed are handled in `onDayClick`.
						selected={picked}
						onSelect={() => {}}
						defaultMonth={picked?.from}
						onDayClick={(day) => {
							if (start === null) return setStart(day);
							const [from, to] = day < start ? [day, start] : [start, day];
							setStart(null);
							setFilter(column.id, { on: "date", field, range: { from: iso(from), to: iso(to) } });
						}}
					/>
				</DropdownMenuSubContent>
			</DropdownMenuSub>
			<HideRow onHide={onHide} />
		</>
	);
}

/** The rows of a column's menu, by what the column is: sort | values to filter by | hide (components/list.md, column menu). */
export function ColumnMenu(props: MenuProps) {
	switch (props.column.kind) {
		case "status":
			return <StatusMenu {...props} />;
		case "title":
			return <TitleMenu {...props} />;
		case "locale":
			return <LocaleMenu {...props} />;
		case "date":
			return <DateMenu {...props} />;
		case "relation":
		case "select":
			return <ValuesMenu {...props} />;
		case "text":
			return <EmptyMenu {...props} />;
	}
}
