"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SchemaScreenState } from "@monti-cms/core/internal/schema-edit";
import type { ConfigIssue } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, GripVertical, Lock, Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { errorText } from "../../api/client";
import { fetchSchema, type SavedSchema, schemaKeys } from "../../api/schema";
import { commonMessages } from "../../lib/common.messages";
import { cn } from "../../lib/utils/cn";
import { moveWithin } from "../../lib/utils/move-within";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { IconButton } from "../../ui/icon-button";
import { Skeleton } from "../../ui/skeleton";
import { rememberScroll, takeScroll, useSettingsParam } from "../settings/place";
import type { SchemaTab } from "../settings/tabs";
import { discardConfirm, useConfirm } from "../shared/confirm-dialog";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { PageBody } from "../shared/page-body";
import { Section } from "../shared/section";
import { useUnsavedGuard } from "../shared/use-unsaved-guard";
import { AdminEditor } from "./admin-editor";
import { CollectionEditor } from "./collection-editor";
import { IssueList, SchemaEditProvider } from "./controls";
import { SortableList } from "./fields-tree-dnd";
import { type RowButton, RowButtons } from "./fields-tree-rows";
import { describeLiteralIssue } from "./literal-issue";
import { LocalesEditor } from "./locales-editor";
import { schemaMessages } from "./messages";
import { NewCollectionDialog } from "./new-collection-dialog";
import { reloadPage, rememberSaved, takeSavedMessage } from "./reload";
import { ReviewDialog } from "./review-dialog";
import {
	addCollection,
	changeCount,
	collectionsOf,
	isObj,
	moveCollection,
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
		...(file.seed !== undefined ? ([["seed", file.seed]] as const) : []),
	];
	if (rest.length === 0 && migrations.length === 0) return null;
	return (
		<>
			{rest.map(([title, value]) => (
				<Section wide key={title} title={title} note={t("file.hint")}>
					<pre className="max-h-64 overflow-auto rounded-md bg-monti-muted/60 p-3 text-xs">
						{JSON.stringify(value, null, 2)}
					</pre>
				</Section>
			))}
			{migrations.length > 0 && (
				<Section wide title={t("file.migrations")}>
					<ul className="-my-2 flex flex-col divide-y text-sm">
						{migrations.map((migration) => (
							<li key={String(migration.id)} className="flex items-center gap-2 py-2">
								<code className="text-xs">{String(migration.id)}</code>{" "}
								<span className="text-monti-muted-foreground text-xs">{String(migration.op)}</span>
							</li>
						))}
					</ul>
				</Section>
			)}
		</>
	);
}

/** The chip next to the Settings title: the schema file, its version, and why it is read-only when it is. */
function FileLine({ state, reason }: { state: SchemaScreenState; reason: keyof typeof READ_ONLY_KEY | null }) {
	const t = useTranslator(schemaMessages);
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full border border-monti-border bg-monti-muted/40 px-2.5 py-0.5 font-mono text-monti-muted-foreground text-xs">
			{state.file ?? t("status.noFile")} · {t("status.version", { version: state.schemaVersion })}
			{reason && ` · ${t("status.readOnly")}: ${t(READ_ONLY_SHORT_KEY[reason])}`}
		</span>
	);
}

