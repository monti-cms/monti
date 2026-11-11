import {
	type FolderNode,
	type MediaItem,
	type MediaKind,
	type MediaQueryResult,
	mediaSortStart,
} from "@monti-cms/core";
import {
	BulkBar,
	Button,
	Caret,
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
	Count,
	DropArea,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	FilePreview,
	FilterButton,
	FolderTile,
	Grid,
	IconButton,
	Image,
	Inline,
	LIST_COLUMN_SIZE,
	ListHead,
	type ListHeadColumn,
	ListScroll,
	MenuShortcut,
	PageColumn,
	PageHeader,
	PageToolbar,
	PageToolbarEnd,
	RenameField,
	RowActions,
	RowCheck,
	RowLink,
	RowMore,
	RowThumb,
	RowTitle,
	SearchToggle,
	Segmented,
	type SelectAll,
	SplitButton,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
	TextButton,
	Tile,
	toast,
} from "@monti-cms/ui";
import {
	Document,
	Folder,
	FolderAdd,
	Information,
	OverflowMenuHorizontal,
	TrashCan,
	Upload as UploadIcon,
} from "@monti-cms/ui/icons";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useLeave } from "../../draft/leave-guard";
import { chooseFiles } from "../../media/choose-files";
import { FileThumb, useFileDetail } from "../../media/file-shown";
import { extensionLabel, formatBytes, previewUrl, sizeLabel } from "../../media/file-text";
import { useTakeFolderFiles } from "../../media/folder-files";
import { RetryButton, useAcceptFiles } from "../../media/upload-problem";
import type { Upload } from "../../media/upload-queue";
import { MEDIA_DRAG, useFileDrop, useFolderDrop, useKeepFilesInPage } from "../../media/use-file-drop";
import { useMoveMedia, useTrashMedia } from "../../media/use-media-actions";
import { useUpload } from "../../media/use-upload";
import { useAdmin } from "../../operations/admin-context";
import { useOperation, useRead } from "../../operations/use-operation";
import { href, type Route } from "../../route";
import { type FilterProps, FilterRows } from "../list/filter-rows";
import {
	FolderMenuItems,
	FolderTargets,
	MoveToFolderMenu,
	searchScopes,
	useFolderNaming,
	useFolders,
	useRemoveFolder,
} from "../list/folders";
import { shortDate } from "../list/format";
import { ListPages } from "../list/list-pages";
import { SortRows } from "../list/sort-rows";
import { useColumnWidths } from "../list/use-column-widths";
import { MediaPanel, useFileUses } from "./media-panel";
import {
	isLooking,
	KINDS,
	type MediaState,
	queryOf,
	readMediaState,
	SORTS,
	type Sort,
	USES,
	writeMediaState,
} from "./media-query";

const DROP_HINT = "media-drop";
const CONNECT_DOCS = "https://github.com/monti-cms/monti#media-storage";

type Go = (route: Route, options?: { replace?: boolean }) => void;

/** A file on its way up, in its place in the grid: its bar and turn, or the buttons of one the network cut off (flow 6·03, 6·04, 6·34). */
function UploadTile({
	upload,
	onRemove,
	onRetry,
}: {
	upload: Upload;
	onRemove: (upload: Upload) => void;
	onRetry: (upload: Upload) => void;
}) {
	const { t } = useAdmin();
	const picture = upload.preview ? <Image src={upload.preview} alt="" ratio="photo" radius="none" /> : null;
	if (upload.status === "failed")
		return (
			<Tile
				status="failed"
				title={upload.name}
				detail={t("library.failed")}
				// With no picture the button stands alone: the name says what the file is.
				preview={picture}
				retry={<RetryButton onRetry={() => onRetry(upload)} />}
				action={
					<IconButton label={t("library.takeOut")} size="xs" tone="danger" onClick={() => onRemove(upload)}>
						<TrashCan aria-hidden />
					</IconButton>
				}
			/>
		);
	return (
		<Tile
			status="uploading"
			title={upload.name}
			progress={upload.status === "uploading" ? upload.progress : undefined}
			detail={
				upload.status === "uploading" ? t("library.uploading", { percent: upload.progress }) : t("library.waiting")
			}
			preview={picture ?? <FilePreview ext={extensionLabel(upload.name)} />}
		/>
	);
}

