"use client";

import { Upload } from "@carbon/icons-react";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { Button, Inline, PageBody, PageColumn, PageHeader, SearchToggle, Stack, Text, TextButton } from "@monti-cms/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorText } from "../../api/client";
import { foldersKeys } from "../../api/folders";
import type { MediaItem } from "../../api/media";
import { mediaKeys } from "../../api/media";
import { commonMessages } from "../../lib/common.messages";
import { useAdminRouter } from "../../router";
import { ActionContextMenu } from "../shared/action-menu";
import { AdminFrame } from "../shared/admin-frame";
import { deleteMessages } from "../shared/delete.messages";
import { EmptyState } from "../shared/empty-state";
import { entryHref } from "../shared/entry-href";
import { ListPagination } from "../shared/list-pager";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { DockedPanel } from "../shared/side-panel";
import { isInsideFolder, useFolderActions } from "../shared/use-folder-actions";
import { useUnsavedGuard } from "../shared/use-unsaved-guard";
import { placeNamer } from "./media-item";
import { blankMenu, fileMenu, folderMenu } from "./media-menus";
import { MediaPanel } from "./media-panel";
import { MediaToolbar } from "./media-toolbar";
import { MediaGrid, MediaTable } from "./media-views";
import { mediaMessages } from "./messages";
import { ReplaceDialog } from "./replace-dialog";
import { useFileDrop } from "./use-file-drop";
import { useMediaActions } from "./use-media-actions";
import { useMediaLibrary } from "./use-media-library";
import { useMediaUploads } from "./use-media-uploads";

/**
 * The media library: the folders and files of the open folder, or the files a search or a condition matches, with their paths. Files are dropped on it (or on a
 * folder tile in it) and go up as tiles that stay when they fail; several can be picked and moved or trashed; one opens in the panel beside it, where it can be
 * changed or replaced.
 */
