import { MEDIA_KIND, type TrashList, type TrashRef, type TrashRow } from "@monti-cms/core";
import {
	BulkBar,
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuTrigger,
	Count,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Empty,
	IconButton,
	Inline,
	LIST_COLUMN_SIZE,
	ListFooter,
	ListHead,
	type ListHeadColumn,
	ListScroll,
	LocaleCodes,
	MenuShortcut,
	PageColumn,
	PageHeader,
	RowActions,
	RowCheck,
	RowLink,
	RowMore,
	RowTitle,
	SearchToggle,
	type SelectAll,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
	TextButton,
	TrashRowDate,
} from "@monti-cms/ui";
import { OverflowMenuHorizontal, TrashCan, Undo } from "@monti-cms/ui/icons";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import { href, type Route } from "../../route";
import { URGENT_DAYS } from "../../trash/days-left";
import { usePurge, useRestore } from "../../trash/use-trash";
import type { FrameCounts } from "../frame/admin-frame";
import { firstStop } from "../frame/focus-hand-off";
import { useLanguageName } from "../list/column-menu";
import { FilterRows } from "../list/filter-rows";
import { searchScopes } from "../list/folders";
import { ListPages } from "../list/list-pages";
import { NoMatchRow } from "../list/no-match-row";
import { HandedRowActions, HandedRowLink, listStartOf, rowActionsOf } from "../list/row-hand-off";
import { SortRows } from "../list/sort-rows";
import { useColumnWidths } from "../list/use-column-widths";
import { useSearchWords } from "../list/use-search-words";
import { TrashedFilePanel } from "../media/media-panel";
import type { SchemaRead } from "../settings/schema-draft";
import { readTrashState, TRASH_PAGE_SIZE, type TrashState, trashQueryOf, writeTrashState } from "./trash-query";
import { TrashedItemPanel } from "./trashed-item-panel";

/** The widths of the trash's own columns, of the lists' kinds (screens/trash.md): what a row is (one value), and how long it stays (a short mono line). */
const KIND_SIZE = LIST_COLUMN_SIZE.one;
const LEFT_SIZE = LIST_COLUMN_SIZE.measure;

const keyOf = (row: TrashRef) => `${row.kind}:${row.id}`;
const refOf = (row: TrashRef): TrashRef => ({ kind: row.kind, id: row.id });

/**
 * The trash (doc 11, flow 5): what was thrown away, how long each stays, and the way back. Its table is the lists' table; a thrown-away folder is one row that opens
 * in place, and an item or a file opens beside the list to be read.
 */
