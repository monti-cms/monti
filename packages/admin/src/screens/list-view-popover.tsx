// "View" popover of the entry list: which columns show and in what order, how many rows a page holds, and how the list is sorted.
import { type ListSortField, PAGE_SIZES, type PageSize, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
	Checkbox,
	Heading,
	IconButton,
	Inline,
	Label,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Stack,
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
		<Stack as="ul" gap="hair">
			{order.map((column, index) => (
				// design-system: needs a hover surface on Box/Stack (the row's hover background)
				<Inline as="li" key={column} justify="between" gap="condensed" radius="md" paddingX="tight" paddingY="hair">
					<Label>
						<Checkbox
							checked={visibility[column] ?? false}
							disabled={column === "title"}
							onCheckedChange={(checked) => onToggle(column, checked === true)}
						/>
						{columnLabel(site, collection, column)}
					</Label>
					<Inline as="span" gap="tight">
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
					</Inline>
				</Inline>
			))}
		</Stack>
	);
}

/** A titled part of the View popover. `scroll` lets it take the remaining height and scroll on its own (the column list). */
function ViewSection({ title, scroll = false, children }: { title: string; scroll?: boolean; children: ReactNode }) {
	return (
		<Stack as="section" gap="condensed" minHeight={scroll ? 0 : undefined}>
			<Heading as="h4" variant="label" tone="muted">
				{title}
			</Heading>
			{scroll ? (
				<Box minHeight={0} overflow="y">
					{children}
				</Box>
			) : (
				children
			)}
		</Stack>
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
			<PopoverTrigger render={<Button type="button" variant="quiet" size="xs" />}>
				<SlidersHorizontal aria-hidden />
				{t("view.label")}
			</PopoverTrigger>
			{/* Kept inside the viewport: the column list scrolls, so a collection with many fields cannot push the popover off screen. */}
			<PopoverContent side="bottom" align="end" width="md" scroll>
				<Stack gap="comfortable">
					<ViewSection title={t("view.sort")}>
						<Inline gap="condensed">
							<Select
								value={state.sortField}
								items={sortable}
								onValueChange={(value) =>
									value && onStateChange({ sortField: value as ListSortField, sortDirection: state.sortDirection })
								}
							>
								<SelectTrigger size="sm" aria-label={t("view.sortField")}>
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
							<Inline gap="hair" role="group" aria-label={t("view.sort")}>
								{directionButton("asc")}
								{directionButton("desc")}
							</Inline>
						</Inline>
					</ViewSection>
					<ViewSection title={t("list.pageSize")}>
						<Select
							value={String(state.pageSize)}
							items={PAGE_SIZES.map((size) => ({ value: String(size), label: t("list.pageSizeOption", { size }) }))}
							onValueChange={(value) => value && onPageSizeChange(Number(value) as PageSize)}
						>
							<SelectTrigger size="sm" width="full" aria-label={t("list.pageSize")}>
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
				</Stack>
			</PopoverContent>
		</Popover>
	);
}
