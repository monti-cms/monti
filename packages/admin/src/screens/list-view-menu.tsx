"use client";

import { PAGE_SIZES, type PageSize, useSite, useTranslator } from "@monti-cms/core/site";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	FilterButton,
	MenuValue,
} from "@monti-cms/ui";
import { type AdminListColumn, columnLabel } from "./list-columns";
import type { ListState } from "./list-state";
import { sortChoicesOf, sortLabel } from "./list-view-model";
import { screensMessages } from "./messages";

/**
 * The "View" menu of a list: sort (field and direction as one list), the columns (a box each to show or hide; the title is not in it, it is always there;
 * the order is set by dragging the names in the list's head) and how many rows a page holds. Each opens at the side with its current value beside it. Picking an order or a size applies it and closes the
 * whole menu; the columns stay open while they are set.
 */
export function ListViewMenu({
	state,
	order,
	visibility,
	onChange,
	onPageSizeChange,
	onToggleColumn,
}: {
	state: Pick<ListState, "collection" | "sortField" | "sortDirection" | "pageSize">;
	/** Every column in the order the writer set, the title among them. */
	order: AdminListColumn[];
	visibility: Record<string, boolean>;
	onChange: (patch: Partial<ListState>) => void;
	onPageSizeChange: (size: PageSize) => void;
	onToggleColumn: (column: AdminListColumn, visible: boolean) => void;
}) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const choices = sortChoicesOf(site, state.collection);
	const key = (field: string, direction: string) => `${field}:${direction}`;
	const columns = order.filter((column) => column !== "title");
	const shown = columns.filter((column) => visibility[column] !== false).length;
	const firstTitle = choices.findIndex((choice) => choice.field === "title");
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<FilterButton />}>{t("listMenu.view")}</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						{t("listMenu.sort")}
						<MenuValue>{sortLabel(site, state.sortField, state.sortDirection)}</MenuValue>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent side="left">
						<DropdownMenuRadioGroup
							value={key(state.sortField, state.sortDirection)}
							onValueChange={(value) => {
								const choice = choices.find((candidate) => key(candidate.field, candidate.direction) === value);
								if (choice) onChange({ sortField: choice.field, sortDirection: choice.direction });
							}}
						>
							{choices.flatMap((choice, index) => [
								index === firstTitle ? <DropdownMenuSeparator key="rule" /> : null,
								<DropdownMenuRadioItem
									key={key(choice.field, choice.direction)}
									value={key(choice.field, choice.direction)}
								>
									{choice.label}
								</DropdownMenuRadioItem>,
							])}
						</DropdownMenuRadioGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						{t("listMenu.columns")}
						<MenuValue>{t("listMenu.columnsCount", { count: shown })}</MenuValue>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent side="left">
						{columns.map((column) => (
							<DropdownMenuCheckboxItem
								key={column}
								box
								checked={visibility[column] !== false}
								onCheckedChange={(checked) => onToggleColumn(column, checked)}
							>
								{columnLabel(site, state.collection, column)}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						{t("listMenu.perPage")}
						<MenuValue>{state.pageSize}</MenuValue>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent side="left">
						<DropdownMenuRadioGroup
							value={String(state.pageSize)}
							onValueChange={(value) => onPageSizeChange(Number(value) as PageSize)}
						>
							{PAGE_SIZES.map((size) => (
								<DropdownMenuRadioItem key={size} value={String(size)}>
									{size}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
