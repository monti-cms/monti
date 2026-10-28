"use client";

import { FolderParent, Reset, TrashCan } from "@carbon/icons-react";
import { trashDaysLeft, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	BulkBar,
	DropdownMenuCheckboxItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	Inline,
	ListHead,
	ListScroll,
	MenuShortcut,
	RowActions,
	RowCheck,
	RowLink,
	type SelectAllState,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
	TextButton,
	TrashRowDate,
	TrashRowTitle,
} from "@monti-cms/ui";
import type { KeyboardEvent } from "react";
import type { TrashEntryJson, TrashItemJson } from "../../api/trash";
import { commonMessages } from "../../lib/common.messages";
import { AdminLink as Link } from "../../router";
import { shortDate } from "../list-row-dates";
import { screensMessages } from "../messages";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "../shared/action-menu";
import { ListPagination } from "../shared/list-pager";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { trashMessages } from "./messages";
import {
	addressOf,
	daysLeftOf,
	isUrgent,
	itemKey,
	kindLabel,
	kindOf,
	metaOf,
	openOf,
	rowActionOf,
	titleOf,
} from "./trash-model";
import { kindValues, type TrashView } from "./use-trash";
import type { TrashActions } from "./use-trash-actions";

/** The widths of the kind and date columns and of the end of a row (the text button and the ⋯). */
const KIND_SIZE = 112;
const DATE_SIZE = 128;
const ACTIONS_SIZE = 140;

/**
 * One row: its check in the left margin, the title with its languages or contents, its kind, the day it was discarded over the days left, and the button
 * that brings it back.
 */
function TrashRow({
	item,
	view,
	actions,
	now,
	menu,
	onDeleteKey,
}: {
	item: TrashItemJson;
	view: TrashView;
	actions: TrashActions;
	now: Date;
	menu: (item: TrashItemJson) => MenuAction[];
	onDeleteKey: (event: KeyboardEvent, item: TrashItemJson) => void;
}) {
	const site = useSite();
	const t = useTranslator(trashMessages);
	const tc = useTranslator(commonMessages);
	const key = itemKey(item);
	const picked = view.selected.has(key);
	const open = openOf(site, item);
	const keptCount = actions.kept.get(key);
	const meta = metaOf(site, item, { searching: view.state.search !== "", kept: keptCount });
	const action = rowActionOf(item, actions.kept);
	// A search shows the day of what it found inside a folder too (the folder's day).
	const days = view.state.search !== "" ? trashDaysLeft(new Date(item.deletedAt), now) : daysLeftOf(item, now);
	const isOpenInPanel = view.panelItem !== null && itemKey(view.panelItem) === key;
	const title = titleOf(site, item);
	const link =
		open.kind === "editor" ? (
			<Link href={open.href} />
		) : (
			<button
				type="button"
				onClick={() => (open.kind === "folder" ? view.openFolder(item.id) : view.openPanel(item))}
			/>
		);
	return (
		<ActionContextMenu
			actions={menu(item)}
			trigger={
				<TableRow
					selected={picked || isOpenInPanel}
					aria-current={isOpenInPanel ? "true" : undefined}
					onKeyDown={(event) => onDeleteKey(event, item)}
				/>
			}
		>
			<TableCell>
				<RowCheck
					checked={picked}
					onCheckedChange={(on) => {
						const next = new Set(view.selected);
						if (on) next.add(key);
						else next.delete(key);
						view.setSelected(next);
					}}
					label={t("row.select")}
				/>
				<TrashRowTitle
					title={<RowLink render={link}>{title}</RowLink>}
					address={addressOf(item)}
					folder={item.type === "folder"}
					meta={meta.text}
					metaTone={meta.tone}
				/>
			</TableCell>
			<TableCell>
				<Text variant="note" tone="subtle" truncate>
					{kindLabel(site, kindOf(item))}
				</Text>
			</TableCell>
			<TableCell align="end">
				{days !== null && (
					<TrashRowDate
						date={shortDate(site, item.deletedAt)}
						left={t("row.left", { count: days })}
						urgent={isUrgent(days)}
					/>
				)}
			</TableCell>
			<TableCell align="end">
				<Inline gap={16} justify="end">
					<RowActions>
						{action === "restore" && (
							<TextButton onClick={() => void actions.restore([item])}>{tc("lifecycle.restore")}</TextButton>
						)}
						{action === "restoreOriginal" && (
							<TextButton onClick={() => void actions.restoreOriginal(item as TrashEntryJson)}>
								{t("row.restoreOriginal")}
							</TextButton>
						)}
						{action === "delete" && (
							<TextButton variant="danger" onClick={() => void actions.requestDelete([item])}>
								{tc("lifecycle.deletePermanently")}
							</TextButton>
						)}
					</RowActions>
					<RowActions>
						<MoreActionsButton
							actions={[
								{
									kind: "item",
									label: tc("lifecycle.deletePermanently"),
									icon: TrashCan,
									destructive: true,
									onSelect: () => void actions.requestDelete([item]),
								},
							]}
							label={t("row.more")}
						/>
					</RowActions>
				</Inline>
			</TableCell>
		</ActionContextMenu>
	);
}

