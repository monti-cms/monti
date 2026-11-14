import type { EntryState, Facet, ListColumn, ListFilter } from "@monti-cms/core";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuScroll,
	DropdownMenuSearch,
	DropdownMenuSeparator,
} from "@monti-cms/ui";
import { type ReactNode, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import { DateRows } from "./date-rows";
import { toggled, ValueRow } from "./filter-rows";
import { filterColumn, type ListState, TRANSLATION_STATES } from "./list-query";
import { SortRows } from "./sort-rows";

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

type MenuProps = {
	column: ListColumn;
	label: string;
	state: ListState;
	query: Query;
	setFilter: (column: string, filter: ListFilter | null) => void;
	setSort: (sort: ListState["sort"]) => void;
	onHide: () => void;
};

/**
 * What a menu's counts count while the list shows one folder (LT-12): picking a value is a filter, and a filter looks through the folders
 * below (doc 07, T54), so each count is the rows the list shows once it is picked, not the rows of the folder on the screen.
 */
function Counted({ query, children }: { query: Query; children: ReactNode }) {
	const { t } = useAdmin();
	if (query.folder === undefined || query.scope !== "here") return children;
	return (
		<DropdownMenuGroup>
			<DropdownMenuLabel>{t(query.folder === null ? "list.countedEverywhere" : "list.countedBelow")}</DropdownMenuLabel>
			{children}
		</DropdownMenuGroup>
	);
}

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
			<Counted query={query}>
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
			</Counted>
			<HideRow onHide={onHide} />
		</>
	);
}

/**
 * The language column: the languages the groups have, each with its count | "Translation": missing, source changed, up to date (components/list.md, column
 * menu). The translation rows are checked like any column's values: several leave the groups of any of them.
 */
function LocaleMenu({ state, query, setFilter, onHide }: MenuProps) {
	const { t } = useAdmin();
	const languageName = useLanguageName();
	const facets = useFacets(query, "locale");
	const translationFacets = useFacets(query, "translation");
	const current = filterOf(state, "locale");
	const chosen = current?.on === "locale" ? current.any : [];
	const translation = filterOf(state, "translation");
	const picked = translation?.on === "translation" ? translation.any : [];
	const locales = [...new Set([...(facets ?? []).map((facet) => facet.value ?? ""), ...chosen])].filter(Boolean);
	return (
		<>
			<Counted query={query}>
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
			</Counted>
			<DropdownMenuSeparator />
			<DropdownMenuGroup>
				<DropdownMenuLabel>{t("list.translation")}</DropdownMenuLabel>
				{TRANSLATION_STATES.map((is) => (
					<ValueRow
						key={is}
						label={t(`list.translation.${is}`)}
						counted={count(translationFacets, is)}
						checked={picked.includes(is)}
						onToggle={() => {
							// In the menu's order, so the same choice is always the same address.
							const any = TRANSLATION_STATES.filter((each) => toggled(picked, is).includes(each));
							setFilter("translation", any.length ? { on: "translation", any } : null);
						}}
					/>
				))}
			</DropdownMenuGroup>
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
			<Counted query={query}>
				<ValueRow
					label={t("list.none")}
					counted={count(facets, null)}
					checked={chosen.includes(null)}
					onToggle={() => toggle(null)}
				/>
				<DropdownMenuSeparator />
				{kind === "relation" && (facets?.length ?? 0) > LONG ? <DropdownMenuScroll>{rows}</DropdownMenuScroll> : rows}
			</Counted>
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
			<Counted query={query}>
				<ValueRow
					label={t("list.isEmpty")}
					counted={count(facets, "empty")}
					checked={on}
					onToggle={() => setFilter(column.id, on ? null : { on: "empty", field: column.id })}
				/>
			</Counted>
			<HideRow onHide={onHide} />
		</>
	);
}

function TitleMenu({ state, setSort }: MenuProps) {
	return (
		<SortRows
			dir={state.sort.by === "title" ? state.sort.dir : null}
			onChange={(dir) => setSort({ by: "title", dir })}
		/>
	);
}

/**
 * A date column: sort newest or oldest first | the days to filter by (`DateRows`) | hide (flow 7, steps 05–05c).
 */
function DateMenu({ column, state, setFilter, setSort, onHide }: MenuProps) {
	const field = column.id as "updatedAt" | "publishedAt" | "createdAt";
	const current = filterOf(state, column.id);
	return (
		<>
			<SortRows
				kind="date"
				dir={state.sort.by === column.id ? state.sort.dir : null}
				onChange={(dir) => setSort({ by: field, dir })}
			/>
			<DropdownMenuSeparator />
			<DateRows
				range={current?.on === "date" ? current.range : null}
				onChange={(range) => setFilter(column.id, range === null ? null : { on: "date", field, range })}
			/>
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
		case "media":
			return <EmptyMenu {...props} />;
	}
}