export function TrashScreen({
	params,
	go,
}: {
	params: URLSearchParams;
	go: (route: Route, options?: { replace?: boolean }) => void;
}) {
	const { t } = useAdmin();
	const state = useMemo(() => readTrashState(params), [params]);
	const setState = (next: TrashState, options?: { replace?: boolean }) =>
		go({ screen: "trash", params: writeTrashState(next) }, options);
	const schema = useRead<SchemaRead>("schema.read");
	const counts = useRead<FrameCounts>("frame.counts", {}, { afterWrites: true });
	const read = useRead<TrashList>("trash.list", trashQueryOf(state), {
		afterWrites: true,
		quiet: state.folder !== null,
	});
	const data = read.data;
	const rows = data?.rows ?? [];
	const place = state.folder ? (data?.place ?? null) : null;
	const searching = state.search.trim() !== "";
	const looking = searching || state.kinds.length > 0 || state.locales.length > 0;

	// The open folder left the trash (restored, or deleted for good): the trash itself is what is left to show.
	const gone = state.folder !== null && read.refusal?.reason?.key === "trash.unknown";
	useEffect(() => {
		if (gone) go({ screen: "trash", params: new URLSearchParams() }, { replace: true });
	}, [gone, go]);

	const box = useSearchWords(state.search, (text) =>
		setState(
			{ ...state, search: text, everywhere: text.trim() === "" ? false : state.everywhere, page: 1 },
			{ replace: true },
		),
	);

	// Picked rows belong to the page they were picked on.
	const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
	const pageKey = JSON.stringify(trashQueryOf(state));
	const [pickedOn, setPickedOn] = useState(pageKey);
	if (pickedOn !== pageKey) {
		setPickedOn(pageKey);
		setPicked(new Set());
	}
	const pickedRows = rows.filter((row) => picked.has(keyOf(row)));
	const pick = (row: TrashRow, on: boolean) => {
		const next = new Set(picked);
		if (on) next.add(keyOf(row));
		else next.delete(keyOf(row));
		setPicked(next);
	};
	const selectAll: SelectAll = {
		state: pickedRows.length === 0 ? "none" : pickedRows.length === rows.length ? "all" : "some",
		onChange: (on) => setPicked(new Set(on ? rows.map(keyOf) : [])),
		label: t("list.selectAll"),
	};

	const collections = schema.data?.schema.collections ?? {};
	const siteLocales = (schema.data?.schema.locales.list ?? []).map((locale) => locale.code);
	const multilingual = siteLocales.length > 1;
	const languageName = useLanguageName();
	// The language menu lists the languages that are in the trash here, in the site's order, and the ones it is filtered by.
	const languages = siteLocales.filter((code) => (data?.locales[code] ?? 0) > 0 || state.locales.includes(code));
	const { sized, resize } = useColumnWidths("trash");
	const collectionLabel = (collection: string) => schema.data?.adminValues[collection]?.label ?? collection;
	const kindLabel = (kind: string) => (kind === MEDIA_KIND ? t("trash.kind.media") : collectionLabel(kind));
	const isDocument = (row: TrashRow) => row.collection !== null && collections[row.collection]?.kind === "document";

	const close = (affected: TrashRef[]) => {
		setPicked(new Set());
		if (state.open && affected.some((row) => keyOf(row) === keyOf(state.open as TrashRef)))
			setState({ ...state, open: null }, { replace: true });
	};
	const restore = useRestore({
		onOpen: (entry) => go({ screen: "entry", collection: entry.collection, id: entry.id }),
	});
	const purge = usePurge();
	const restoreRows = async (list: TrashRow[]) => {
		if (await restore.run(list.map(refOf))) close(list);
	};
	const table = useRef<HTMLTableElement>(null);
	/** Where the list begins for the keyboard; with no list left (its last row went), the page's first control. */
	const listStart = () => listStartOf(table.current) ?? firstStop();
	/**
	 * Where the focus goes when rows deleted for good are gone before their question has closed: nowhere of its own while a ⋯ of theirs is
	 * still there (the question gives the focus back to it, and it hands it on when its row goes); else the row that stood after the first
	 * of them, then the one before it, then the list's start (tokens.md, the states).
	 */
	const afterPurge = (list: TrashRef[]) => {
		const going = new Set(list.map(keyOf));
		const at = rows.findIndex((row) => going.has(keyOf(row)));
		const beside = [...rows.slice(at + 1), ...rows.slice(0, Math.max(at, 0)).reverse()]
			.map(keyOf)
			.filter((key) => !going.has(key));
		return () => {
			if ([...going].some((key) => rowActionsOf(table.current, key))) return null;
			for (const key of beside) {
				const more = rowActionsOf(table.current, key);
				if (more) return more;
			}
			return listStart();
		};
	};
	const purgeRows = (list: TrashRow[]) =>
		purge.start({
			rows: list.map(refOf),
			reserves: list.flatMap((row) => row.reserves),
			onPurged: () => close(list),
			whenGone: afterPurge(list),
		});
	/** The rows an action on this row is about: every picked row when it is one of them. */
	const rowsFor = (row: TrashRow) => (picked.has(keyOf(row)) && pickedRows.length > 1 ? pickedRows : [row]);

	const open = (row: TrashRow) => {
		if (row.kind === "folder")
			return setState({ ...state, folder: row.id, search: "", everywhere: false, page: 1, open: null });
		if (row.kind === "entry" && isDocument(row) && row.collection)
			return go({ screen: "entry", collection: row.collection, id: row.id });
		setState({ ...state, open: refOf(row) });
	};
	const entryHref = (row: TrashRow) =>
		row.kind === "entry" && isDocument(row) && row.collection
			? href({ screen: "entry", collection: row.collection, id: row.id })
			: undefined;

	/** What stands after a row's title, as after a list's: an entry's address, what a folder holds, and where it sat. */
	const addressOf = (row: TrashRow): string | undefined => {
		const parts: string[] = [];
		if (row.address) parts.push(row.address);
		if (row.kind === "folder")
			parts.push(t(row.collection === null ? "trash.holdsFiles" : "trash.holdsEntries", { count: row.holds ?? 0 }));
		// A search found it inside a thrown-away folder other than the open one: it says which. A folder still alive is named as it is.
		if (row.inTrashedFolder && row.folderId !== place?.id)
			parts.push(t("trash.inFolder", { name: row.path.at(-1) ?? "" }));
		else if (!row.inTrashedFolder && row.path.length > 0) parts.push(row.path.join(" / "));
		return parts.join(" · ") || undefined;
	};

	const menuItems = (row: TrashRow, context: boolean) => {
		const Item = context ? ContextMenuItem : DropdownMenuItem;
		const Separator = context ? ContextMenuSeparator : DropdownMenuSeparator;
		const list = context ? rowsFor(row) : [row];
		// One row's menu has an icon on each row; the picked rows' menu starts with how many they are and has none (components/menu.md).
		const several = list.length > 1;
		return (
			<>
				{several && (
					<ContextMenuGroup>
						<ContextMenuLabel>{t("list.items", { count: list.length })}</ContextMenuLabel>
					</ContextMenuGroup>
				)}
				<Item onClick={() => void restoreRows(list)}>
					{!several && <Undo aria-hidden />}
					{t("trash.restore")}
				</Item>
				<Separator />
				<Item variant="danger" onClick={() => purgeRows(list)}>
					{!several && <TrashCan aria-hidden />}
					{t("trash.purge")}
					{context && <MenuShortcut>Del</MenuShortcut>}
				</Item>
			</>
		);
	};
	const onRowKey = (row: TrashRow) => (event: KeyboardEvent<HTMLTableRowElement>) => {
		const target = event.target as HTMLElement;
		if (event.key !== "Delete" || target.closest("input, textarea, [role=menu]")) return;
		event.preventDefault();
		purgeRows(rowsFor(row));
	};

	const total = data?.total ?? 0;
	const kinds = [...Object.keys(collections), MEDIA_KIND];
	const sortedBy = (by: TrashState["sort"]["by"]) => (state.sort.by === by ? state.sort.dir : null);
	const sortBy = (by: TrashState["sort"]["by"]) => (dir: "asc" | "desc") =>
		setState({ ...state, page: 1, sort: { by, dir } });
	// As every table (components/list.md): each column's menu sorts both ways or filters by its values, and each width can be dragged.
	const head: ListHeadColumn[] = [
		{
			id: "title",
			label: t("trash.column.title"),
			sort: sortedBy("title") ?? undefined,
			menu: <SortRows dir={sortedBy("title")} onChange={sortBy("title")} />,
		},
		// As in the lists: a site written in one language has no language column.
		...(multilingual
			? [
					{
						...sized("locale", LIST_COLUMN_SIZE.locale),
						label: t("list.column.locale"),
						filtered: state.locales.length > 0,
						menu: (
							<FilterRows
								values={languages.map((locale) => ({
									value: locale,
									label: languageName(locale),
									count: data?.locales[locale] ?? 0,
								}))}
								chosen={state.locales}
								onChange={(locales) => setState({ ...state, page: 1, locales })}
							/>
						),
					},
				]
			: []),
		{
			...sized("kind", KIND_SIZE),
			label: t("trash.column.kind"),
			filtered: state.kinds.length > 0,
			menu: (
				<FilterRows
					values={kinds.map((kind) => ({ value: kind, label: kindLabel(kind), count: data?.counts[kind] ?? 0 }))}
					chosen={state.kinds}
					onChange={(next) => setState({ ...state, page: 1, kinds: next })}
				/>
			),
		},
		{
			...sized("left", LEFT_SIZE),
			label: t("trash.column.left"),
			align: "end",
			sort: sortedBy("left") ?? undefined,
			menu: (
				<SortRows
					kind="date"
					dir={sortedBy("left")}
					onChange={sortBy("left")}
					words={{ desc: t("trash.sort.newest"), asc: t("trash.sort.oldest") }}
				/>
			),
		},
	];
	const colSpan = head.length + 1;

	const inTrash = counts.data?.trash ?? 0;
	const header = (
		<PageHeader
			title={place?.name ?? t("frame.trash")}
			meta={
				!place ? undefined : place.daysLeft < URGENT_DAYS ? (
					<Text mono tone="warning">
						{t("trash.left", { days: place.daysLeft })}
					</Text>
				) : (
					t("trash.left", { days: place.daysLeft })
				)
			}
			trail={
				place ? (
					<Inline gap={4}>
						{[{ id: null, name: t("frame.trash") }, ...place.trail].map((up) => (
							<TextButton
								key={up.id ?? "top"}
								variant="underline"
								onClick={() =>
									setState({ ...state, folder: up.id, search: "", everywhere: false, page: 1, open: null })
								}
							>
								{`${up.name} /`}
							</TextButton>
						))}
					</Inline>
				) : undefined
			}
		>
			{(inTrash > 0 || looking) && (
				<SearchToggle
					label={t("list.search")}
					aria-label={t("list.search")}
					placeholder={t("list.search")}
					value={box.words}
					onValueChange={box.type}
					// Inside a folder the chip in the box says where it looks, as the lists' does.
					scopes={place ? searchScopes(place.name, t) : undefined}
					scope={state.everywhere ? "all" : "here"}
					onScopeChange={(scope) => setState({ ...state, search: box.settle(), everywhere: scope === "all", page: 1 })}
					targetLabel={t("list.searchIn")}
				/>
			)}
			{place ? (
				<>
					<TextButton onClick={() => void restore.run([{ kind: "folder", id: place.id }])}>
						{t("trash.restoreFolder")}
					</TextButton>
					<DropdownMenu>
						<IconButton label={t("trash.more")} trigger={(button) => <DropdownMenuTrigger render={button} />}>
							<OverflowMenuHorizontal aria-hidden />
						</IconButton>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								variant="danger"
								onClick={() => purge.start({ rows: [{ kind: "folder", id: place.id }] })}
							>
								<TrashCan aria-hidden />
								{t("trash.purge")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</>
			) : (
				inTrash > 0 && (
					<TextButton variant="danger" onClick={() => purge.startEmpty(inTrash)}>
						{t("trash.empty")}
					</TextButton>
				)
			)}
		</PageHeader>
	);

	// Nothing in the trash at all: one line, and no table (flow 5·28).
	if (counts.data && inTrash === 0 && !place && !looking)
		return (
			<PageColumn width="list">
				{header}
				<Empty title={t("trash.isEmpty")} />
			</PageColumn>
		);

	const panel = state.open;
	return (
		<Inline align="stretch" gap={0} grow minHeight={0}>
			<PageColumn width="list">
				{header}
				<ListScroll>
					<Table
						ref={table}
						container="none"
						layout="fixed"
						columns={[...head.map((column) => column.size), LIST_COLUMN_SIZE.end]}
					>
						{pickedRows.length > 0 ? (
							<BulkBar
								label={t("list.selected", { count: pickedRows.length })}
								selectAll={selectAll}
								clearLabel={t("list.clearSelection")}
								onClear={() => setPicked(new Set())}
								colSpan={colSpan}
							>
								<TextButton onClick={() => void restoreRows(pickedRows)}>{t("trash.restore")}</TextButton>
								<TextButton variant="danger" onClick={() => purgeRows(pickedRows)}>
									{t("trash.purge")}
								</TextButton>
							</BulkBar>
						) : (
							<ListHead
								columns={head}
								end={LIST_COLUMN_SIZE.end}
								selectAll={rows.length > 0 ? selectAll : undefined}
								onResize={resize}
								resizeLabel={(column) => t("list.resizeColumn", { column })}
							/>
						)}
						<TableBody>
							{data && rows.length === 0 && looking && (
								<NoMatchRow
									colSpan={colSpan}
									words={t("trash.noMatch")}
									onClear={() => setState({ ...state, search: "", everywhere: false, kinds: [], locales: [], page: 1 })}
								/>
							)}
							{/* The way up is the lists' first row too, beside the trail (2026-11-11, the owner). Not while it searches: those rows are from anywhere. */}
							{place && !looking && (
								<TableRow>
									<TableCell truncate>
										<RowTitle
											folder
											title={
												<RowLink
													render={<button type="button" />}
													onClick={() =>
														setState({
															...state,
															folder: place.trail.at(-1)?.id ?? null,
															search: "",
															everywhere: false,
															page: 1,
															open: null,
														})
													}
												>
													{t("folders.up")}
												</RowLink>
											}
										/>
									</TableCell>
									{head.slice(1).map((column) => (
										<TableCell key={column.id} />
									))}
									<TableCell align="end">
										<RowActions />
									</TableCell>
								</TableRow>
							)}
							{rows.map((row) => {
								const key = keyOf(row);
								const link = entryHref(row);
								// Inside a folder a row says its days only when they are not the folder's own: the head says those.
								const days = place && row.daysLeft === place.daysLeft && !row.byAssistant ? null : row.daysLeft;
								const line = (
									<TableRow
										key={key}
										selected={picked.has(key) || (panel !== null && keyOf(panel) === key)}
										onKeyDown={onRowKey(row)}
									>
										<TableCell truncate>
											<RowCheck
												checked={picked.has(key)}
												onCheckedChange={(on) => pick(row, on)}
												label={t("list.pick", { title: row.title })}
											/>
											<RowTitle
												title={
													link ? (
														<HandedRowLink href={link} listStart={listStart}>
															{row.title || t("list.untitled")}
														</HandedRowLink>
													) : (
														<HandedRowLink
															render={<button type="button" />}
															onClick={() => open(row)}
															listStart={listStart}
														>
															{row.title || t("list.untitled")}
														</HandedRowLink>
													)
												}
												address={addressOf(row)}
												folder={row.kind === "folder"}
											/>
										</TableCell>
										{multilingual && (
											<TableCell>
												{row.kind === "entry" && (
													<LocaleCodes codes={row.locales} names={row.locales.map(languageName).join(", ")} />
												)}
											</TableCell>
										)}
										<TableCell tone="subtle" truncate title={kindLabel(row.collection ?? MEDIA_KIND)}>
											{kindLabel(row.collection ?? MEDIA_KIND)}
										</TableCell>
										<TableCell align="end" truncate title={days === null ? undefined : t("trash.left", { days })}>
											{days !== null && (
												<TrashRowDate
													left={t("trash.left", { days })}
													urgent={days < URGENT_DAYS}
													byAssistant={row.byAssistant ? { label: t("trash.byAssistant") } : undefined}
												/>
											)}
										</TableCell>
										<TableCell align="end">
											{/* A row restored or deleted for good leaves the list: the focus its ⋯ held goes to the row after it. */}
											<HandedRowActions row={key} listStart={listStart}>
												<DropdownMenu>
													<RowMore
														label={t("list.rowMenu")}
														trigger={(button) => <DropdownMenuTrigger render={button} />}
													/>
													<DropdownMenuContent align="end">{menuItems(row, false)}</DropdownMenuContent>
												</DropdownMenu>
											</HandedRowActions>
										</TableCell>
									</TableRow>
								);
								return (
									<ContextMenu key={key}>
										<ContextMenuTrigger render={line} />
										<ContextMenuContent>{menuItems(row, true)}</ContextMenuContent>
									</ContextMenu>
								);
							})}
						</TableBody>
					</Table>
				</ListScroll>
				{total > TRASH_PAGE_SIZE && (
					<ListFooter>
						<Count>
							{t("list.range", {
								from: (state.page - 1) * TRASH_PAGE_SIZE + 1,
								to: Math.min(state.page * TRASH_PAGE_SIZE, total),
								total,
							})}
						</Count>
						<ListPages
							page={state.page}
							pages={Math.ceil(total / TRASH_PAGE_SIZE)}
							hrefOf={(page) => href({ screen: "trash", params: writeTrashState({ ...state, page }) })}
						/>
					</ListFooter>
				)}
			</PageColumn>
			{purge.dialog}
			{panel?.kind === "media" && (
				<TrashedFilePanel
					key={panel.id}
					id={panel.id}
					go={go}
					onClose={() => setState({ ...state, open: null })}
					onRestore={() => void restore.run([panel]).then((done) => done && close([panel]))}
					onPurge={() => purge.start({ rows: [panel], onPurged: () => close([panel]), whenGone: afterPurge([panel]) })}
				/>
			)}
			{panel?.kind === "entry" && (
				<TrashedItemPanel
					key={panel.id}
					id={panel.id}
					collectionLabel={collectionLabel}
					go={go}
					onClose={() => setState({ ...state, open: null })}
					onRestore={() => void restore.run([panel]).then((done) => done && close([panel]))}
					onPurge={() =>
						purge.start({
							rows: [panel],
							reserves: rows.find((row) => keyOf(row) === keyOf(panel))?.reserves,
							onPurged: () => close([panel]),
							whenGone: afterPurge([panel]),
						})
					}
				/>
			)}
		</Inline>
	);
}
