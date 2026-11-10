import { MEDIA_KIND, type TrashList, type TrashRef, type TrashRow } from "@monti-cms/core";
import {
	BulkBar,
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
	Count,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
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
	MenuShortcut,
	PageColumn,
	PageHeader,
	RowActions,
	RowCheck,
	RowLink,
	RowMore,
	SearchToggle,
	type SelectAll,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
	TextButton,
	TrashRowDate,
	TrashRowTitle,
} from "@monti-cms/ui";
import { OverflowMenuHorizontal } from "@monti-cms/ui/icons";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatBytes } from "../../media/file-text";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import { href, type Route } from "../../route";
import { usePurge, useRestore } from "../../trash/use-trash";
import type { FrameCounts } from "../frame/admin-frame";
import { useLanguageName } from "../list/column-menu";
import { searchScopes } from "../list/folders";
import { ListPages } from "../list/list-pages";
import { TrashedFilePanel } from "../media/media-panel";
import { readTrashState, TRASH_PAGE_SIZE, type TrashState, trashQueryOf, writeTrashState } from "./trash-query";
import { TrashedItemPanel } from "./trashed-item-panel";

type SchemaRead = {
	schema: {
		collections: Record<string, { kind: "document" | "item" }>;
		locales: { source: string; list: { code: string }[] };
	};
	adminValues: Record<string, { label?: string }>;
};

