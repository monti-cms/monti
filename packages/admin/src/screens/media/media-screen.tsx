import type { FolderNode, MediaItem, MediaKind, MediaQueryResult } from "@monti-cms/core";
import {
	BulkBar,
	Button,
	Caret,
	Chip,
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
	DropdownMenuCheckboxItem,
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
	MenuShortcut,
	PageColumn,
	PageHeader,
	PageToolbar,
	PageToolbarEnd,
	RenameField,
	RowActions,
	RowLink,
	RowMore,
	RowThumb,
	RowTitle,
	SearchToggle,
	Segmented,
	type SelectAll,
	Separator,
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
import { Document, Folder, FolderAdd, Launch, OverflowMenuHorizontal, Upload as UploadIcon } from "@monti-cms/ui/icons";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useLeave } from "../../draft/leave-guard";
import { chooseFiles } from "../../media/choose-files";
import { extensionLabel, formatBytes, previewUrl, sizeLabel } from "../../media/file-text";
import { useProblemActions, useProblemText } from "../../media/upload-problem";
import type { Upload } from "../../media/upload-queue";
import { MEDIA_DRAG, useFileDrop, useFolderDrop, useKeepFilesInPage } from "../../media/use-file-drop";
import { useMoveMedia, useTrashMedia } from "../../media/use-media-actions";
import { useUpload } from "../../media/use-upload";
import { useAdmin } from "../../operations/admin-context";
import { useOperation, useRead } from "../../operations/use-operation";
import { href, type Route } from "../../route";
import {
	FolderMenuItems,
	FolderTargets,
	MoveToFolderMenu,
	useFolderNaming,
	useFolders,
	useRemoveFolder,
} from "../list/folders";
import { shortDate } from "../list/format";
import { ListPages } from "../list/list-pages";
import { MediaPanel, useFileUses } from "./media-panel";
import {
	isLooking,
	KINDS,
	type MediaState,
	queryOf,
	readMediaState,
	SORTS,
	USES,
	writeMediaState,
} from "./media-query";

const DROP_HINT = "media-drop";
const CONNECT_DOCS = "https://github.com/monti-cms/monti#media-storage";

type Go = (route: Route, options?: { replace?: boolean }) => void;

/**
 * What a tile's mono line says: its size or kind and how much it is used, and in a search, where it sits under the open folder. A file right in the open folder keeps its
 * usual line (components/list.md).
 */
function useFileDetail(searching: boolean, open: readonly string[]) {
	const { t } = useAdmin();
	return (item: MediaItem) => {
		const under = searching ? item.path.slice(open.length) : [];
		const place = under.length > 0 ? `${under.join(" / ")} · ` : "";
		const measure = item.kind === "image" ? sizeLabel(item) : formatBytes(item.size);
		const use = item.uses > 0 ? t("library.usedBy", { count: item.uses }) : t("library.notUsed");
		return `${place}${measure ? `${measure} · ` : ""}${use}`;
	};
}

/** What a tile shows of a file: its picture, or for a file with none its icon and type (flow 6·34). */
function FileThumb({ item }: { item: Pick<MediaItem, "kind" | "name" | "web" | "original"> }) {
	return item.kind === "image" ? (
		<Image src={previewUrl(item)} alt="" ratio="photo" radius="none" />
	) : (
		<FilePreview ext={extensionLabel(item.name)} />
	);
}