/** The same file as a row of the list view: where it is going, or what to do with one the network cut off (T113). */
function UploadRow({
	upload,
	columns,
	onRemove,
	onRetry,
}: {
	upload: Upload;
	/** How many columns lie between the name and the end. */
	columns: number;
	onRemove: (upload: Upload) => void;
	onRetry: (upload: Upload) => void;
}) {
	const { t } = useAdmin();
	const failed = upload.status === "failed";
	return (
		<TableRow>
			<TableCell truncate>
				<RowTitle
					thumb={
						<RowThumb>
							<Image src={upload.preview ?? null} fallback={Document} alt="" size="row" ratio="photo" radius="sm" />
						</RowThumb>
					}
					title={upload.name}
				/>
			</TableCell>
			<TableCell colSpan={columns}>
				<Inline gap={8}>
					<Text variant="note" tone={failed ? "danger" : "subtle"}>
						{failed
							? t("library.failed")
							: upload.status === "uploading"
								? t("library.uploading", { percent: upload.progress })
								: t("library.waiting")}
					</Text>
					{failed && (
						<RowActions>
							<RetryButton size="xs" onRetry={() => onRetry(upload)} />
						</RowActions>
					)}
				</Inline>
			</TableCell>
			<TableCell>
				{failed && (
					<RowActions>
						<IconButton label={t("library.takeOut")} size="xs" tone="danger" onClick={() => onRemove(upload)}>
							<TrashCan aria-hidden />
						</IconButton>
					</RowActions>
				)}
			</TableCell>
		</TableRow>
	);
}

/** A folder as a place to drop on, in the grid or the list: files from outside go up into it, tiles move into it, and the hint at the bottom names it while they are over it. */
function useMediaFolderDrop({
	folder,
	onFiles,
	onMove,
	onTarget,
}: {
	folder: FolderNode;
	onFiles: (files: File[]) => void;
	onMove: (ids: string[]) => void;
	onTarget: (name: string | null) => void;
}) {
	const drop = useFolderDrop({ onFiles, onMove });
	// Only files from outside: tiles moved into a folder are not going up.
	useEffect(() => {
		if (!drop.files) return;
		onTarget(folder.name);
		return () => onTarget(null);
	}, [drop.files, folder.name, onTarget]);
	return drop;
}

/** A folder's row in the list view: it takes files and tiles as its tile does in the grid (T106), and has the folder's menu on a right click. */
function MediaFolderRow({
	menu,
	children,
	...folderDrop
}: Parameters<typeof useMediaFolderDrop>[0] & {
	/** The rows of the folder's right-click menu. */
	menu: React.ReactNode;
	children: React.ReactNode;
}) {
	const drop = useMediaFolderDrop(folderDrop);
	return (
		<ContextMenu>
			<ContextMenuTrigger
				render={
					<TableRow dropTarget={drop.target} {...drop.handlers}>
						{children}
					</TableRow>
				}
			/>
			<ContextMenuContent>{menu}</ContextMenuContent>
		</ContextMenu>
	);
}

/** A folder in the grid: opens, and takes files from outside and tiles from the library (flow 6·02, T99). */
function MediaFolderTile({
	folder,
	name,
	selected,
	onOpen,
	onFiles,
	onMove,
	onTarget,
	...rest
}: {
	folder: FolderNode;
	name?: React.ReactNode;
	selected?: boolean;
	onOpen: () => void;
	onFiles: (files: File[]) => void;
	onMove: (ids: string[]) => void;
	onTarget: (name: string | null) => void;
}) {
	const drop = useMediaFolderDrop({ folder, onFiles, onMove, onTarget });
	return (
		<FolderTile
			{...rest}
			name={name ?? folder.name}
			count={folder.count}
			selected={selected}
			dropTarget={drop.target}
			onClick={onOpen}
			{...drop.handlers}
		/>
	);
}

