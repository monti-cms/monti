import { type MediaDetail, type MediaItem, type MediaUseRow, splitName } from "@monti-cms/core";
import {
	Affix,
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	DescriptionItem,
	DescriptionList,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	FilePreview,
	FileUseList,
	FileUseRow,
	FormField,
	FormFieldError,
	FormFieldLabel,
	Grid,
	IconButton,
	Image,
	ProposalBubble,
	ProposalBubbleDock,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SidePanel,
	Stack,
	Text,
	Tile,
	toast,
} from "@monti-cms/ui";
import { OverflowMenuHorizontal, TrashCan } from "@monti-cms/ui/icons";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { useLeaveGuard } from "../../draft/leave-guard";
import { type Path, useDraft } from "../../draft/use-draft";
import type { ProposalItem } from "../../draft/use-proposals";
import { chooseFiles } from "../../media/choose-files";
import { extensionLabel, formatBytes, previewUrl, sizeLabel } from "../../media/file-text";
import { putFile } from "../../media/put-file";
import { useAcceptFiles } from "../../media/upload-problem";
import { useAdmin } from "../../operations/admin-context";
import { reasonOf, useOperation, useRead } from "../../operations/use-operation";
import { linkTo, type Route } from "../../route";
import { DaysLeftFact } from "../../trash/days-left";
import { useCoverCorner } from "../frame/admin-frame";
import type { Folders } from "../list/folders";
import { shortDate } from "../list/format";
import type { SchemaRead } from "../settings/schema-draft";

const TOP = "~top";

/** A file's uses as the screen lists them: one row per entry or template, with the places in it (flow 6·16). */
function useUseRows(rows: readonly MediaUseRow[]) {
	const { t } = useAdmin();
	const schema = useRead<SchemaRead>("schema.read");
	const placeName = useCallback(
		(use: MediaUseRow) => {
			if ("block" in use.place) return t("library.place.body");
			const { field } = use.place;
			const label =
				use.owner === "entry" ? schema.data?.adminValues[use.collection]?.fields?.[field]?.label : undefined;
			return label ?? field;
		},
		[schema.data, t],
	);
	return useMemo(() => {
		const owners = new Map<string, { key: string; title: string; route: Route; places: Set<string> }>();
		for (const use of rows) {
			const key = `${use.owner}:${use.id}`;
			const owner =
				owners.get(key) ??
				(use.owner === "entry"
					? {
							key,
							title: use.title,
							route: { screen: "entry" as const, collection: use.collection, id: use.id },
							places: new Set<string>(),
						}
					: { key, title: use.name, route: { screen: "template" as const, id: use.id }, places: new Set<string>() });
			owner.places.add(placeName(use));
			owners.set(key, owner);
		}
		// The fields come first, as in the panel of the entry; the body is one place however many blocks it has.
		const body = t("library.place.body");
		return [...owners.values()].map((owner) => ({
			...owner,
			places: [...owner.places].sort((a, b) => Number(a === body) - Number(b === body)).join(" · "),
		}));
	}, [rows, placeName, t]);
}

/** Where a file is used, for the menus of a tile: read when its sub-menu opens. */
export function useFileUses(id: string) {
	return useUseRows(useRead<MediaDetail>("media.get", { id }, { quiet: true }).data?.useRows ?? []);
}

