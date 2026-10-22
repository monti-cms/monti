"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SchemaScreenState } from "@monti-cms/core/internal/schema-edit";
import type { ConfigIssue } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Badge,
	Box,
	cn,
	Grid,
	Heading,
	IconButton,
	Inline,
	Skeleton,
	Stack,
	Text,
} from "@monti-cms/ui";
import { useQuery } from "@tanstack/react-query";
import { GripVertical, Lock, Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { errorText } from "../../api/client";
import { fetchSchema, type SavedSchema, schemaKeys } from "../../api/schema";
import { commonMessages } from "../../lib/common.messages";
import { moveWithin } from "../../lib/utils/move-within";
import { rememberScroll, takeScroll, useSettingsParam } from "../settings/place";
import type { SchemaTab } from "../settings/tabs";
import { discardConfirm, useConfirm } from "../shared/confirm-dialog";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { PageBody } from "../shared/page-body";
import { Section } from "../shared/section";
import { useUnsavedGuard } from "../shared/use-unsaved-guard";
import { AdminEditor } from "./admin-editor";
import { CollectionEditor } from "./collection-editor";
import { ChangeDot, IssueList, SchemaEditProvider } from "./controls";
import { SortableList } from "./fields-tree-dnd";
import { describeLiteralIssue } from "./literal-issue";
import { LocalesEditor } from "./locales-editor";
import { schemaMessages } from "./messages";
import { NewCollectionDialog } from "./new-collection-dialog";
import { reloadPage, rememberSaved, takeSavedMessage } from "./reload";
import { ReviewDialog } from "./review-dialog";
import { SaveBar } from "./save-bar";
import {
	addCollection,
	type ChangedAreas,
	changeCount,
	changedAreas,
	collectionsOf,
	isObj,
	type Obj,
	type Rename,
	recordRename,
	removeCollection,
	reorderCollections,
	sameJson,
	setCollection,
	settingChanges,
} from "./schema-model";
import { SiteEditor } from "./site-editor";

/** Why a schema file may not be edited here, as the key of the sentence that says it. */
const READ_ONLY_KEY = {
	production: "readonly.production",
	no_schema_file: "readonly.noFile",
	not_writable: "readonly.notWritable",
	has_code: "readonly.hasCode",
} as const;

/** The same reasons in a few words, for the line under the Settings title. */
const READ_ONLY_SHORT_KEY = {
	production: "readonly.short.production",
	no_schema_file: "readonly.short.noFile",
	not_writable: "readonly.short.notWritable",
	has_code: "readonly.short.hasCode",
} as const;

/** The parts of the file the screen does not edit: seed data, the admin text overrides (shown as they are), and the transforms already recorded. Nothing shows when the file has none of them. */
function FileRest({ file }: { file: Obj }) {
	const t = useTranslator(schemaMessages);
	const migrations = Array.isArray(file.migrations) ? (file.migrations as Obj[]) : [];
	const messages = isObj(file.admin) ? file.admin.messages : undefined;
	const rest = [
		...(messages !== undefined ? ([[t("file.messages"), messages]] as const) : []),
		...(file.seed !== undefined ? ([[t("file.seed"), file.seed]] as const) : []),
	];
	if (rest.length === 0 && migrations.length === 0) return null;
	return (
		<>
			{/* One section whose title says these are edited in the file, rather than the same note under each of them. */}
			{rest.length > 0 && (
				<Section wide title={t("file.title")}>
					{rest.map(([title, value]) => (
						<Stack key={title} gap="condensed">
							<Heading as="h4" variant="label">
								{title}
							</Heading>
							{/* design-system: needs a code block (scrolling, maximum height, inset background) */}
							<pre className="max-h-64 overflow-auto rounded-md bg-monti-inset p-normal text-monti-caption">
								{JSON.stringify(value, null, 2)}
							</pre>
						</Stack>
					))}
				</Section>
			)}
			{migrations.length > 0 && (
				<Section wide title={t("file.migrations")}>
					<Stack as="ul" gap="none">
						{migrations.map((migration, index) => (
							<Inline
								as="li"
								key={String(migration.id)}
								gap="condensed"
								paddingY="condensed"
								border={index === 0 ? undefined : "top"}
							>
								<Text as="code" variant="caption">
									{String(migration.id)}
								</Text>
								<Text variant="caption" tone="muted">
									{String(migration.op)}
								</Text>
							</Inline>
						))}
					</Stack>
				</Section>
			)}
		</>
	);
}

/** The chip next to the Settings title: the schema file, and why it is read-only when it is. */
function FileLine({ state, reason }: { state: SchemaScreenState; reason: keyof typeof READ_ONLY_KEY | null }) {
	const t = useTranslator(schemaMessages);
	return (
		<Box as="span" border="all" radius="sm" background="inset" paddingX="normal" paddingY="hair">
			<Text variant="caption" tone="muted" mono>
				{state.file ?? t("status.noFile")}
				{reason && ` · ${t("status.readOnly")}: ${t(READ_ONLY_SHORT_KEY[reason])}`}
			</Text>
		</Box>
	);
}

function CollectionNavItem({
	name,
	collection,
	active,
	isNew,
	changed,
	writable,
	onSelect,
}: {
	name: string;
	collection: Obj | undefined;
	active: boolean;
	isNew: boolean;
	/** The collection holds draft changes. */
	changed: boolean;
	writable: boolean;
	onSelect: () => void;
}) {
	const t = useTranslator(schemaMessages);
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: name,
		disabled: !writable,
	});

	const label = String(collection?.label ?? name);

	return (
		// design-system: drawing — the sortable row: the drag transform and the grip that appears on hover, which the parts cannot draw
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={cn("group/row relative flex items-center", isDragging && "z-10 opacity-80")}
			data-testid={`collection-nav-${name}`}
		>
			{writable && (
				// design-system: drawing — the drag handle, placed over the row and shown on hover or focus
				<button
					type="button"
					ref={setActivatorNodeRef}
					{...attributes}
					{...listeners}
					aria-label={t("collection.drag", { name: label })}
					className="absolute top-1/2 left-1 z-10 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-sm text-monti-muted opacity-0 outline-none hover:text-monti-default focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-monti-focus-soft group-hover/row:opacity-100"
				>
					<GripVertical aria-hidden className="size-3.5" />
				</button>
			)}
			{/* design-system: drawing — the row button makes room for the handle on hover (padding shift) */}
			<button
				type="button"
				aria-current={active ? "true" : undefined}
				className={cn(
					"flex h-8 w-full shrink-0 items-center gap-condensed rounded-md border border-transparent px-normal text-left text-monti-body outline-none transition-colors hover:bg-monti-hover focus-visible:ring-2 focus-visible:ring-monti-focus-soft",
					writable && "group-focus-within/row:pl-wide group-hover/row:pl-wide",
					active && "border-monti-muted bg-monti-surface font-medium hover:bg-monti-surface",
				)}
				onClick={onSelect}
			>
				<Box grow minWidth={0}>
					<Text truncate>{label}</Text>
				</Box>
				{isNew ? <Badge variant="outline">{t("collection.new")}</Badge> : changed && <ChangeDot />}
				<Text variant="caption" tone="muted">
					{t(collection?.kind === "item" ? "collection.kindItem" : "collection.kindDocument")}
				</Text>
			</button>
		</div>
	);
}