/** The rows of a file's menu, from a right click or its ⋯ (flow 6·17): open, where it is used ▸, to a folder ▸. */
function FileMenuItems({
	context,
	item,
	folders,
	onOpen,
	onMove,
	go,
}: {
	context: boolean;
	item: MediaItem;
	folders: ReturnType<typeof useFolders>;
	onOpen: () => void;
	onMove: (folder: string | null) => void;
	go: Go;
}) {
	const { t } = useAdmin();
	const Item = context ? ContextMenuItem : DropdownMenuItem;
	const Sub = context ? ContextMenuSub : DropdownMenuSub;
	const Trigger = context ? ContextMenuSubTrigger : DropdownMenuSubTrigger;
	const Content = context ? ContextMenuSubContent : DropdownMenuSubContent;
	return (
		<>
			{/* It opens the file's panel beside the list, not another screen (2026-11-10, owner). */}
			<Item onClick={onOpen}>
				<Information aria-hidden />
				{t("library.details")}
			</Item>
			{item.uses > 0 && (
				<Sub>
					<Trigger>{t("library.uses")}</Trigger>
					<Content>
						<FileUsesRows context={context} id={item.id} go={go} />
					</Content>
				</Sub>
			)}
			<MoveToFolderMenu
				context={context}
				label={t("folders.to")}
				folders={folders}
				current={item.folderId}
				onPick={onMove}
			/>
		</>
	);
}

/** "Where it is used ▸": each entry or template, with the place in it at the end (flow 6·17). */
function FileUsesRows({ context, id, go }: { context: boolean; id: string; go: Go }) {
	const uses = useFileUses(id);
	const Item = context ? ContextMenuItem : DropdownMenuItem;
	return (
		<>
			{uses.map((use) => (
				<Item key={use.key} onClick={() => go(use.route)}>
					{use.title}
					<MenuShortcut>{use.places}</MenuShortcut>
				</Item>
			))}
		</>
	);
}

/**
 * A filter of the library (screens/media.md): in the grid, a button over the tiles with a dot after its name while something is chosen; in the list, the menu of its
 * column, as the entries' list has it. The menu stays open as values are ticked.
 */
function FilterMenu<Value extends string>({ label, ...filter }: FilterProps<Value> & { label: string }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<FilterButton dot={filter.chosen.length > 0} />}>{label}</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<FilterRows {...filter} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** A cell of the list that holds a short mono value (a type, a size). */
function MetaCell({ value }: { value: string }) {
	return (
		<TableCell truncate title={value}>
			<Text variant="meta" tone="subtle">
				{value}
			</Text>
		</TableCell>
	);
}

/**
 * The media library (doc 09, flow 6, screens/media.md): its folders and files, what goes up, what is picked, and the file open beside it. Everything about where it is
 * sits in the address.
 */
