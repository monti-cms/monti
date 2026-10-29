"use client";

import { Add, Draggable, Locked } from "@carbon/icons-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SchemaScreenState } from "@monti-cms/core/internal/schema-edit";
import type { ConfigIssue } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { Banner, Box, CodeBlock, cn, Heading, Icon, IconButton, Inline, Stack, Text, toast } from "@monti-cms/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { errorText } from "../../api/client";
import { fetchSchema, schemaKeys } from "../../api/schema";
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
import { schemaCollectionMessages } from "./collection.messages";
import { CollectionEditor } from "./collection-editor";
import { ChangedMark, IssueList, SchemaEditProvider } from "./controls";
import { SortableList } from "./fields-tree-dnd";
import { describeLiteralIssue } from "./literal-issue";
import { LocalesEditor } from "./locales-editor";
import { schemaMessages } from "./messages";
import { NewCollectionDialog } from "./new-collection-dialog";
import { reloadPage, rememberSaved, takeSavedMessage } from "./reload";
import { type Removal, ReviewDialog } from "./review-dialog";
import { SaveGroup } from "./save-group";
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
	withoutCollections,
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
						<Stack key={title} gap={8}>
							<Heading as="h4" variant="label">
								{title}
							</Heading>
							<CodeBlock wrap={false}>{JSON.stringify(value, null, 2)}</CodeBlock>
						</Stack>
					))}
				</Section>
			)}
			{migrations.length > 0 && (
				<Section wide title={t("file.migrations")}>
					<Stack as="ul" gap={0}>
						{migrations.map((migration, index) => (
							<Inline as="li" key={String(migration.id)} gap={8} paddingY={8} border={index === 0 ? undefined : "top"}>
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
		<Box as="span" border="all" radius="sm" background="tool" paddingX={12} paddingY={2}>
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
		<div
			ref={setNodeRef}
			// design-allow: dnd-kit moves the row while it is dragged
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={cn("group/row relative flex items-center", isDragging && "z-10 opacity-80")}
			data-testid={`collection-nav-${name}`}
		>
			{writable && (
				<button
					type="button"
					ref={setActivatorNodeRef}
					{...attributes}
					{...listeners}
					aria-label={t("collection.drag", { name: label })}
					className="absolute top-1/2 left-1 z-10 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-monti-sm text-monti-muted opacity-0 outline-none hover:text-monti-default focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-monti-contrast/20 group-hover/row:opacity-100"
				>
					<Draggable aria-hidden className="size-3.5" />
				</button>
			)}
			<button
				type="button"
				aria-current={active ? "true" : undefined}
				className={cn(
					"flex h-8 w-full shrink-0 items-center gap-monti-8 rounded-monti-md border border-transparent px-monti-12 text-left text-monti-body outline-none transition-colors hover:bg-monti-selected focus-visible:ring-2 focus-visible:ring-monti-contrast/20",
					writable && "group-focus-within/row:pl-monti-32 group-hover/row:pl-monti-32",
					active && "border-monti-muted bg-monti-page font-medium hover:bg-monti-page",
				)}
				onClick={onSelect}
			>
				<Box grow minWidth={0}>
					<Text truncate>{label}</Text>
				</Box>
				{isNew ? (
					<Text variant="meta" tone="subtle">
						{t("collection.new")}
					</Text>
				) : (
					changed && <ChangedMark />
				)}
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
	const tCollection = useTranslator(schemaCollectionMessages);
	const base = useMemo(() => (isObj(state.schema) ? (state.schema as Obj) : {}), [state.schema]);
	const writable = state.access.writable;
	const [draft, setDraft] = useState<Obj>(base);
	const [renames, setRenames] = useState<Rename[]>([]);
	const [issues, setIssues] = useState<readonly ConfigIssue[]>([]);
	const [reviewing, setReviewing] = useState(false);
	const [applyFailed, setApplyFailed] = useState(false);
	const [creating, setCreating] = useState(false);
	// Collections taken out of the list and not saved yet: they stay in the draft (so taking one back loses nothing) and go out of what is checked and saved.
	const [removed, setRemoved] = useState<string[]>([]);
	const collections = collectionsOf(draft);
	const names = Object.keys(collections);
	const liveNames = names.filter((name) => !removed.includes(name));
	// What the file would be if saved now.
	const pendingDraft = useMemo(() => withoutCollections(draft, removed), [draft, removed]);
	// Which collection is open and which of its parts live in the address, so a reload after saving comes back to the same place.
	const [selectedName, setSelectedName] = useSettingsParam("collection");
	const [section, setSection] = useSettingsParam("section");
	const setSelected = (name: string) => {
		setSelectedName(name);
		setSection(undefined);
	};
	const scroller = useRef<HTMLElement>(null);
	const selected = selectedName && liveNames.includes(selectedName) ? selectedName : liveNames[0];
	const tc = useTranslator(commonMessages);
	const { confirm, dialog } = useConfirm();
	const dirty = !sameJson(pendingDraft, base);
	const { dialog: guardDialog } = useUnsavedGuard(dirty);
	const pending = changeCount(base, pendingDraft);
	const areas = useMemo(() => changedAreas(base, pendingDraft), [base, pendingDraft]);
	const savedNames = Object.keys(collectionsOf(base));

	// The page draws the marks of its tabs, so it is told where the draft differs.
	useEffect(() => {
		onChanged?.(areas);
		return () => onChanged?.(null);
	}, [areas, onChanged]);
	useEffect(() => {
		const message = takeSavedMessage();
		if (message) toast(message);
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
			collectionNames: liveNames,
			codeCollections: state.codeCollections,
			file: draft,
			saved: base,
		}),
		[writable, state.vocabulary, issues, liveNames, state.codeCollections, draft, base],
	);

	const removals: Removal[] = removed.flatMap((name) => {
		const found = collectionsOf(base)[name];
		return found
			? [
					{
						name,
						label: String(found.label ?? name),
						kind: found.kind === "item" ? ("item" as const) : ("document" as const),
					},
				]
			: [];
	});
	const restore = (name: string) => setRemoved((current) => current.filter((item) => item !== name));
	/** A saved collection goes out of the list at once and stays in the file until the draft is saved; the toast and the changes menu bring it back. */
	const remove = (name: string) => {
		if (!savedNames.includes(name)) {
			// A collection that was never saved holds nothing: it simply goes.
			updateFile((file) => removeCollection(file, name));
			return;
		}
		setRemoved((current) => [...current, name]);
		toast(tCollection("collection.deleted", { name: String(collections[name]?.label ?? name) }), {
			action: { label: tCollection("collection.deleteUndo"), onClick: () => restore(name) },
		});
	};
	const discard = async () => {
		const ok = await confirm(discardConfirm(tc));
		if (!ok) return;
		setDraft(base);
		setRemoved([]);
		setRenames([]);
		setIssues([]);
	};

	// What sits on the right of the title row: the read-only note, or the save group while the draft has changes.
	const actions = !writable ? (
		<Inline gap={4}>
			<Icon icon={Locked} size="sm" tone="subtle" />
			<Text variant="meta" tone="subtle">
				{t("status.readOnly")}
			</Text>
		</Inline>
	) : dirty ? (
		<SaveGroup
			count={pending}
			removed={removals.map((item) => ({ name: item.name, label: item.label, onRestore: () => restore(item.name) }))}
			disabled={state.hash === null}
			onReview={() => setReviewing(true)}
			onSave={() => setReviewing(true)}
			onDiscard={() => void discard()}
		/>
	) : null;

	const reason = state.access.writable
		? null
		: ((state.access.reason as keyof typeof READ_ONLY_KEY | undefined) ?? null);
	return (
		<SchemaEditProvider value={context}>
			<Stack gap={0} grow minHeight={0} data-testid="schema-screen">
				{fileSlot ? createPortal(<FileLine state={state} reason={reason} />, fileSlot) : null}
				{actions && actionsSlot !== undefined
					? actionsSlot
						? createPortal(actions, actionsSlot)
						: null
					: actions && (
							<Inline justify="end" gap={8} border="bottom" background="page" paddingX={32} paddingY={8}>
								{actions}
							</Inline>
						)}
				<Stack ref={scroller} gap={0} grow minHeight={0} overflow="y">
					<PageBody paddingTop={tab === "collections" ? undefined : 24}>
						{reason && (
							<Banner
								title={t(READ_ONLY_KEY[reason])}
								meta={
									reason === "has_code" && (state.access.issue || state.access.detail) ? (
										<span data-testid="schema-code-detail">
											{state.access.issue ? describeLiteralIssue(t, state.access.issue) : state.access.detail}
										</span>
									) : undefined
								}
								data-testid="schema-read-only"
							/>
						)}
						{writable && state.comments && <Banner title={t("comments.note")} data-testid="schema-comments-note" />}
						{applyFailed && <Banner role="alert" tone="danger" title={t("save.applyFailedNote")} />}
						{state.issues.length > 0 && (
							<Stack gap={8} data-testid="schema-file-invalid">
								<Banner role="alert" tone="danger" title={t("invalid.title")} />
								<Text tone="muted">{t("invalid.description")}</Text>
								<IssueList issues={state.issues} />
							</Stack>
						)}
						{issues.length > 0 && !reviewing && (
							<Stack gap={8}>
								<Banner role="alert" tone="danger" title={t("issues.title")} />
								<IssueList issues={issues} />
							</Stack>
						)}
						{state.codeCollections.length > 0 && (
							<Banner title={t("code.collections", { names: state.codeCollections.join(", ") })} />
						)}
						{state.issues.length === 0 && (
							<>
								{tab === "collections" && (
									<Inline wrap align="start" gap={24}>
										<Stack gap={2} width="fit" shrink={false}>
											<Inline justify="between" paddingBottom={8} paddingX={12}>
												<Text variant="caption" weight="medium" tone="muted">
													{t("collection.railTitle")} {liveNames.length}
												</Text>
												{writable && (
													<IconButton label={t("collection.create")} onClick={() => setCreating(true)}>
														<Add aria-hidden />
													</IconButton>
												)}
											</Inline>
											<Stack as="nav" aria-label={t("tabs.collections")} gap={2}>
												<SortableList
													items={liveNames}
													onDragEnd={(from, to) => {
														const fromIndex = liveNames.indexOf(from);
														const toIndex = liveNames.indexOf(to);
														if (fromIndex !== -1 && toIndex !== -1) {
															updateFile((file) => reorderCollections(file, moveWithin(liveNames, fromIndex, toIndex)));
														}
													}}
												>
													{liveNames.map((name) => (
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
										<Box grow minWidth={0}>
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
													footprint={state.footprints?.[selected]}
													onRemove={() => remove(selected)}
												/>
											) : (
												<Text as="p" tone="muted">
													{t("collection.none")}
												</Text>
											)}
										</Box>
									</Inline>
								)}
								{tab === "locales" && <LocalesEditor file={draft} update={updateFile} />}
								{tab === "site" && <SiteEditor file={draft} siteUrl={state.siteUrl} update={updateFile} />}
								{tab === "admin" && (
									<Stack gap={48}>
										<AdminEditor file={draft} update={updateFile} />
										<FileRest file={draft} />
									</Stack>
								)}
							</>
						)}
					</PageBody>
				</Stack>
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
					draft={pendingDraft}
					renames={renames}
					settings={settingChanges(base, pendingDraft)}
					removals={removals}
					baseHash={state.hash}
					onIssues={setIssues}
					onApplyFailed={() => setApplyFailed(true)}
					onSaved={() => {
						rememberScroll(scroller.current?.scrollTop ?? 0);
						// One line for every save: the review already showed what it changes.
						rememberSaved(t("save.done"));
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
	const tc = useTranslator(commonMessages);
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
		<Stack gap={12} padding={32}>
			{error ? (
				<LoadErrorAlert message={error} onRetry={() => void query.refetch()} />
			) : (
				<Text as="p" tone="subtle" role="status">
					{tc("loading")}
				</Text>
			)}
		</Stack>
	);
}