function SchemaEditor({
	state,
	tab,
	actionsSlot,
	fileSlot,
	onTab,
	onChanged,
}: {
	state: SchemaScreenState;
	tab: SchemaTab;
	actionsSlot?: HTMLElement | null;
	fileSlot?: HTMLElement | null;
	onTab?: (tab: SchemaTab) => void;
	onChanged?: (areas: ChangedAreas | null) => void;
}) {
	const t = useTranslator(schemaMessages);
	const base = useMemo(() => (isObj(state.schema) ? (state.schema as Obj) : {}), [state.schema]);
	const writable = state.access.writable;
	const [draft, setDraft] = useState<Obj>(base);
	const [renames, setRenames] = useState<Rename[]>([]);
	const [issues, setIssues] = useState<readonly ConfigIssue[]>([]);
	const [reviewing, setReviewing] = useState(false);
	const [applyFailed, setApplyFailed] = useState(false);
	const [creating, setCreating] = useState(false);
	const collections = collectionsOf(draft);
	const names = Object.keys(collections);
	// Which collection is open and which of its parts live in the address, so a reload after saving comes back to the same place.
	const [selectedName, setSelectedName] = useSettingsParam("collection");
	const [section, setSection] = useSettingsParam("section");
	const setSelected = (name: string) => {
		setSelectedName(name);
		setSection(undefined);
	};
	const scroller = useRef<HTMLDivElement>(null);
	const selected = selectedName && selectedName in collections ? selectedName : names[0];
	const tc = useTranslator(commonMessages);
	const { confirm, dialog } = useConfirm();
	const dirty = !sameJson(draft, base);
	const { dialog: guardDialog } = useUnsavedGuard(dirty);
	const pending = changeCount(base, draft);
	const areas = useMemo(() => changedAreas(base, draft), [base, draft]);
	const savedNames = Object.keys(collectionsOf(base));

	// The page draws the marks of its tabs, so it is told where the draft differs.
	useEffect(() => {
		onChanged?.(areas);
		return () => onChanged?.(null);
	}, [areas, onChanged]);
	useEffect(() => {
		const message = takeSavedMessage();
		if (message) toast.success(message);
	}, []);
	// After the reload that follows a save, scroll back to where the writer was.
	useLayoutEffect(() => {
		const top = takeScroll();
		if (top !== null && scroller.current) scroller.current.scrollTop = top;
	}, []);

	const updateFile = (change: (file: Obj) => Obj) => setDraft((current) => change(current));
	const context = useMemo(
		() => ({
			disabled: !writable,
			vocabulary: state.vocabulary,
			issues,
			collectionNames: names,
			codeCollections: state.codeCollections,
			file: draft,
			saved: base,
		}),
		[writable, state.vocabulary, issues, names, state.codeCollections, draft, base],
	);

	const discard = async () => {
		const ok = await confirm(discardConfirm(tc));
		if (!ok) return;
		setDraft(base);
		setRenames([]);
		setIssues([]);
	};

	const actions = !writable ? (
		<Badge variant="outline">
			<Lock aria-hidden />
			{t("status.readOnly")}
		</Badge>
	) : null;

	const reason = state.access.writable
		? null
		: ((state.access.reason as keyof typeof READ_ONLY_KEY | undefined) ?? null);
	return (
		<SchemaEditProvider value={context}>
			<Stack gap="none" grow minHeight={0} data-testid="schema-screen">
				{fileSlot ? createPortal(<FileLine state={state} reason={reason} />, fileSlot) : null}
				{actions && actionsSlot !== undefined
					? actionsSlot
						? createPortal(actions, actionsSlot)
						: null
					: actions && (
							<Inline
								justify="end"
								gap="condensed"
								border="bottom"
								background="page"
								paddingX="wide"
								paddingY="condensed"
							>
								{actions}
							</Inline>
						)}
				{/* design-system: needs a ref on Box/Stack (the scroll position is restored after a save) */}
				<div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
					<PageBody wide={tab === "collections"}>
						{reason && (
							<Alert layout="stack" data-testid="schema-read-only">
								<AlertTitle>{t("readonly.title")}</AlertTitle>
								<AlertDescription>
									<Stack gap="tight">
										<Text>{t(READ_ONLY_KEY[reason])}</Text>
										{reason === "has_code" && (state.access.issue || state.access.detail) && (
											<Text as="code" variant="caption" data-testid="schema-code-detail">
												{state.access.issue ? describeLiteralIssue(t, state.access.issue) : state.access.detail}
											</Text>
										)}
									</Stack>
								</AlertDescription>
							</Alert>
						)}
						{writable && state.comments && (
							<Alert layout="stack" data-testid="schema-comments-note">
								<AlertDescription>{t("comments.note")}</AlertDescription>
							</Alert>
						)}
						{applyFailed && (
							<Alert tone="danger" layout="stack">
								<AlertDescription>{t("save.applyFailedNote")}</AlertDescription>
							</Alert>
						)}
						{state.issues.length > 0 && (
							<Alert tone="danger" layout="stack" data-testid="schema-file-invalid">
								<AlertTitle>{t("invalid.title")}</AlertTitle>
								<AlertDescription>
									<Stack gap="condensed">
										<Text>{t("invalid.description")}</Text>
										<IssueList issues={state.issues} />
									</Stack>
								</AlertDescription>
							</Alert>
						)}
						{issues.length > 0 && !reviewing && (
							<Alert tone="danger" layout="stack">
								<AlertTitle>{t("issues.title")}</AlertTitle>
								<AlertDescription>
									<IssueList issues={issues} />
								</AlertDescription>
							</Alert>
						)}
						{state.codeCollections.length > 0 && (
							<Alert layout="stack">
								<AlertDescription>
									{t("code.collections", { names: state.codeCollections.join(", ") })}
								</AlertDescription>
							</Alert>
						)}
						{state.issues.length === 0 && (
							<>
								{tab === "collections" && (
									<Grid columns="sidebar" gap="wide" align="start">
										<Stack gap="hair">
											<Inline justify="between" paddingBottom="condensed" paddingX="normal">
												<Text variant="caption" weight="medium" tone="muted">
													{t("collection.railTitle")} {names.length}
												</Text>
												{writable && (
													<IconButton label={t("collection.create")} size="icon-xs" onClick={() => setCreating(true)}>
														<Plus aria-hidden />
													</IconButton>
												)}
											</Inline>
											<Stack as="nav" aria-label={t("tabs.collections")} gap="hair">
												<SortableList
													items={names}
													onDragEnd={(from, to) => {
														const fromIndex = names.indexOf(from);
														const toIndex = names.indexOf(to);
														if (fromIndex !== -1 && toIndex !== -1) {
															updateFile((file) => reorderCollections(file, moveWithin(names, fromIndex, toIndex)));
														}
													}}
												>
													{names.map((name) => (
														<CollectionNavItem
															key={name}
															name={name}
															collection={collections[name]}
															active={name === selected}
															isNew={!savedNames.includes(name)}
															changed={name in areas.collections}
															writable={writable}
															onSelect={() => setSelected(name)}
														/>
													))}
												</SortableList>
											</Stack>
										</Stack>
										<Box minWidth={0}>
											{selected && collections[selected] ? (
												<CollectionEditor
													key={selected}
													name={selected}
													section={section}
													onSection={setSection}
													collection={collections[selected]}
													changes={areas.collections[selected]}
													onChange={(change) => updateFile((file) => setCollection(file, selected, change))}
													onRename={(rename) => setRenames((current) => recordRename(current, rename))}
													onFileChange={updateFile}
													onRemove={async () => {
														if (savedNames.includes(selected)) {
															const ok = await confirm({
																title: t("collection.removeTitle", { name: selected }),
																description: t("collection.removeDescription"),
																confirmLabel: t("collection.remove"),
																destructive: true,
															});
															if (!ok) return;
														}
														updateFile((file) => removeCollection(file, selected));
													}}
												/>
											) : (
												<Text as="p" tone="muted">
													{t("collection.none")}
												</Text>
											)}
										</Box>
									</Grid>
								)}
								{tab === "locales" && <LocalesEditor file={draft} update={updateFile} />}
								{tab === "site" && <SiteEditor file={draft} siteUrl={state.siteUrl} update={updateFile} />}
								{tab === "admin" && (
									<Stack gap="section">
										<AdminEditor file={draft} update={updateFile} />
										<FileRest file={draft} />
									</Stack>
								)}
							</>
						)}
					</PageBody>
				</div>
				{dirty && writable && (
					<SaveBar
						count={pending}
						disabled={state.hash === null}
						onReview={() => setReviewing(true)}
						onSave={() => setReviewing(true)}
						onDiscard={() => void discard()}
					/>
				)}
			</Stack>
			{dialog}
			{guardDialog}
			<NewCollectionDialog
				open={creating}
				onOpenChange={setCreating}
				taken={names}
				onCreate={(id, kind, path, label) => {
					updateFile((file) => addCollection(file, id, kind, path, label));
					setSelected(id);
					if (tab !== "collections") onTab?.("collections");
					setCreating(false);
				}}
			/>
			{state.hash !== null && (
				<ReviewDialog
					open={reviewing}
					onOpenChange={setReviewing}
					draft={draft}
					renames={renames}
					settings={settingChanges(base, draft)}
					baseHash={state.hash}
					onIssues={setIssues}
					onApplyFailed={() => setApplyFailed(true)}
					onSaved={(saved: SavedSchema) => {
						rememberScroll(scroller.current?.scrollTop ?? 0);
						rememberSaved(
							t("save.done", {
								transforms: saved.transforms.length,
								entries: saved.entriesRewritten,
							}),
						);
						reloadPage();
					}}
				/>
			)}
		</SchemaEditProvider>
	);
}