/**
 * The one head row of the list: the title; the kind, whose menu filters to some kinds (several at once, any of them; it stays open, like the list's value
 * menus; the dot after its name and the ticks in it are all that shows the filter, with no chip row to push the list); and the day discarded, which sorts (newest first, or oldest first). Inside a folder the kind has no menu: everything there is one kind.
 */
function TrashHead({ view }: { view: TrashView }) {
	const site = useSite();
	const t = useTranslator(trashMessages);
	const ts = useTranslator(screensMessages);
	const { state, items, selected, setSelected } = view;
	const picked = items.filter((item) => selected.has(itemKey(item))).length;
	return (
		<ListHead
			columns={[
				{ id: "title", label: t("head.title") },
				{
					id: "kind",
					label: t("head.kind"),
					size: KIND_SIZE,
					filtered: state.kinds.length > 0,
					menu: state.folder
						? undefined
						: kindValues(view.kinds, site.COLLECTIONS).map(({ kind, count }) => (
								<DropdownMenuCheckboxItem
									key={kind}
									box
									checked={state.kinds.includes(kind)}
									onCheckedChange={(on) =>
										view.update({
											kinds: on ? [...state.kinds, kind] : state.kinds.filter((picked) => picked !== kind),
										})
									}
								>
									{kindLabel(site, kind)}
									<MenuShortcut>{count}</MenuShortcut>
								</DropdownMenuCheckboxItem>
							)),
				},
				{
					id: "deletedAt",
					label: t("head.deletedAt"),
					size: DATE_SIZE,
					align: "end",
					sort: state.direction,
					menu: (
						<DropdownMenuRadioGroup
							value={state.direction}
							onValueChange={(value) => view.update({ direction: value === "asc" ? "asc" : "desc" })}
						>
							<DropdownMenuRadioItem value="desc">{ts("sort.date.desc")}</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="asc">{ts("sort.date.asc")}</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					),
				},
			]}
			end={ACTIONS_SIZE}
			selectAll={{
				state: (picked === 0 ? "none" : picked === items.length ? "all" : "some") as SelectAllState,
				onChange: (all) => setSelected(new Set(all ? items.map(itemKey) : [])),
				label: t("selectAll"),
			}}
		/>
	);
}

/** In place of the head while rows are picked: how many, restore and permanent delete for them, and the way to let go. */
function TrashBulkBar({ view, actions }: { view: TrashView; actions: TrashActions }) {
	const t = useTranslator(trashMessages);
	const tc = useTranslator(commonMessages);
	const { items, selected, setSelected } = view;
	const rows = items.filter((item) => selected.has(itemKey(item)));
	return (
		<BulkBar
			label={t("bulk.count", { count: rows.length })}
			aria-label={t("bulk.label")}
			clearLabel={t("bulk.clear")}
			onClear={() => setSelected(new Set())}
			colSpan={4}
			selectAll={{
				state: rows.length === items.length ? "all" : "some",
				onChange: (all) => setSelected(new Set(all ? items.map(itemKey) : [])),
				label: t("selectAll"),
			}}
		>
			<TextButton onClick={() => void actions.restore(rows)}>{tc("lifecycle.restore")}</TextButton>
			<TextButton variant="danger" onClick={() => void actions.requestDelete(rows)}>
				{tc("lifecycle.deletePermanently")}
			</TextButton>
		</BulkBar>
	);
}