/** The widths of the trash's own columns, of the lists' kinds (screens/trash.md): what a row is (one value), and how long it stays (a short mono line). */
const KIND_SIZE = LIST_COLUMN_SIZE.one;
const LEFT_SIZE = LIST_COLUMN_SIZE.measure;
/** Under a week left, the days turn to the warning tone (doc 11). */
const URGENT_DAYS = 7;

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
	const languageName = useLanguageName();
	const state = useMemo(() => readTrashState(params), [params]);
	const setState = (next: TrashState, options?: { replace?: boolean }) =>
		go({ screen: "trash", params: writeTrashState(next) }, options);
	const schema = useRead<SchemaRead>("schema.read");
	const counts = useRead<FrameCounts>("frame.counts", {}, { afterWrites: true });
	const read = useRead<TrashList>("trash.list", trashQueryOf(state), { afterWrites: true });
	const data = read.data;
	const rows = data?.rows ?? [];
	const place = state.folder ? (data?.place ?? null) : null;
	const searching = state.search.trim() !== "";
	const looking = searching || state.kinds.length > 0;

	// The open folder left the trash (restored, or deleted for good): the trash itself is what is left to show.
	const gone = state.folder !== null && read.refusal?.reason?.key === "trash.unknown";
	useEffect(() => {
		if (gone) go({ screen: "trash", params: new URLSearchParams() }, { replace: true });
	}, [gone, go]);

	// The search box keeps its words while they are typed; the address follows a moment later, in place.
	const [words, setWords] = useState(state.search);
	const typing = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => setWords(state.search), [state.search]);
	const search = (text: string) => {
		setWords(text);
		if (typing.current) clearTimeout(typing.current);
		typing.current = setTimeout(
			() =>
				setState(
					{ ...state, search: text, everywhere: text.trim() === "" ? false : state.everywhere, page: 1 },
					{ replace: true },
				),
			250,
		);
	};

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
	const sourceLocale = schema.data?.schema.locales.source;
	const multilingual = (schema.data?.schema.locales.list.length ?? 0) > 1;
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
	const purgeRows = (list: TrashRow[]) =>
		purge.start({
			rows: list.map(refOf),
			reserves: list.flatMap((row) => row.reserves),
			onPurged: () => close(list),
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

	/** A row's second line: what it holds, or what stops it from coming back alone. */
	const metaOf = (row: TrashRow): { text: string; tone: "default" | "warning" } => {
		if (row.source) return { text: t("trash.sourceTrashed"), tone: "warning" };
		const parts: string[] = [];
		// A search found it inside a thrown-away folder other than the open one: it says which.
		const inside = row.inTrashedFolder && row.folderId !== place?.id;
		if (inside) parts.push(t("trash.inFolder", { name: row.path.at(-1) ?? "" }));
		const where = inside || row.path.length === 0 || row.inTrashedFolder ? null : row.path.join(" / ");
		if (row.kind === "entry") {
			const [own] = row.locales;
			if (isDocument(row) && own && own !== sourceLocale && row.locales.length === 1)
				parts.push(t("trash.translationOf", { language: languageName(own) }));
			else if (multilingual && (isDocument(row) || row.locales.length > 1))
				parts.push(row.locales.map((locale) => locale.toUpperCase()).join(" · "));
		} else if (row.kind === "folder") {
			parts.push(t(row.collection === null ? "trash.holdsFiles" : "trash.holdsEntries", { count: row.holds ?? 0 }));
		} else if (row.file) {
			parts.push(t(`trash.file.${row.file.kind}`), formatBytes(row.file.size));
		}
		if (where) parts.push(where);
		return { text: parts.join(" · "), tone: "default" };
	};

	const menuItems = (row: TrashRow, context: boolean) => {
		const Item = context ? ContextMenuItem : DropdownMenuItem;
		const Separator = context ? ContextMenuSeparator : DropdownMenuSeparator;
		const list = context ? rowsFor(row) : [row];
		return (
			<>
				<Item onClick={() => void restoreRows(list)}>
					{t(list.length === 1 && row.source ? "trash.restoreSource" : "trash.restore")}
				</Item>
				<Separator />
				<Item variant="danger" onClick={() => purgeRows(list)}>
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
	const head: ListHeadColumn[] = [
		{ id: "title", label: t("trash.column.title") },
		{
			id: "kind",
			label: t("trash.column.kind"),
			size: KIND_SIZE,
			filtered: state.kinds.length > 0,
			menu: (
				<>
					{kinds.map((kind) => (
						<DropdownMenuCheckboxItem
							key={kind}
							box
							closeOnClick={false}
							checked={state.kinds.includes(kind)}
							onCheckedChange={() =>
								setState({
									...state,
									page: 1,
									kinds: state.kinds.includes(kind)
										? state.kinds.filter((each) => each !== kind)
										: [...state.kinds, kind],
								})
							}
						>
							{kindLabel(kind)}
							<MenuShortcut>{data?.counts[kind] ?? 0}</MenuShortcut>
						</DropdownMenuCheckboxItem>
					))}
				</>
			),
		},
		{
			id: "left",
			label: t("trash.column.left"),
			size: LEFT_SIZE,
			align: "end",
			sort: state.sort === "newest" ? "desc" : "asc",
			menu: (
				<DropdownMenuRadioGroup
					value={state.sort}
					onValueChange={(sort) => setState({ ...state, page: 1, sort: sort === "oldest" ? "oldest" : "newest" })}
				>
					<DropdownMenuRadioItem value="newest">{t("trash.sort.newest")}</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="oldest">{t("trash.sort.oldest")}</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			),
		},
	];
	const colSpan = head.length + 1;

	const inTrash = counts.data?.trash ?? 0;
	const header = (
		<PageHeader
			title={place?.name ?? t("frame.trash")}
			meta={place ? t("trash.left", { days: place.daysLeft }) : undefined}
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
					value={words}
					onValueChange={search}
					// Inside a folder the chip in the box says where it looks, as the lists' does.
					scopes={place ? searchScopes(place.name, t) : undefined}
					scope={state.everywhere ? "all" : "here"}
					onScopeChange={(scope) => {
						if (typing.current) clearTimeout(typing.current);
						setState({ ...state, search: words, everywhere: scope === "all", page: 1 });
					}}
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
					<Table container="none" layout="fixed" columns={[undefined, KIND_SIZE, LEFT_SIZE, LIST_COLUMN_SIZE.end]}>
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
							<ListHead columns={head} end={LIST_COLUMN_SIZE.end} selectAll={rows.length > 0 ? selectAll : undefined} />
						)}
						<TableBody>
							{data && rows.length === 0 && looking && (
								<TableRow>
									<TableCell colSpan={colSpan}>
										<Inline gap={12}>
											<Text tone="subtle">{t("trash.noMatch")}</Text>
											<TextButton
												onClick={() => setState({ ...state, search: "", everywhere: false, kinds: [], page: 1 })}
											>
												{t("list.clearFilters")}
											</TextButton>
										</Inline>
									</TableCell>
								</TableRow>
							)}
							{rows.map((row) => {
								const meta = metaOf(row);
								const key = keyOf(row);
								const link = entryHref(row);
								// Inside a folder a row says its days only when they are not the folder's own: the head says those.
								const days = place && row.daysLeft === place.daysLeft && !row.byAssistant ? null : row.daysLeft;
								const line = (
									<TableRow
										key={key}
										twoLine
										selected={picked.has(key) || (panel !== null && keyOf(panel) === key)}
										onKeyDown={onRowKey(row)}
									>
										<TableCell truncate>
											<RowCheck
												checked={picked.has(key)}
												onCheckedChange={(on) => pick(row, on)}
												label={t("list.pick", { title: row.title })}
											/>
											<TrashRowTitle
												title={
													link ? (
														<RowLink href={link}>{row.title || t("list.untitled")}</RowLink>
													) : (
														<RowLink render={<button type="button" />} onClick={() => open(row)}>
															{row.title || t("list.untitled")}
														</RowLink>
													)
												}
												address={row.address ?? undefined}
												folder={row.kind === "folder"}
												meta={meta.text}
												metaTone={meta.tone}
											/>
										</TableCell>
										<TableCell tone="subtle" truncate>
											{kindLabel(row.collection ?? MEDIA_KIND)}
										</TableCell>
										<TableCell align="end">
											{days !== null && (
												<TrashRowDate
													left={t("trash.left", { days })}
													urgent={days < URGENT_DAYS}
													byAssistant={row.byAssistant ? { label: t("trash.byAssistant") } : undefined}
												/>
											)}
										</TableCell>
										<TableCell align="end">
											<RowActions>
												<DropdownMenu>
													<RowMore
														label={t("list.rowMenu")}
														trigger={(button) => <DropdownMenuTrigger render={button} />}
													/>
													<DropdownMenuContent align="end">{menuItems(row, false)}</DropdownMenuContent>
												</DropdownMenu>
											</RowActions>
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
					onPurge={() => purge.start({ rows: [panel], onPurged: () => close([panel]) })}
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
						})
					}
				/>
			)}
		</Inline>
	);
}