export function MediaScreen({ params, go }: { params: URLSearchParams; go: Go }) {
	const leave = useLeave();
	// A move out of the library: files on their way would stop, so it asks. Moves inside it go on `go` itself.
	const goAway: Go = (route, options) => leave(() => go(route, options));
	const { t } = useAdmin();
	const state = useMemo(() => readMediaState(params), [params]);
	const setState = (next: MediaState, options?: { replace?: boolean }) =>
		go({ screen: "media", params: writeMediaState(next) }, options);
	const hrefOf = (next: MediaState) => href({ screen: "media", params: writeMediaState(next) });
	const read = useRead<MediaQueryResult>("media.query", queryOf(state), { afterWrites: true });
	const folders = useFolders("media", true);
	const upload = useUpload();
	const move = useMoveMedia();
	const moveFolder = useOperation("folders.move");
	const openFile = (id: string) => setState({ ...state, file: id });
	const trash = useTrashMedia(openFile);
	const naming = useFolderNaming("media", state.folder);
	const removeFolder = useRemoveFolder({
		onKept: (folder) => setState({ ...state, folder: folder.id, file: null, page: 1 }),
	});
	const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
	const pick = (id: string, on: boolean) => {
		const next = new Set(picked);
		if (on) next.add(id);
		else next.delete(id);
		setPicked(next);
	};
	const { sized, resize } = useColumnWidths("media");
	const [folderTarget, setFolderTarget] = useState<string | null>(null);

	const data = read.data;
	const items = data?.items ?? [];
	const storage = data?.storage ?? true;
	const looking = isLooking(state);
	const here = state.folder ? folders.byId.get(state.folder) : undefined;
	const childFolders = looking ? [] : folders.children(state.folder);
	const pickedItems = items.filter((item) => picked.has(item.id));
	const picking = pickedItems.length > 0;
	const openPath = useMemo(
		() => (here && !state.everywhere ? folders.path(here.id).map((up) => up.name) : []),
		[here, state.everywhere, folders],
	);
	const detail = useFileDetail(looking, openPath);
	const canNewFolder = !looking && !picking;
	const dense = state.file !== null;

	const goFolder = (folder: string | null) => {
		setPicked(new Set());
		setState({ ...state, folder, search: "", everywhere: false, kinds: [], used: [], page: 1, file: null });
	};
	const acceptFiles = useAcceptFiles();
	const addFiles = (files: File[], folder = state.folder) =>
		void acceptFiles(files).then((taken) => upload.add(taken, folder));
	const areaDrop = useFileDrop((files) => addFiles(files));
	// The sidebar's folder rows are outside this screen: files dropped on one come here to go up (T106). Not before the library has said it has a storage: with none nothing can go up, so they take none.
	useTakeFolderFiles(
		data && storage ? { over: setFolderTarget, files: (files, folder) => addFiles(files, folder) } : null,
	);
	useKeepFilesInPage();

	// The hint at the bottom says where files would land: the folder they are over, or this place (flow 6·01, 6·02).
	useEffect(() => {
		if (folderTarget) {
			const [before, after] = t("library.dropInto", { name: "\u0000" }).split("\u0000");
			toast.dropHint(
				<>
					{before}
					<b>{folderTarget}</b>
					{after}
				</>,
				{ id: DROP_HINT },
			);
		} else if (areaDrop.over) toast.dropHint(t("library.dropHere"), { id: DROP_HINT });
		else toast.dismiss(DROP_HINT);
	}, [folderTarget, areaDrop.over, t]);
	useEffect(() => () => void toast.dismiss(DROP_HINT), []);

	const uploadButton = (
		<SplitButton
			onClick={() => chooseFiles({ onFiles: (files) => addFiles(files) })}
			menuLabel={t("list.moreNew")}
			menu={
				canNewFolder && (
					<DropdownMenuItem onClick={() => naming.start()}>
						<FolderAdd aria-hidden />
						{t("folders.new")}
					</DropdownMenuItem>
				)
			}
		>
			<UploadIcon aria-hidden />
			{t("library.upload")}
		</SplitButton>
	);
	const trail = here ? (
		<Inline as="nav" gap={6} aria-label={t("library.path")}>
			{[{ id: null, name: t("frame.media") }, ...folders.path(here.id).slice(0, -1)].map((up) => (
				<Fragment key={up.id ?? "top"}>
					<TextButton variant="underline" onClick={() => goFolder(up.id)}>
						{up.name}
					</TextButton>
					<span aria-hidden="true">/</span>
				</Fragment>
			))}
		</Inline>
	) : undefined;

	if (data && !storage)
		return (
			<PageColumn width="list">
				<PageHeader title={t("frame.media")}>
					<Button variant="primary" href={CONNECT_DOCS} target="_blank" rel="noreferrer">
						{t("library.connect")}
					</Button>
				</PageHeader>
				<Stack gap={4} paddingTop={24} paddingX={12}>
					<Text weight="semibold">{t("library.noStorage")}</Text>
					<Text variant="note" tone="subtle">
						{t("library.noStorageNote")}
					</Text>
				</Stack>
			</PageColumn>
		);

	const namingField = (fill: boolean) => (
		<RenameField
			fill={fill}
			value={naming.naming?.name ?? ""}
			onValueChange={naming.type}
			onCommit={(value) => void naming.keep(value)}
			onCancel={naming.cancel}
			label={t("folders.name")}
		/>
	);
	const folderItems = (context: boolean, folder: FolderNode) => (
		<FolderMenuItems
			context={context}
			folder={folder}
			folders={folders}
			onOpen={() => goFolder(folder.id)}
			onRename={() => naming.start(folder)}
			onMove={(parent) => void moveFolder.run({ id: folder.id, parentId: parent })}
			onRemove={() => removeFolder.start(folder)}
		/>
	);
	const fileItems = (context: boolean, item: MediaItem) => (
		<FileMenuItems
			context={context}
			item={item}
			folders={folders}
			onOpen={() => openFile(item.id)}
			onMove={(folder) => void move([item.id], folder)}
			go={goAway}
		/>
	);
	const idsOfDrag = (item: MediaItem) => (picked.has(item.id) ? pickedItems.map((each) => each.id) : [item.id]);
	const selectAll: SelectAll = {
		state: pickedItems.length === 0 ? "none" : pickedItems.length === items.length ? "all" : "some",
		onChange: (on) => setPicked(new Set(on ? items.map((item) => item.id) : [])),
		label: t("list.selectAll"),
	};
	const inOneFolder = pickedItems.every((item) => item.folderId === pickedItems[0]?.folderId);

	const bulkBar = (colSpan?: number) => (
		<BulkBar
			colSpan={colSpan}
			label={t("list.selected", { count: pickedItems.length })}
			selectAll={selectAll}
			clearLabel={t("list.clearSelection")}
			onClear={() => setPicked(new Set())}
		>
			<DropdownMenu>
				<DropdownMenuTrigger render={<TextButton />}>
					{t("folders.to")}
					<Caret />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					<FolderTargets
						context={false}
						folders={folders}
						current={inOneFolder ? pickedItems[0]?.folderId : undefined}
						onPick={(folder) => {
							void move(
								pickedItems.map((item) => item.id),
								folder,
							).then((moved) => moved && setPicked(new Set()));
						}}
					/>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={() => naming.start()}>{`+ ${t("folders.new")}`}</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<TextButton
				onClick={() => {
					void trash(pickedItems.map((item) => item.id));
					setPicked(new Set());
				}}
			>
				{t("trash.toTrash")}
			</TextButton>
		</BulkBar>
	);
	const listed = state.view === "list";
	const kindFilter: FilterProps<MediaKind> = {
		values: KINDS.map((kind: MediaKind) => ({
			value: kind,
			label: t(`library.kind.${kind}`),
			count: data?.counts[kind] ?? 0,
		})),
		chosen: state.kinds,
		onChange: (kinds) => setState({ ...state, kinds, page: 1 }),
	};
	const usedFilter: FilterProps<(typeof USES)[number]> = {
		values: USES.map((use) => ({ value: use, label: t(`library.used.${use}`), count: data?.counts[use] ?? 0 })),
		chosen: state.used,
		onChange: (used) => setState({ ...state, used, page: 1 }),
	};
	/** What the library is ordered by, in the words of the list's columns. */
	const sortLabel = (sort: Sort) =>
		t(sort === "name" ? "library.column.name" : sort === "size" ? "library.column.size" : "library.column.date");
	const usesLabel = (item: { uses: number }) =>
		item.uses > 0 ? t("library.usedBy", { count: item.uses }) : t("library.notUsed");
	/** A column's two ways (components/list.md): the rows of its menu. */
	const sortRows = (sort: Sort) => (
		<SortRows
			kind={sort === "uploaded" ? "date" : "value"}
			dir={state.sort === sort ? state.dir : null}
			onChange={(dir) => setState({ ...state, sort, dir, page: 1 })}
		/>
	);
	/** Every order in one menu, where there are no columns to hold them (the grid, the list beside an open file): what it is ordered by, then which way. */
	const everySort = (
		<>
			<DropdownMenuRadioGroup
				value={state.sort}
				onValueChange={(sort) => {
					const found = SORTS.find((known) => known === sort);
					if (found) setState({ ...state, sort: found, dir: mediaSortStart(found), page: 1 });
				}}
			>
				{SORTS.map((sort) => (
					<DropdownMenuRadioItem key={sort} value={sort}>
						{sortLabel(sort)}
					</DropdownMenuRadioItem>
				))}
			</DropdownMenuRadioGroup>
			<DropdownMenuSeparator />
			{sortRows(state.sort)}
		</>
	);
	const dirLabel = t(
		state.sort === "uploaded"
			? state.dir === "desc"
				? "list.newest"
				: "list.oldest"
			: state.dir === "asc"
				? "list.sortAsc"
				: "list.sortDesc",
	);
	// One row under the title, as the entries' list has it (2026-11-10, owner): in the grid the filters and the order, the picks taking their place; in the list the
	// columns' names, their menus holding the filters and the order.
	const toolbar = listed ? null : picking ? (
		bulkBar()
	) : (
		<PageToolbar inset>
			<FilterMenu label={t("library.kind")} {...kindFilter} />
			<FilterMenu label={t("library.used")} {...usedFilter} />
			<PageToolbarEnd>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<FilterButton />}
					>{`${sortLabel(state.sort)} · ${dirLabel}`}</DropdownMenuTrigger>
					<DropdownMenuContent align="end">{everySort}</DropdownMenuContent>
				</DropdownMenu>
			</PageToolbarEnd>
		</PageToolbar>
	);

	const uploadsHere = upload.uploads.filter((each) => each.folder === state.folder);
	const nothing =
		data !== null && items.length === 0 && childFolders.length === 0 && uploadsHere.length === 0 && !naming.naming;
	const grid = (
		<Stack gap={24}>
			{(childFolders.length > 0 || naming.naming?.id === null) && (
				<Grid columns="folders" dense={dense}>
					{childFolders.map((folder) => (
						<ContextMenu key={folder.id}>
							{naming.naming?.id === folder.id ? (
								<FolderTile>{namingField(true)}</FolderTile>
							) : (
								<ContextMenuTrigger
									render={
										<MediaFolderTile
											folder={folder}
											onOpen={() => goFolder(folder.id)}
											onFiles={(files) => addFiles(files, folder.id)}
											onMove={(ids) => void move(ids, folder.id).then(() => setPicked(new Set()))}
											onTarget={setFolderTarget}
										/>
									}
								/>
							)}
							<ContextMenuContent>{folderItems(true, folder)}</ContextMenuContent>
						</ContextMenu>
					))}
					{naming.naming?.id === null && <FolderTile>{namingField(true)}</FolderTile>}
				</Grid>
			)}
			{(items.length > 0 || uploadsHere.length > 0) && (
				<Grid columns="tiles" dense={dense}>
					{uploadsHere.map((each) => (
						<UploadTile key={each.id} upload={each} onRemove={upload.remove} onRetry={upload.retry} />
					))}
					{items.map((item) => (
						<ContextMenu key={item.id}>
							<ContextMenuTrigger
								render={
									<Tile
										title={item.name}
										detail={detail(item)}
										preview={<FileThumb item={item} />}
										current={state.file === item.id}
										selected={picked.has(item.id)}
										picking={picking}
										selectLabel={t("list.pick", { title: item.name })}
										onSelectedChange={(on) => pick(item.id, on)}
										action={
											<DropdownMenu>
												<IconButton
													label={t("library.more")}
													size="xs"
													trigger={(button) => <DropdownMenuTrigger render={button} />}
												>
													<OverflowMenuHorizontal aria-hidden />
												</IconButton>
												<DropdownMenuContent align="end">{fileItems(false, item)}</DropdownMenuContent>
											</DropdownMenu>
										}
										draggable
										onDragStart={(event: React.DragEvent) => {
											event.dataTransfer.setData(MEDIA_DRAG, JSON.stringify(idsOfDrag(item)));
											event.dataTransfer.effectAllowed = "move";
										}}
										onClick={() => openFile(item.id)}
										onKeyDown={(event: React.KeyboardEvent) => {
											if (event.key !== "Delete" && event.key !== "Backspace") return;
											event.preventDefault();
											void trash(idsOfDrag(item));
											setPicked(new Set());
										}}
									/>
								}
							/>
							<ContextMenuContent>{fileItems(true, item)}</ContextMenuContent>
						</ContextMenu>
					))}
				</Grid>
			)}
			{nothing && (
				<Text variant="note" tone="subtle">
					{looking ? t("library.nothingFound") : t("library.empty")}
				</Text>
			)}
		</Stack>
	);
	// With a file open beside the list there is room for its name and when: the panel says the rest of the open file.
	const nameColumn: ListHeadColumn = {
		id: "name",
		label: t("library.column.name"),
		sort: state.sort === "name" ? state.dir : undefined,
		// With a file open beside the list its other columns step aside: the name's menu keeps their filters and every order within reach.
		filtered: dense && (state.kinds.length > 0 || state.used.length > 0),
		menu: dense ? (
			<>
				{everySort}
				<DropdownMenuSeparator />
				<FilterRows {...kindFilter} />
				<DropdownMenuSeparator />
				<FilterRows {...usedFilter} />
			</>
		) : (
			sortRows("name")
		),
	};
	const dateColumn: ListHeadColumn = {
		...(dense ? { id: "date", size: LIST_COLUMN_SIZE.date } : sized("date", LIST_COLUMN_SIZE.date)),
		label: t("library.column.date"),
		align: "end",
		sort: state.sort === "uploaded" ? state.dir : undefined,
		menu: sortRows("uploaded"),
	};
	const head: ListHeadColumn[] = dense
		? [nameColumn, dateColumn]
		: [
				nameColumn,
				{
					...sized("uses", LIST_COLUMN_SIZE.one),
					label: t("library.column.uses"),
					filtered: state.used.length > 0,
					menu: <FilterRows {...usedFilter} />,
				},
				{
					...sized("type", LIST_COLUMN_SIZE.locale),
					label: t("library.column.type"),
					filtered: state.kinds.length > 0,
					menu: <FilterRows {...kindFilter} />,
				},
				{
					...sized("size", LIST_COLUMN_SIZE.status),
					label: t("library.column.size"),
					sort: state.sort === "size" ? state.dir : undefined,
					menu: sortRows("size"),
				},
				{ ...sized("measure", LIST_COLUMN_SIZE.measure), label: t("library.column.measure") },
				dateColumn,
			];
	const folderThumb = (
		<RowThumb>
			<Folder aria-hidden size={16} />
		</RowThumb>
	);
	const table = (
		<ListScroll>
			<Table container="none" layout="fixed" columns={[...head.map((column) => column.size), LIST_COLUMN_SIZE.end]}>
				{picking ? (
					bulkBar(head.length + 1)
				) : (
					<ListHead
						columns={head}
						end={LIST_COLUMN_SIZE.end}
						selectAll={items.length > 0 ? selectAll : undefined}
						onResize={resize}
						resizeLabel={(column) => t("list.resizeColumn", { column })}
					/>
				)}
				<TableBody>
					{naming.naming?.id === null && (
						<TableRow>
							<TableCell colSpan={head.length + 1}>
								<RowTitle editing thumb={folderThumb} title={namingField(false)} />
							</TableCell>
						</TableRow>
					)}
					{childFolders.map((folder) => (
						<MediaFolderRow
							key={folder.id}
							folder={folder}
							onFiles={(files) => addFiles(files, folder.id)}
							onMove={(ids) => void move(ids, folder.id)}
							onTarget={setFolderTarget}
							menu={folderItems(true, folder)}
						>
							<TableCell colSpan={head.length + 1} truncate={naming.naming?.id !== folder.id}>
								{naming.naming?.id === folder.id ? (
									<RowTitle editing thumb={folderThumb} title={namingField(false)} />
								) : (
									<RowTitle
										thumb={folderThumb}
										title={
											<RowLink
												href={hrefOf({ ...state, folder: folder.id, page: 1, file: null })}
												onClick={() => setPicked(new Set())}
											>
												{folder.name}
											</RowLink>
										}
										address={<Count>{folder.count}</Count>}
										addressTitle={String(folder.count)}
									/>
								)}
							</TableCell>
						</MediaFolderRow>
					))}
					{uploadsHere.map((each) => (
						<UploadRow
							key={each.id}
							upload={each}
							columns={head.length - 1}
							onRemove={upload.remove}
							onRetry={upload.retry}
						/>
					))}
					{items.map((item) => (
						<ContextMenu key={item.id}>
							<ContextMenuTrigger
								render={
									<TableRow selected={state.file === item.id || picked.has(item.id)}>
										<TableCell truncate>
											<RowCheck
												checked={picked.has(item.id)}
												onCheckedChange={(on) => pick(item.id, on)}
												label={t("list.pick", { title: item.name })}
											/>
											<RowTitle
												thumb={
													<RowThumb>
														<Image
															src={item.kind === "image" ? previewUrl(item) : null}
															fallback={Document}
															alt=""
															size="row"
															ratio="photo"
															radius="sm"
														/>
													</RowThumb>
												}
												title={<RowLink href={hrefOf({ ...state, file: item.id })}>{item.name}</RowLink>}
											/>
										</TableCell>
										{!dense && (
											<>
												{/* A narrowed column cuts its value with "…", and the cell's title says it whole (components/list.md). */}
												<TableCell tone="subtle" truncate title={usesLabel(item)}>
													{usesLabel(item)}
												</TableCell>
												<MetaCell value={extensionLabel(item.name)} />
												<MetaCell value={formatBytes(item.size)} />
												<MetaCell value={sizeLabel(item)} />
											</>
										)}
										<TableCell align="end" truncate title={shortDate(item.uploadedAt)}>
											<Text mono variant="meta" tone="muted">
												{shortDate(item.uploadedAt)}
											</Text>
										</TableCell>
										<TableCell>
											<RowActions>
												<DropdownMenu>
													<RowMore
														label={t("library.more")}
														trigger={(button) => <DropdownMenuTrigger render={button} />}
													/>
													<DropdownMenuContent align="end">{fileItems(false, item)}</DropdownMenuContent>
												</DropdownMenu>
											</RowActions>
										</TableCell>
									</TableRow>
								}
							/>
							<ContextMenuContent>{fileItems(true, item)}</ContextMenuContent>
						</ContextMenu>
					))}
					{nothing && (
						<TableRow>
							<TableCell colSpan={head.length + 1}>
								<Text variant="note" tone="subtle">
									{looking ? t("library.nothingFound") : t("library.empty")}
								</Text>
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</ListScroll>
	);
	const pages = data ? Math.ceil(data.total / data.pageSize) : 1;

	return (
		<Inline align="stretch" gap={0} grow minHeight={0}>
			<PageColumn width="list">
				<PageHeader
					title={here?.name ?? t("frame.media")}
					meta={data ? t("library.count", { count: data.total }) : undefined}
					trail={trail}
				>
					{/* How the library shows is no filter: it sits with the page's controls (2026-11-10, owner). */}
					<Segmented
						aria-label={t("library.view")}
						size="sm"
						inline
						value={state.view}
						onValueChange={(view) => setState({ ...state, view: view === "list" ? "list" : "grid" })}
						options={[
							{ value: "grid", label: t("library.view.grid") },
							{ value: "list", label: t("library.view.list") },
						]}
					/>
					<SearchToggle
						label={t("list.search")}
						aria-label={t("list.search")}
						placeholder={t("list.search")}
						value={state.search}
						// Emptied, the box starts over on the open folder.
						onValueChange={(search) =>
							setState(
								{ ...state, search, everywhere: search.trim() === "" ? false : state.everywhere, page: 1 },
								{ replace: true },
							)
						}
						// Inside a folder, the chip in the box says which folders it looks in (2026-11-10, owner: no row of its own).
						scopes={here ? searchScopes(here.name, t) : undefined}
						scope={state.everywhere ? "all" : "here"}
						onScopeChange={(scope) => setState({ ...state, everywhere: scope === "all", page: 1 })}
						targetLabel={t("list.searchIn")}
					/>
					{uploadButton}
				</PageHeader>
				{toolbar}
				<ContextMenu>
					<ContextMenuTrigger
						render={
							<DropArea fill flush={state.view === "list"} over={areaDrop.over && !folderTarget} {...areaDrop.handlers}>
								{state.view === "list" ? table : grid}
							</DropArea>
						}
					/>
					<ContextMenuContent>
						<ContextMenuItem onClick={() => chooseFiles({ onFiles: (files) => addFiles(files) })}>
							<UploadIcon aria-hidden />
							{t("library.upload")}
						</ContextMenuItem>
						{canNewFolder && (
							<ContextMenuItem onClick={() => naming.start()}>
								<FolderAdd aria-hidden />
								{t("folders.new")}
							</ContextMenuItem>
						)}
					</ContextMenuContent>
				</ContextMenu>
				<ListPages page={state.page} pages={pages} hrefOf={(page) => hrefOf({ ...state, page })} />
			</PageColumn>
			{removeFolder.dialog}
			{state.file && (
				<MediaPanel
					key={state.file}
					id={state.file}
					folders={folders}
					onClose={() => setState({ ...state, file: null })}
					go={goAway}
					onTrash={(id) => {
						void trash([id]);
						setState({ ...state, file: null });
					}}
				/>
			)}
		</Inline>
	);
}