/** The schema file editor: edits `monti.schema.ts` on the development server, shows it read-only everywhere else. `tab` is the Settings tab being shown. */
export function SchemaSettings({
	tab,
	actionsSlot,
	fileSlot,
	onTab,
	onChanged,
}: {
	tab: SchemaTab;
	actionsSlot?: HTMLElement | null;
	fileSlot?: HTMLElement | null;
	/** Moves the Settings page to another tab (the page owns the tabs). */
	onTab?: (tab: SchemaTab) => void;
	/** Tells the page where the draft differs from the saved file (`null` when there is no draft), for the marks on its tabs. */
	onChanged?: (areas: ChangedAreas | null) => void;
}) {
	const site = useSite();
	const t = useTranslator(schemaMessages);
	const query = useQuery({
		queryKey: schemaKeys.state(),
		queryFn: ({ signal }) => fetchSchema(site, signal),
		// The file is the truth: a screen that was open while it changed would edit a stale copy.
		staleTime: 0,
		refetchOnWindowFocus: false,
	});
	const error = query.error ? errorText(site, query.error, t("load.failed")) : null;
	if (query.data)
		return (
			<SchemaEditor
				key={query.data.hash ?? "site"}
				state={query.data}
				tab={tab}
				actionsSlot={actionsSlot}
				fileSlot={fileSlot}
				onTab={onTab}
				onChanged={onChanged}
			/>
		);
	return (
		<Stack gap="normal" padding="wide">
			{error ? <LoadErrorAlert message={error} onRetry={() => void query.refetch()} /> : <Skeleton shape="block" />}
		</Stack>
	);
}