function CollectionNavItem({
	name,
	collection,
	active,
	isNew,
	writable,
	index,
	total,
	onSelect,
	onMove,
}: {
	name: string;
	collection: Obj | undefined;
	active: boolean;
	isNew: boolean;
	writable: boolean;
	index: number;
	total: number;
	onSelect: () => void;
	onMove: (delta: number) => void;
}) {
	const t = useTranslator(schemaMessages);
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: name,
		disabled: !writable,
	});

	const label = String(collection?.label ?? name);
	const buttons: RowButton[] = [
		{
			label: t("collection.moveUp", { name: label }),
			icon: ArrowUp,
			disabled: !writable || index === 0,
			onClick: () => onMove(-1),
		},
		{
			label: t("collection.moveDown", { name: label }),
			icon: ArrowDown,
			disabled: !writable || index === total - 1,
			onClick: () => onMove(1),
		},
	];

	return (
		<div
			ref={setNodeRef}
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
					className="absolute top-1/2 left-1 z-10 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-sm text-monti-muted-foreground opacity-0 outline-none hover:text-monti-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-monti-ring/50 group-hover/row:opacity-100"
				>
					<GripVertical aria-hidden className="size-3.5" />
				</button>
			)}
			<button
				type="button"
				aria-current={active ? "true" : undefined}
				className={cn(
					"flex h-8 w-full shrink-0 items-center gap-2 rounded-md border border-transparent px-2.5 text-left text-sm outline-none transition-colors hover:bg-monti-muted focus-visible:ring-2 focus-visible:ring-monti-ring/50",
					writable &&
						"group-focus-within/row:pr-14 group-focus-within/row:pl-7 group-hover/row:pr-14 group-hover/row:pl-7",
					active && "border-monti-border bg-monti-card font-medium hover:bg-monti-card",
				)}
				onClick={onSelect}
			>
				<span className="flex-1 truncate">{label}</span>
				{isNew && <Badge variant="outline">{t("collection.new")}</Badge>}
				<span className="font-normal text-monti-muted-foreground text-xs">
					{t(collection?.kind === "item" ? "collection.kindItem" : "collection.kindDocument")}
				</span>
			</button>
			{writable && <RowButtons buttons={buttons} />}
		</div>
	);
}