/** "Replace this file?" (flow 6·19): the file now and the one chosen, what stays, and what the server said if it refused. */
function ReplaceDialog({ item, file, onClose }: { item: MediaDetail; file: File; onClose: () => void }) {
	const { t, uploader, session } = useAdmin();
	const replace = useOperation<{ output: MediaItem }>("media.replace");
	const [going, setGoing] = useState(false);
	const [refused, setRefused] = useState<string | null>(null);
	const preview = useMemo(() => (file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file]);
	const go = async () => {
		setGoing(true);
		setRefused(null);
		const put = await putFile(file, uploader);
		if (!put.ok) {
			if (put.unauthenticated) session.end();
			setGoing(false);
			setRefused(t(put.problem === "failed" ? "library.failed" : `library.refused.${put.problem}`));
			return;
		}
		const done = await replace.run(
			{
				id: item.id,
				original: put.original,
				...(put.web ? { web: put.web } : {}),
				...(put.placeholder ? { placeholder: put.placeholder } : {}),
			},
			{ versions: { [`media:${item.id}`]: item.version } },
		);
		setGoing(false);
		// A request that never got an answer (status 0) is the same word as bytes that did not go up, and the dialog is not left locked behind it.
		if (!done.ok && done.refusal.status === 0) return setRefused(t("library.failed"));
		if (!done.ok) return setRefused(t(reasonOf(done.refusal)));
		onClose();
	};
	return (
		<AlertDialog open onOpenChange={(open) => !open && !going && onClose()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("library.replace.title")}</AlertDialogTitle>
				</AlertDialogHeader>
				<Grid columns="compare">
					<Tile
						title={item.name}
						detail={t("library.replace.old")}
						preview={
							item.kind === "image" ? (
								<Image src={previewUrl(item)} alt="" ratio="photo" radius="none" />
							) : (
								<FilePreview ext={extensionLabel(item.name)} />
							)
						}
					/>
					<Text aria-hidden tone="subtle">
						→
					</Text>
					<Tile
						title={file.name}
						detail={t("library.replace.new")}
						preview={
							preview ? (
								<Image src={preview} alt="" ratio="photo" radius="none" />
							) : (
								<FilePreview ext={extensionLabel(file.name)} />
							)
						}
					/>
				</Grid>
				<AlertDialogDescription>{t("library.replace.text", { count: item.uses })}</AlertDialogDescription>
				{refused && <FormFieldError>{refused}</FormFieldError>}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={going}>{t("settings.cancel")}</AlertDialogCancel>
					<AlertDialogAction
						disabled={going}
						onClick={(event: React.MouseEvent) => {
							// It closes itself when the file has gone up: the dialog is where a refusal shows.
							event.preventDefault();
							void go();
						}}
					>
						{t("library.replace.action")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

/** What a file is: its type, its sizes and the day it came (flow 6·16). `children` are rows before them: what the trash only reads, its name and its folder. */
function FileFacts({ item, children }: { item: MediaDetail; children?: ReactNode }) {
	const { t } = useAdmin();
	return (
		<DescriptionList>
			{children}
			<DescriptionItem label={t("library.type")}>{item.mime}</DescriptionItem>
			<DescriptionItem label={t("library.size")}>
				<Stack gap={2}>
					{item.web && <span>{t("library.sizeWeb", { size: sizeLabel(item) })}</span>}
					<span>
						{item.web
							? t("library.sizeOriginal", {
									size: `${item.original.width}×${item.original.height} · ${formatBytes(item.size)}`,
								})
							: [sizeLabel(item), formatBytes(item.size)].filter(Boolean).join(" · ")}
					</span>
				</Stack>
			</DescriptionItem>
			<DescriptionItem label={t("library.uploadedAt")}>{shortDate(item.uploadedAt)}</DescriptionItem>
		</DescriptionList>
	);
}

/** Where a file is used: one row for each entry or template, which goes there. */
function FileUses({ uses, go }: { uses: ReturnType<typeof useUseRows>; go: (route: Route) => void }) {
	const { t } = useAdmin();
	return (
		<FormField>
			<FormFieldLabel>{t("library.usesCount", { count: uses.length })}</FormFieldLabel>
			<FileUseList empty={t("library.usesNone")}>
				{uses.map((use) => (
					<FileUseRow
						key={use.key}
						title={use.title}
						places={use.places}
						// A new tab leaves nothing behind. A move in this one goes through the question.
						{...linkTo(use.route, go)}
					/>
				))}
			</FileUseList>
		</FormField>
	);
}

/**
 * A file in the trash, beside the trash's list (flow 5·20): what the library's panel says of it, in the same order, to read only. Restoring is its one pill; deleting
 * it for good is in its ⋯ (doc 11).
 */
export function TrashedFilePanel({
	id,
	onClose,
	onRestore,
	onPurge,
	go,
}: {
	id: string;
	onClose: () => void;
	onRestore: () => void;
	onPurge: () => void;
	go: (route: Route) => void;
}) {
	const { t } = useAdmin();
	const read = useRead<MediaDetail>("media.get", { id }, { afterWrites: true, quiet: true });
	const item = read.data;
	const uses = useUseRows(item?.useRows ?? []);
	useCoverCorner(true);
	if (!item || item.daysLeft === null) return null;
	return (
		<SidePanel
			width="side"
			title={item.name}
			onClose={onClose}
			actions={
				<DropdownMenu>
					<IconButton label={t("library.more")} trigger={(button) => <DropdownMenuTrigger render={button} />}>
						<OverflowMenuHorizontal aria-hidden />
					</IconButton>
					<DropdownMenuContent align="end">
						<DropdownMenuItem variant="danger" onClick={onPurge}>
							<TrashCan aria-hidden />
							{t("trash.purge")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			}
			footer={
				<Button variant="primary" size="md" onClick={onRestore}>
					{t("trash.restore")}
				</Button>
			}
		>
			<Stack gap={32}>
				{item.kind === "image" ? (
					<Image src={previewUrl(item)} alt={item.name} ratio="photo" />
				) : (
					<FilePreview ext={extensionLabel(item.name)} framed />
				)}
				{/* The panel's title is the file's name already; the folder is the one row the library edits and the trash only reads. */}
				<FileFacts item={item}>
					<DaysLeftFact days={item.daysLeft} />
					<DescriptionItem label={t("library.folder")}>{item.path.join(" / ") || t("folders.top")}</DescriptionItem>
				</FileFacts>
				<FileUses uses={uses} go={go} />
			</Stack>
		</SidePanel>
	);
}

/**
 * The panel of a file (flow 6·16, 6·18, 6·36): its name and folder, what it is, and where it is used. No alt text and no caption: those belong to the entries (09-2).
 * Its one draft goes through `useDraft` like every other screen (doc 05).
 */
export function MediaPanel({
	id,
	folders,
	onClose,
	onTrash,
	go,
}: {
	id: string;
	folders: Folders;
	onClose: () => void;
	onTrash: (id: string) => void;
	/** A move out of the library, to a place that uses the file: it asks first while files go up. */
	go: (route: Route) => void;
}) {
	const { t } = useAdmin();
	const read = useRead<MediaDetail>("media.get", { id }, { afterWrites: true, quiet: true });
	const item = read.data;
	const update = useOperation("media.update");
	const [replacing, setReplacing] = useState<File | null>(null);
	const acceptFiles = useAcceptFiles();
	const [refused, setRefused] = useState<string | null>(null);
	const uses = useUseRows(item?.useRows ?? []);
	const extension = item ? splitName(item.name).extension : "";
	const base = useMemo(() => (item ? { name: splitName(item.name).stem, folder: item.folderId ?? TOP } : null), [item]);
	const target = useMemo(() => ({ kind: "media", id }), [id]);
	const proposalValues = useCallback((proposal: ProposalItem): Record<Path, unknown> => {
		if (proposal.operation === "media.update") {
			const input = proposal.input as { name?: string };
			if (typeof input.name === "string") return { name: splitName(input.name).stem };
		}
		return {};
	}, []);
	// Docked at the page's edge, it stands where the frame's ✦ is: its × must not lie under it (screens/media.md).
	useCoverCorner(true);
	const draft = useDraft({ target, base, version: item?.version ?? null, proposalValues });
	useLeaveGuard({ changes: draft.changes, revertAll: draft.revertAll });
	// The version these changes were made on, whatever was read since: saving over someone else's rename is a conflict, not a success.
	const madeOn = useRef<number | null>(null);
	if (!draft.dirty) madeOn.current = item?.version ?? null;
	const [proposalAt, setProposalAt] = useState(0);
	if (!item) return null;

	const name = String(draft.value("name") ?? "");
	const folder = String(draft.value("folder") ?? TOP);
	const save = async () => {
		setRefused(null);
		const sent = draft.sending();
		const done = await update.run(
			{
				id,
				...(name === splitName(item.name).stem ? {} : { name }),
				...(folder === (item.folderId ?? TOP) ? {} : { folder: folder === TOP ? null : folder }),
			},
			{ versions: { [`media:${id}`]: madeOn.current ?? item.version }, accepted: draft.accepted },
		);
		if (done.ok) return draft.saved(sent);
		if (done.refusal.status === 409) {
			draft.revertAll();
			void read.reload();
			return setRefused(t("ui.savedElsewhere"));
		}
		setRefused(t(reasonOf(done.refusal)));
	};
	// Only what this panel draws (a proposed name): a proposed folder or a way to the trash is on the conversation's card (T108).
	const proposals = draft.drawn;
	const proposal = proposals[Math.min(proposalAt, Math.max(0, proposals.length - 1))];
	const copy = async (text: string) => {
		await navigator.clipboard.writeText(text);
		toast(t("library.copied"));
	};
	const url = previewUrl(item);

	return (
		<SidePanel
			width="side"
			title={item.name}
			onClose={onClose}
			actions={
				<DropdownMenu>
					<IconButton label={t("library.more")} trigger={(button) => <DropdownMenuTrigger render={button} />}>
						<OverflowMenuHorizontal aria-hidden />
					</IconButton>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => window.open(url, "_blank", "noopener")}>
							{t("library.openTab")}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => void copy(new URL(url, window.location.href).href)}>
							{t("library.copyUrl")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() =>
								chooseFiles({
									multiple: false,
									accept: item.kind === "image" ? "image/*" : undefined,
									// One the library refuses says so at once: there is nothing to compare.
									onFiles: (files) =>
										void acceptFiles(files.slice(0, 1)).then(([taken]) => {
											if (taken) setReplacing(taken);
										}),
								})
							}
						>
							{t("library.replace")}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => void copy(item.id)}>{t("library.copyId")}</DropdownMenuItem>
						<DropdownMenuItem variant="danger" onClick={() => onTrash(item.id)}>
							<TrashCan aria-hidden />
							{t("trash.toTrash")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			}
			// Nothing to save, no pill: a dimmed one would not say why (principle 7).
			footer={
				draft.dirty ? (
					<Button variant="primary" size="md" onClick={() => void save()}>
						{t("settings.save")}
					</Button>
				) : undefined
			}
		>
			{/* Each thing the panel is for stands apart: what the file is, what can be changed, what it is, where it is used. */}
			<Stack gap={32}>
				{item.kind === "image" ? (
					<Image src={url} alt={item.name} ratio="photo" />
				) : (
					<FilePreview ext={extensionLabel(item.name)} framed />
				)}
				<Stack gap={20}>
					<FormField>
						<FormFieldLabel htmlFor="monti-media-name">{t("library.name")}</FormFieldLabel>
						<Affix
							id="monti-media-name"
							size="md"
							suffix={extension}
							proposal={draft.cell("name").kind === "proposed"}
							value={name}
							onChange={(event) => draft.set("name", event.target.value)}
						/>
						{refused && <FormFieldError>{refused}</FormFieldError>}
					</FormField>
					<FormField>
						<FormFieldLabel htmlFor="monti-media-folder">{t("library.folder")}</FormFieldLabel>
						<Select
							items={[
								{ value: TOP, label: t("folders.top") },
								...folders.list.map((each) => ({
									value: each.id,
									label: folders
										.path(each.id)
										.map((up) => up.name)
										.join(" / "),
								})),
							]}
							value={folder}
							onValueChange={(value) => draft.set("folder", String(value))}
						>
							<SelectTrigger id="monti-media-folder" size="md" width="full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={TOP}>{t("folders.top")}</SelectItem>
								{folders.list.map((each) => (
									<SelectItem key={each.id} value={each.id}>
										{folders
											.path(each.id)
											.map((up) => up.name)
											.join(" / ")}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FormField>
				</Stack>
				<FileFacts item={item} />
				<FileUses uses={uses} go={go} />
			</Stack>
			{replacing && <ReplaceDialog item={item} file={replacing} onClose={() => setReplacing(null)} />}
			{proposal && (
				<ProposalBubbleDock>
					<ProposalBubble
						name={proposal.item.request}
						position={Math.min(proposalAt, proposals.length - 1) + 1}
						total={proposals.length}
						previousLabel={t("bubble.previous")}
						nextLabel={t("bubble.next")}
						onPrevious={() => setProposalAt((at) => (at - 1 + proposals.length) % proposals.length)}
						onNext={() => setProposalAt((at) => (at + 1) % proposals.length)}
						discardAllLabel={t("bubble.discardAll")}
						acceptAllLabel={t("bubble.acceptAll")}
						onDiscardAll={() => void draft.discardDrawn()}
						onAcceptAll={() => draft.acceptDrawn()}
					/>
				</ProposalBubbleDock>
			)}
		</SidePanel>
	);
}