/**
 * The rows of the trash. Inside a trashed folder the first row goes one folder up and the rows have no date; a search shows where each was. The right-click
 * menu and the Delete key act on the rows picked when the row is one of them.
 */
export function TrashList({ view, actions, now }: { view: TrashView; actions: TrashActions; now: Date }) {
	const t = useTranslator(trashMessages);
	const tc = useTranslator(commonMessages);
	const { state, items, selected } = view;
	const targetsOf = (item: TrashItemJson) =>
		selected.has(itemKey(item)) && selected.size > 1 ? items.filter((row) => selected.has(itemKey(row))) : [item];
	const menu = (item: TrashItemJson): MenuAction[] => {
		const targets = targetsOf(item);
		return [
			{ kind: "item", label: tc("lifecycle.restore"), icon: Reset, onSelect: () => void actions.restore(targets) },
			{ kind: "separator" },
			{
				kind: "item",
				label: tc("lifecycle.deletePermanently"),
				icon: TrashCan,
				shortcut: "Del",
				destructive: true,
				onSelect: () => void actions.requestDelete(targets),
			},
		];
	};
	const onDeleteKey = (event: KeyboardEvent, item: TrashItemJson) => {
		if (event.key !== "Delete") return;
		if ((event.target as HTMLElement).closest("input, textarea, [contenteditable=true]")) return;
		event.preventDefault();
		void actions.requestDelete(targetsOf(item));
	};
	const picking = selected.size > 0;
	return (
		<Stack as="section" aria-label={t("title")} gap={0} grow minHeight={0}>
			{view.errorMessage && (
				<Box paddingTop={12}>
					<LoadErrorAlert message={view.errorMessage} onRetry={view.retry} />
				</Box>
			)}
			<ListScroll>
				<Box width="full">
					{items.length > 0 || state.folder ? (
						<Table container="none" layout="fixed" columns={[undefined, KIND_SIZE, DATE_SIZE, ACTIONS_SIZE]}>
							{picking ? <TrashBulkBar view={view} actions={actions} /> : <TrashHead view={view} />}
							<TableBody aria-busy={view.isRefreshing || undefined} dimmed={view.isRefreshing}>
								{state.folder && (
									<TableRow>
										<TableCell>
											<Inline gap={8}>
												<FolderParent aria-hidden size={16} />
												<RowLink render={<button type="button" onClick={view.closeFolder} />}>{t("folder.up")}</RowLink>
											</Inline>
										</TableCell>
										<TableCell />
										<TableCell />
										<TableCell />
									</TableRow>
								)}
								{items.map((item) => (
									<TrashRow
										key={itemKey(item)}
										item={item}
										view={view}
										actions={actions}
										now={now}
										menu={menu}
										onDeleteKey={onDeleteKey}
									/>
								))}
							</TableBody>
						</Table>
					) : view.isLoading ? (
						<Text as="p" variant="note" tone="subtle" role="status">
							{tc("loading")}
						</Text>
					) : (
						!view.errorMessage &&
						state.search === "" && (
							<Box paddingY={40} border="top">
								<Text as="p" variant="note" tone="subtle" align="center">
									{t("emptied")}
								</Text>
							</Box>
						)
					)}
				</Box>
			</ListScroll>
			<ListPagination
				total={view.resultTotal}
				shown={items.length}
				page={state.page}
				pageSize={state.pageSize}
				onPageChange={(page) => view.update({ page }, { resetPage: false })}
				showRange={false}
				hidePagerWhenSingle
			/>
		</Stack>
	);
}