function SchemaEditor({
	state,
	tab,
	actionsSlot,
	fileSlot,
	onTab,
}: {
	state: SchemaScreenState;
	tab: SchemaTab;
	actionsSlot?: HTMLElement | null;
	fileSlot?: HTMLElement | null;
	onTab?: (tab: SchemaTab) => void;
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
	const savedNames = Object.keys(collectionsOf(base));

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
		}),
		[writable, state.vocabulary, issues, names, state.codeCollections, draft],
	);

	const discard = async () => {
		const ok = await confirm(discardConfirm(tc));
		if (!ok) return;
		setDraft(base);
		setRenames([]);
		setIssues([]);
	};

	const actions = (
		<>
			{!writable && (
				<Badge variant="outline" className="gap-1">
					<Lock aria-hidden />
					{t("status.readOnly")}
				</Badge>
			)}
			{dirty && writable && (
				<>
					<Button type="button" variant="ghost" size="sm" onClick={() => void discard()}>
						{t("actions.discard")}
					</Button>
					<span className="hidden text-monti-muted-foreground text-xs sm:inline">
						{t("header.pending", { count: pending })}
					</span>
				</>
			)}
			<Button
				type="button"
				variant={dirty && writable ? "default" : "outline"}
				size="sm"
				disabled={!writable || !dirty}
				onClick={() => setReviewing(true)}
			>
				{dirty && writable ? t("actions.review") : t("actions.noChanges")}
			</Button>
		</>
	);

	const reason = state.access.writable
		? null
		: ((state.access.reason as keyof typeof READ_ONLY_KEY | undefined) ?? null);
	return (
		<SchemaEditProvider value={context}>
			<div className="flex min-h-0 flex-1 flex-col" data-testid="schema-screen">
				{fileSlot ? createPortal(<FileLine state={state} reason={reason} />, fileSlot) : null}
				{actions && actionsSlot !== undefined
					? actionsSlot
						? createPortal(actions, actionsSlot)
						: null
					: actions && (
							<div className="flex items-center justify-end gap-2.5 border-b bg-monti-background px-4 py-2 lg:px-10">
								{actions}
							</div>
						)}
				<div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
					<PageBody wide={tab === "collections"}>
						{reason && (
							<Alert layout="stack" data-testid="schema-read-only">
								<AlertTitle>{t("readonly.title")}</AlertTitle>
								<AlertDescription className="flex flex-col gap-1">
									<span>{t(READ_ONLY_KEY[reason])}</span>
									{reason === "has_code" && (state.access.issue || state.access.detail) && (
										<code className="text-xs" data-testid="schema-code-detail">
											{state.access.issue ? describeLiteralIssue(t, state.access.issue) : state.access.detail}
										</code>
									)}
								</AlertDescription>
							</Alert>
						)}
						{writable && state.comments && (
							<Alert layout="stack" data-testid="schema-comments-note">
								<AlertDescription>{t("comments.note")}</AlertDescription>
							</Alert>
						)}
						{applyFailed && (
							<Alert variant="destructive" layout="stack">
								<AlertDescription>{t("save.applyFailedNote")}</AlertDescription>
							</Alert>
						)}
						{state.issues.length > 0 && (
							<Alert variant="destructive" layout="stack" data-testid="schema-file-invalid">
								<AlertTitle>{t("invalid.title")}</AlertTitle>
								<AlertDescription className="flex flex-col gap-2">
									<span>{t("invalid.description")}</span>
									<IssueList issues={state.issues} />
								</AlertDescription>
							</Alert>
						)}
						{issues.length > 0 && !reviewing && (
							<Alert variant="destructive" layout="stack">
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
									<div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
										<div className="flex shrink-0 flex-col gap-0.5 lg:w-56">
											<div className="flex items-center justify-between pb-2 pl-2.5">
												<span className="font-medium text-monti-muted-foreground text-xs">
													{t("collection.railTitle")} {names.length}
												</span>
												{writable && (
													<IconButton label={t("collection.create")} size="icon-xs" onClick={() => setCreating(true)}>
														<Plus aria-hidden />
													</IconButton>
												)}
											</div>
											<nav
												aria-label={t("tabs.collections")}
												className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0"
											>
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
													{names.map((name, index) => (
														<CollectionNavItem
															key={name}
															name={name}
															collection={collections[name]}
															active={name === selected}
															isNew={!savedNames.includes(name)}
															writable={writable}
															index={index}
															total={names.length}
															onSelect={() => setSelected(name)}
															onMove={(delta) => updateFile((file) => moveCollection(file, name, delta))}
														/>
													))}
												</SortableList>
											</nav>
										</div>
										<div className="min-w-0 flex-1">
											{selected && collections[selected] ? (
												<CollectionEditor
													key={selected}
													name={selected}
													section={section}
													onSection={setSection}
													collection={collections[selected]}
													isNew={!savedNames.includes(selected)}
													onChange={(change) => updateFile((file) => setCollection(file, selected, change))}
													onRename={(rename) => setRenames((current) => recordRename(current, rename))}
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
												<p className="text-monti-muted-foreground text-sm">{t("collection.none")}</p>
											)}
										</div>
									</div>
								)}
								{tab === "locales" && <LocalesEditor file={draft} update={updateFile} />}
								{tab === "site" && <SiteEditor file={draft} siteUrl={state.siteUrl} update={updateFile} />}
								{tab === "admin" && (
									<div className="flex flex-col gap-12">
										<AdminEditor file={draft} update={updateFile} />
										<FileRest file={draft} />
									</div>
								)}
							</>
						)}
					</PageBody>
				</div>
			</div>
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
								version: saved.schemaVersion,
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
}: {
	tab: SchemaTab;
	actionsSlot?: HTMLElement | null;
	fileSlot?: HTMLElement | null;
	/** Moves the Settings page to another tab (the page owns the tabs). */
	onTab?: (tab: SchemaTab) => void;
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
			/>
		);
	return (
		<div className="flex flex-col gap-3 p-4 lg:p-10">
			{error ? (
				<LoadErrorAlert message={error} onRetry={() => void query.refetch()} />
			) : (
				<Skeleton className="h-40 w-full" />
			)}
		</div>
	);
}