export function MediaLibrary() {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	const tc = useTranslator(commonMessages);
	const td = useTranslator(deleteMessages);
	const router = useAdminRouter();
	const queryClient = useQueryClient();
	const library = useMediaLibrary();
	const { state, update, folders, items, trail, currentFolder } = library;
	const actions = useMediaActions(library);
	const fileInput = useRef<HTMLInputElement>(null);
	const replaceInput = useRef<HTMLInputElement>(null);
	const [replacing, setReplacing] = useState<{ media: MediaItem; file: File } | null>(null);

	const refresh = useCallback(
		() =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: mediaKeys.all }),
				queryClient.invalidateQueries({ queryKey: foldersKeys.list("media") }),
			]),
		[queryClient],
	);
	const uploads = useMediaUploads({ onUploaded: () => void refresh() });
	const folderName = useCallback((id: string) => folders.find((folder) => folder.id === id)?.name ?? "", [folders]);
	const drop = useFileDrop({
		onFiles: (files, folderId) => uploads.add(files, folderId ?? (state.folder || null)),
		folderName,
	});

	const folderActions = useFolderActions({
		collection: "media",
		folders,
		onChanged: async (change) => {
			const { deleted } = change ?? {};
			// If the folder being viewed (or one inside it) went to the trash, go up to the folder it was in, or to the top.
			if (deleted && state.folder && isInsideFolder(folders, state.folder, deleted.id))
				update({ folder: deleted.parentId ?? "", page: 1 });
			await refresh();
		},
		// The files that stayed in a folder because something uses them: the library, filtered to those in that folder.
		onViewKept: (kept) =>
			update({ folder: kept.id, used: "used", search: "", kind: "all", alt: "all", scope: "here", page: 1 }),
	});

	// "+ New folder" in the bulk bar names a folder in place and then moves the picked files into it.
	const [moveAfter, setMoveAfter] = useState<{ files: MediaItem[]; named: boolean } | null>(null);
	const { naming, focusFolderId } = folderActions;
	const move = actions.move.mutate;
	useEffect(() => {
		if (!moveAfter) return;
		if (naming && !moveAfter.named) setMoveAfter({ ...moveAfter, named: true });
		else if (!naming && moveAfter.named) {
			if (focusFolderId) move({ files: moveAfter.files, folderId: focusFolderId });
			setMoveAfter(null);
		}
	}, [moveAfter, naming, focusFolderId, move]);
	const newFolderHere = () => folderActions.requestCreate(state.folder || null);

	const names = { t, tc, td, placeName: placeNamer(site, t) };
	const pickedFiles = items.filter((item) => library.picked.has(item.id));
	// The folder all of the picked files are in, for the ✓ of the "To folder" menu; none when they differ or some are on other pages.
	const folderOfPicked = pickedFiles.every((file) => (file.folderId ?? null) === (pickedFiles[0]?.folderId ?? null))
		? (pickedFiles[0]?.folderId ?? null)
		: undefined;
	const pickedFolder = pickedFiles.length === library.picked.size ? folderOfPicked : undefined;
	const menuFor = (media: MediaItem) =>
		fileMenu(media, folders, names, {
			open: (file) => void library.openFile(file.id),
			openEntry: (usage) => router.navigate(entryHref(site, usage.collection, usage.entryId)),
			move: (file, folderId) => actions.move.mutate({ files: [file], folderId }),
		});
	const folderMenuFor = (folder: (typeof folders)[number]) =>
		folderMenu(folder, folders, names, { open: (opened) => library.goToFolder(opened.id), actions: folderActions });

	const [panelDirty, setPanelDirty] = useState(false);
	const { dialog: guardDialog } = useUnsavedGuard(panelDirty);
	const reportDirty = useCallback(
		(dirty: boolean) => {
			library.setPanelDirty(dirty);
			setPanelDirty(dirty);
		},
		[library.setPanelDirty],
	);

	const pickReplacement = (media: MediaItem) => {
		const input = replaceInput.current;
		if (!input) return;
		input.accept = site.api.isImageType(media.mimeType)
			? site.api.ALLOWED_IMAGE_MIME_TYPES.join(",")
			: (media.mimeType ?? "");
		input.value = "";
		input.click();
	};

	const loadError = library.error ? errorText(site, library.error, t("load.failed")) : null;
	const empty =
		items.length === 0 &&
		uploads.queue.length === 0 &&
		!(library.explorer && (library.explorer.folders.length > 0 || library.explorer.parent !== null)) &&
		!folderActions.naming;
	const here = state.folder || null;

	return (
		<AdminFrame
			sidebar={{
				activeNav: "media",
				folderNav: {
					collection: "media",
					currentFolder: state.folder || "all",
					folders,
					onSelectFolder: (id) => library.goToFolder(id ?? ""),
					onDropEntries: async (targetFolderId, entries) => {
						// The files dragged: the ones on this page by name, and picked ones from other pages by their id.
						const files = entries.map(
							(entry) => items.find((item) => item.id === entry.id) ?? { id: entry.id, filename: entry.id },
						);
						if (files.length > 0) actions.move.mutate({ files, folderId: targetFolderId });
					},
				},
			}}
		>
			<PageColumn width="list">
				<PageHeader
					title={currentFolder?.name ?? t("title")}
					trail={
						currentFolder && (
							<Inline as="nav" gap={6} aria-label={t("trail.label")}>
								<TextButton variant="underline" onClick={() => library.goToFolder("")}>
									{t("title")}
								</TextButton>
								<span aria-hidden="true">/</span>
								{trail.slice(0, -1).map((ancestor) => (
									<Inline key={ancestor.id} gap={6}>
										<TextButton variant="underline" onClick={() => library.goToFolder(ancestor.id)}>
											{ancestor.name}
										</TextButton>
										<span aria-hidden="true">/</span>
									</Inline>
								))}
							</Inline>
						)
					}
				>
					{!library.searching && library.picked.size === 0 && (
						<TextButton onClick={newFolderHere}>{t("head.folder")}</TextButton>
					)}
					<SearchToggle
						label={t("head.search")}
						aria-label={t("head.searchLabel")}
						placeholder={t("head.searchLabel")}
						value={library.searchText}
						onValueChange={library.setSearchText}
					/>
					<Button type="button" onClick={() => fileInput.current?.click()}>
						<Upload aria-hidden />
						{t("head.upload")}
					</Button>
				</PageHeader>
				<input
					ref={fileInput}
					type="file"
					multiple
					hidden
					accept={`${site.api.ALLOWED_IMAGE_MIME_TYPES.join(",")},${site.api.FILE_ACCEPT}`}
					onChange={(event) => {
						const files = Array.from(event.target.files ?? []);
						event.target.value = "";
						if (files.length > 0) uploads.add(files, here);
					}}
				/>
				<input
					ref={replaceInput}
					type="file"
					hidden
					data-slot="replace-input"
					aria-hidden
					tabIndex={-1}
					onChange={(event) => {
						const file = event.target.files?.[0];
						const media = library.open;
						event.target.value = "";
						if (file && media) setReplacing({ media, file });
					}}
				/>
				<MediaToolbar
					library={library}
					pickedFolder={pickedFolder}
					onMove={(folderId) => actions.move.mutate({ files: pickedFiles, folderId })}
					onNewFolder={() => {
						setMoveAfter({ files: pickedFiles, named: false });
						newFolderHere();
					}}
					onTrash={() => actions.trash.mutate(pickedFiles)}
				/>
				<PageBody>
					<Stack as="div" direction="row" gap={0} grow minHeight={0} position="relative">
						<Stack gap={0} grow minWidth={0}>
							{loadError && <LoadErrorAlert message={loadError} onRetry={library.retry} />}
							{empty && !library.isLoading && !loadError ? (
								<ActionContextMenu
									actions={blankMenu({ t }, { upload: () => fileInput.current?.click(), newFolder: newFolderHere })}
									trigger={<Stack gap={0} grow paddingTop={24} />}
								>
									{library.filtered ? (
										<EmptyState
											title={t("empty.noMatch")}
											description={t("empty.noMatchHint")}
											action={{
												label: t("empty.clear"),
												onClick: () => update({ search: "", used: "all", kind: "all", alt: "all" }),
											}}
										/>
									) : (
										<EmptyState
											title={t("empty.yet")}
											description={t("empty.yetHint")}
											action={{ label: t("head.upload"), onClick: () => fileInput.current?.click() }}
										/>
									)}
								</ActionContextMenu>
							) : library.isLoading ? (
								<Text as="p" variant="note" tone="subtle" role="status">
									{tc("loading")}
								</Text>
							) : (
								<>
									{library.view === "grid" ? (
										<MediaGrid
											library={library}
											uploads={uploads}
											drop={drop}
											folderActions={folderActions}
											menuFor={menuFor}
											folderMenuFor={folderMenuFor}
											onTrash={(media) => actions.trash.mutate([media])}
										/>
									) : (
										<MediaTable
											library={library}
											uploads={uploads}
											drop={drop}
											folderActions={folderActions}
											menuFor={menuFor}
											folderMenuFor={folderMenuFor}
											onTrash={(media) => actions.trash.mutate([media])}
										/>
									)}
									<ActionContextMenu
										actions={blankMenu({ t }, { upload: () => fileInput.current?.click(), newFolder: newFolderHere })}
										trigger={<Stack gap={0} grow paddingY={24} aria-hidden data-slot="blank-space" />}
									/>
								</>
							)}
							<ListPagination
								total={library.total}
								shown={items.length}
								page={state.page}
								pageSize={state.pageSize}
								onPageChange={(page) => update({ page })}
								onPageSizeChange={(pageSize) => update({ pageSize })}
								hidePagerWhenSingle
								showRange={library.total > state.pageSize}
							/>
						</Stack>
						{library.open && (
							<DockedPanel>
								<MediaPanel
									key={library.open.id}
									media={library.open}
									folders={folders}
									onClose={() => void library.openFile(null)}
									onSave={(patch) =>
										actions.save.mutateAsync({ media: library.open as MediaItem, patch }).then(() => undefined)
									}
									onReplace={() => pickReplacement(library.open as MediaItem)}
									onTrash={() => actions.trash.mutate([library.open as MediaItem])}
									onDirtyChange={reportDirty}
								/>
							</DockedPanel>
						)}
					</Stack>
				</PageBody>
			</PageColumn>
			<ReplaceDialog request={replacing} onClose={() => setReplacing(null)} onReplace={actions.replaceFile} />
			{library.confirmDialog}
			{guardDialog}
			{folderActions.dialogs}
		</AdminFrame>
	);
}