/** A file on its way up, in its place in the grid: its bar and turn, or why it stays (flow 6·03, 6·04, 6·34, 6·35). */
function UploadTile({
	upload,
	onRemove,
	onRetry,
	onShrink,
}: {
	upload: Upload;
	onRemove: (upload: Upload) => void;
	onRetry: (upload: Upload) => void;
	onShrink: (upload: Upload) => unknown;
}) {
	const { t } = useAdmin();
	const problemText = useProblemText();
	const actions = useProblemActions({ onRemove, onRetry, onShrink })(upload);
	const preview = upload.preview ? (
		<Image src={upload.preview} alt="" ratio="photo" radius="none" />
	) : (
		<FilePreview ext={extensionLabel(upload.name)} />
	);
	if (upload.status === "failed")
		return (
			<Tile
				status="failed"
				title={upload.name}
				detail={problemText(upload)}
				// A picture that cannot be shown leaves an empty place with its red line: no icon, no extension (components/list.md).
				preview={upload.preview ? null : preview}
				actions={actions}
			/>
		);
	if (upload.status === "interrupted")
		return (
			<Tile status="interrupted" title={upload.name} detail={problemText(upload)} preview={preview} actions={actions} />
		);
	return (
		<Tile
			status="uploading"
			title={upload.name}
			progress={upload.status === "uploading" ? upload.progress : undefined}
			detail={
				upload.status === "uploading" ? t("library.uploading", { percent: upload.progress }) : t("library.waiting")
			}
			preview={preview}
		/>
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
	const drop = useFolderDrop({ onFiles, onMove });
	useEffect(() => {
		if (!drop.target) return;
		onTarget(folder.name);
		return () => onTarget(null);
	}, [drop.target, folder.name, onTarget]);
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
			<Item onClick={onOpen}>
				<Launch aria-hidden />
				{t("list.open")}
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
 * A filter of the library (screens/media.md): a button, and once something is chosen the chip in its place. It is one menu either way, so it stays open while its values are
 * ticked, and the chip opens it again.
 */
function FilterMenu<Value extends string>({
	label,
	values,
	chosen,
	chip,
	onChange,
}: {
	label: string;
	values: readonly { value: Value; label: string; count: number }[];
	chosen: readonly Value[];
	chip: (value: string) => string;
	onChange: (chosen: Value[]) => void;
}) {
	const { t } = useAdmin();
	const names = values.filter((each) => chosen.includes(each.value)).map((each) => each.label);
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					chosen.length === 0 ? (
						<FilterButton />
					) : (
						<Chip removeLabel={t("list.removeFilter")} onRemove={() => onChange([])} />
					)
				}
			>
				{chosen.length === 0 ? label : chip(names.join(", "))}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				{values.map((each) => (
					<DropdownMenuCheckboxItem
						box
						key={each.value}
						checked={chosen.includes(each.value)}
						closeOnClick={false}
						onCheckedChange={() =>
							onChange(
								chosen.includes(each.value) ? chosen.filter((value) => value !== each.value) : [...chosen, each.value],
							)
						}
					>
						{each.label}
						<MenuShortcut>{each.count}</MenuShortcut>
					</DropdownMenuCheckboxItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
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
	const addFiles = (files: File[], folder = state.folder) => void upload.add(files, folder);
	const areaDrop = useFileDrop((files) => addFiles(files));
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

	const namingField = (
		<RenameField
			fill
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

	const toolbar = picking ? (
		<BulkBar
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
				{t("library.toTrash")}
			</TextButton>
		</BulkBar>
	) : (
		<PageToolbar inset>
			<FilterMenu
				label={t("library.kind")}
				values={KINDS.map((kind: MediaKind) => ({
					value: kind,
					label: t(`library.kind.${kind}`),
					count: data?.counts[kind] ?? 0,
				}))}
				chosen={state.kinds}
				chip={(value) => t("library.kindChip", { value })}
				onChange={(kinds) => setState({ ...state, kinds, page: 1 })}
			/>
			<FilterMenu
				label={t("library.used")}
				values={USES.map((use) => ({
					value: use,
					label: t(`library.used.${use}`),
					count: data?.counts[use] ?? 0,
				}))}
				chosen={state.used}
				chip={(value) => t("library.usedChip", { value })}
				onChange={(used) => setState({ ...state, used, page: 1 })}
			/>
			{looking && state.folder && here && (
				<>
					<Separator orientation="vertical" length="control" flush />
					<Segmented
						aria-label={t("folders.searchIn")}
						size="sm"
						inline
						value={state.everywhere ? "all" : "here"}
						onValueChange={(where) => setState({ ...state, everywhere: where === "all", page: 1 })}
						options={[
							{ value: "here", label: here.name },
							{ value: "all", label: t("folders.everywhere") },
						]}
					/>
				</>
			)}
			<PageToolbarEnd>
				<DropdownMenu>
					<DropdownMenuTrigger render={<FilterButton />}>{t(`library.sort.${state.sort}`)}</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuRadioGroup
							value={state.sort}
							onValueChange={(sort) => {
								const found = SORTS.find((known) => known === sort);
								if (found) setState({ ...state, sort: found, page: 1 });
							}}
						>
							{SORTS.map((sort) => (
								<DropdownMenuRadioItem key={sort} value={sort}>
									{t(`library.sort.${sort}`)}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
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
			</PageToolbarEnd>
		</PageToolbar>
	);

	const uploadsHere = upload.uploads.filter((each) => each.folder === state.folder);
	const nothing =
		data !== null && items.length === 0 && childFolders.length === 0 && uploadsHere.length === 0 && !naming.naming;
	const grid = (
		<Stack gap={24} paddingTop={24} paddingX={12}>
			{(childFolders.length > 0 || naming.naming?.id === null) && (
				<Grid columns="folders" dense={dense}>
					{childFolders.map((folder) => (
						<ContextMenu key={folder.id}>
							{naming.naming?.id === folder.id ? (
								<FolderTile>{namingField}</FolderTile>
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
					{naming.naming?.id === null && <FolderTile>{namingField}</FolderTile>}
				</Grid>
			)}
			{(items.length > 0 || uploadsHere.length > 0) && (
				<Grid columns="tiles" dense={dense}>
					{uploadsHere.map((each) => (
						<UploadTile
							key={each.id}
							upload={each}
							onRemove={upload.remove}
							onRetry={upload.retry}
							onShrink={upload.shrink}
						/>
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
										onSelectedChange={(on) => {
											const next = new Set(picked);
											if (on) next.add(item.id);
											else next.delete(item.id);
											setPicked(next);
										}}
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
	const table = (
		<Stack gap={8} paddingTop={12} paddingX={12}>
			<Table container="none">
				<TableBody>
					{naming.naming?.id === null && (
						<TableRow>
							<TableCell width="xs">
								<RowThumb>
									<Folder aria-hidden size={16} />
								</RowThumb>
							</TableCell>
							<TableCell colSpan={7}>
								<RowTitle editing title={namingField} />
							</TableCell>
						</TableRow>
					)}
					{childFolders.map((folder) => (
						<ContextMenu key={folder.id}>
							<ContextMenuTrigger
								render={
									<TableRow>
										<TableCell width="xs">
											<RowThumb>
												<Folder aria-hidden size={16} />
											</RowThumb>
										</TableCell>
										<TableCell colSpan={7}>
											{naming.naming?.id === folder.id ? (
												<RowTitle editing title={namingField} />
											) : (
												<RowTitle
													title={
														<RowLink href={hrefOf({ ...state, folder: folder.id, page: 1, file: null })}>
															{folder.name}
														</RowLink>
													}
													address={<Count>{folder.count}</Count>}
												/>
											)}
										</TableCell>
									</TableRow>
								}
							/>
							<ContextMenuContent>{folderItems(true, folder)}</ContextMenuContent>
						</ContextMenu>
					))}
					{items.map((item) => (
						<ContextMenu key={item.id}>
							<ContextMenuTrigger
								render={
									<TableRow data-state={state.file === item.id ? "selected" : undefined}>
										<TableCell width="xs">
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
										</TableCell>
										<TableCell truncate>
											<RowTitle title={<RowLink href={hrefOf({ ...state, file: item.id })}>{item.name}</RowLink>} />
										</TableCell>
										<TableCell>
											<Text variant="note">
												{item.uses > 0 ? t("library.usedBy", { count: item.uses }) : t("library.notUsed")}
											</Text>
										</TableCell>
										<TableCell>
											<Text variant="meta">{extensionLabel(item.name)}</Text>
										</TableCell>
										<TableCell>
											<Text variant="meta">{formatBytes(item.size)}</Text>
										</TableCell>
										<TableCell>
											<Text variant="meta">{sizeLabel(item)}</Text>
										</TableCell>
										<TableCell>
											<Count>{shortDate(item.uploadedAt)}</Count>
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
				</TableBody>
			</Table>
			{uploadsHere.length > 0 && (
				<Grid columns="tiles">
					{uploadsHere.map((each) => (
						<UploadTile
							key={each.id}
							upload={each}
							onRemove={upload.remove}
							onRetry={upload.retry}
							onShrink={upload.shrink}
						/>
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
	const pages = data ? Math.ceil(data.total / data.pageSize) : 1;

	return (
		<Inline align="stretch" gap={0} grow minHeight={0}>
			<PageColumn width="list">
				<PageHeader
					title={here?.name ?? t("frame.media")}
					meta={data ? t("library.count", { count: data.total }) : undefined}
					trail={trail}
				>
					<SearchToggle
						label={t("list.search")}
						aria-label={t("list.search")}
						placeholder={t("list.search")}
						value={state.search}
						onValueChange={(search) => setState({ ...state, search, page: 1 }, { replace: true })}
					/>
					{uploadButton}
				</PageHeader>
				{toolbar}
				<ContextMenu>
					<ContextMenuTrigger
						render={
							<DropArea fill over={areaDrop.over && !folderTarget} {...areaDrop.handlers}>
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
