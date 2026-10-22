// "View" popover of the entry list: which columns show and in what order, how many rows a page holds, and how the list is sorted.
import { type ListSortField, PAGE_SIZES, type PageSize, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Button,
	Checkbox,
	cn,
	IconButton,
	Label,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@monti-cms/ui";
import { ArrowDown, ArrowUp, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { type AdminListColumn, columnConfig, columnLabel, columnsFor } from "./list-columns";
import type { ListState } from "./list-state";
import { screensMessages } from "./messages";

/** Show/hide and reorder the columns. The title column always shows. */
export function ColumnSettingsPanel({
	collection,
	order,
	visibility,
	onToggle,
	onMove,
}: {
	collection: string;
	order: AdminListColumn[];
	visibility: Record<string, boolean>;
	onToggle: (column: AdminListColumn, visible: boolean) => void;
	onMove: (column: AdminListColumn, direction: -1 | 1) => void;
}) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	return (
		<ul className="space-y-0.5">
			{order.map((column, index) => (
				<li
					key={column}
					className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-monti-hover"
				>
					<Label className="font-normal text-monti-label">
						<Checkbox
							checked={visibility[column] ?? false}
							disabled={column === "title"}
							onCheckedChange={(checked) => onToggle(column, checked === true)}
						/>
						{columnLabel(site, collection, column)}
					</Label>
					<span className="flex gap-1">
						<IconButton
							size="icon-xs"
							variant="ghost"
							label={t("list.columnUp", { label: columnLabel(site, collection, column) })}
							disabled={index === 0}
							onClick={() => onMove(column, -1)}
						>
							<ArrowUp aria-hidden />
						</IconButton>
						<IconButton
							size="icon-xs"
							variant="ghost"
							label={t("list.columnDown", { label: columnLabel(site, collection, column) })}
							disabled={index === order.length - 1}
							onClick={() => onMove(column, 1)}
						>
							<ArrowDown aria-hidden />
						</IconButton>
					</span>
				</li>
			))}
		</ul>
	);
}

/** A titled part of the View popover. `scroll` lets it take the remaining height and scroll on its own (the column list). */
function ViewSection({ title, scroll = false, children }: { title: string; scroll?: boolean; children: ReactNode }) {
	return (
		<section className={cn("space-y-2", scroll && "flex min-h-0 flex-col")}>
			<h4 className="font-medium text-monti-caption text-monti-muted">{title}</h4>
			{scroll ? <div className="-mx-1 min-h-0 overflow-y-auto px-1">{children}</div> : children}
		</section>
	);
}

export function ListViewPopover({
	collection,
	state,
	order,
	visibility,
	onToggle,
	onMove,
	onStateChange,
	onPageSizeChange,
}: {
	collection: string;
	state: Pick<ListState, "sortField" | "sortDirection" | "pageSize">;
	order: AdminListColumn[];
	visibility: Record<string, boolean>;
	onToggle: (column: AdminListColumn, visible: boolean) => void;
	onMove: (column: AdminListColumn, direction: -1 | 1) => void;
	/** Same handler the column headers sort through. */
	onStateChange: (patch: Partial<ListState>) => void;
	onPageSizeChange: (size: PageSize) => void;
}) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	// The sort fields are the sortable columns, in column order.
	const sortable = columnsFor(site, collection).available.flatMap((column) => {
		const sortField = columnConfig(site, collection, column).sortField;
		return sortField ? [{ value: sortField as ListSortField, label: columnLabel(site, collection, column) }] : [];
	});
	const directionButton = (direction: "asc" | "desc") => (
		<Button
			type="button"
			size="xs"
			variant={state.sortDirection === direction ? "secondary" : "ghost"}
			aria-pressed={state.sortDirection === direction}
			onClick={() => onStateChange({ sortField: state.sortField, sortDirection: direction })}
		>
			{direction === "asc" ? t("filter.sortAsc") : t("filter.sortDesc")}
		</Button>
	);
	return (
		<Popover>
			<PopoverTrigger render={<Button type="button" variant="ghost" size="xs" className="text-monti-muted" />}>
				<SlidersHorizontal aria-hidden />
				{t("view.label")}
			</PopoverTrigger>
			{/* Kept inside the viewport: the column list scrolls, so a collection with many fields cannot push the popover off screen. */}
			<PopoverContent side="bottom" align="end" className="max-h-(--available-height) w-72 gap-4 p-3">
				<ViewSection title={t("view.sort")}>
					<div className="flex items-center gap-2">
						<Select
							value={state.sortField}
							items={sortable}
							onValueChange={(value) =>
								value && onStateChange({ sortField: value as ListSortField, sortDirection: state.sortDirection })
							}
						>
							<SelectTrigger size="sm" aria-label={t("view.sortField")} className="h-7 min-w-0 flex-1 text-monti-label">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{sortable.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<fieldset className="flex gap-0.5">
							<legend className="sr-only">{t("view.sort")}</legend>
							{directionButton("asc")}
							{directionButton("desc")}
						</fieldset>
					</div>
				</ViewSection>
				<ViewSection title={t("list.pageSize")}>
					<Select
						value={String(state.pageSize)}
						items={PAGE_SIZES.map((size) => ({ value: String(size), label: t("list.pageSizeOption", { size }) }))}
						onValueChange={(value) => value && onPageSizeChange(Number(value) as PageSize)}
					>
						<SelectTrigger size="sm" aria-label={t("list.pageSize")} className="h-7 w-full text-monti-label">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{PAGE_SIZES.map((size) => (
								<SelectItem key={size} value={String(size)}>
									{t("list.pageSizeOption", { size })}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</ViewSection>
				<ViewSection title={t("list.columnSettings")} scroll>
					<ColumnSettingsPanel
						collection={collection}
						order={order}
						visibility={visibility}
						onToggle={onToggle}
						onMove={onMove}
					/>
				</ViewSection>
			</PopoverContent>
		</Popover>
	);
}
