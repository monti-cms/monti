"use client";

import type { Issue } from "@monti-cms/core/client";
import { useSite, useTranslator } from "@monti-cms/core/client";
import type { SchemaScreenState } from "@monti-cms/core/schema-edit";
import { useQuery } from "@tanstack/react-query";
import { Lock, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { errorText } from "../../api/client";
import { fetchSchema, type SavedSchema, schemaKeys } from "../../api/schema";
import { commonMessages } from "../../lib/common.messages";
import { cn } from "../../lib/utils/cn";
import { useAdminRouter } from "../../router";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { IconButton } from "../../ui/icon-button";
import { Skeleton } from "../../ui/skeleton";
import type { SchemaTab } from "../settings/tabs";
import { discardConfirm, useConfirm } from "../shared/confirm-dialog";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { PageBody } from "../shared/page-body";
import { Section } from "../shared/section";
import { useUnsavedGuard } from "../shared/use-unsaved-guard";
import { AdminEditor } from "./admin-editor";
import { CollectionEditor } from "./collection-editor";
import { IssueList, SchemaEditProvider } from "./controls";
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
	localesOf,
	type Obj,
	type Rename,
	recordRename,
	removeCollection,
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

/** The file on disk and the version the database has, then the parts of the file the screen does not edit: seed data, the admin text overrides (shown as they are), and the transforms already recorded. */
function FileInfo({ file, state }: { file: Obj; state: SchemaScreenState }) {
	const t = useTranslator(schemaMessages);
	const migrations = Array.isArray(file.migrations) ? (file.migrations as Obj[]) : [];
	const messages = isObj(file.admin) ? file.admin.messages : undefined;
	const rest = [
		...(messages !== undefined ? ([[t("file.messages"), messages]] as const) : []),
		...(file.seed !== undefined ? ([["seed", file.seed]] as const) : []),
	];
	return (
		<div className="flex flex-col gap-12">
			<Section wide title={t("file.statusTitle")} description={t("file.statusDescription")} note={t("file.hint")}>
				<div className="flex flex-wrap items-center gap-2">
					<code className="rounded-sm bg-cms-muted px-1.5 py-0.5 text-xs">{state.file ?? t("status.noFile")}</code>
					<Badge variant="secondary">{t("status.version", { version: state.schemaVersion })}</Badge>
					<Badge variant="outline">
						{state.applied ? t("status.applied", { version: state.applied.schemaVersion }) : t("status.notApplied")}
					</Badge>
				</div>
			</Section>
			{rest.map(([title, value]) => (
				<Section wide key={title} title={title}>
					<pre className="max-h-64 overflow-auto rounded-md bg-cms-muted/60 p-3 text-xs">
						{JSON.stringify(value, null, 2)}
					</pre>
				</Section>
			))}
			<Section wide title={t("file.migrations")}>
				{migrations.length === 0 ? (
					<p className="text-cms-muted-foreground text-sm">{t("file.noMigrations")}</p>
				) : (
					<ul className="-my-2 flex flex-col divide-y text-sm">
						{migrations.map((migration) => (
							<li key={String(migration.id)} className="flex items-center gap-2 py-2">
								<code className="text-xs">{String(migration.id)}</code>{" "}
								<span className="text-cms-muted-foreground text-xs">{String(migration.op)}</span>
							</li>
						))}
					</ul>
				)}
			</Section>
		</div>
	);
}

function SchemaEditor({
	state,
	tab,
	actionsSlot,
}: {
	state: SchemaScreenState;
	tab: SchemaTab;
	actionsSlot?: HTMLElement | null;
}) {
	const t = useTranslator(schemaMessages);
	const site = useSite();
	const router = useAdminRouter();
	const base = useMemo(() => (isObj(state.schema) ? (state.schema as Obj) : {}), [state.schema]);
	const writable = state.access.writable;
	const [draft, setDraft] = useState<Obj>(base);
	const [renames, setRenames] = useState<Rename[]>([]);
	const [issues, setIssues] = useState<readonly Issue[]>([]);
	const [reviewing, setReviewing] = useState(false);
	const [applyFailed, setApplyFailed] = useState(false);
	const [creating, setCreating] = useState(false);
	const collections = collectionsOf(draft);
	const names = Object.keys(collections);
	const [selectedName, setSelected] = useState<string | undefined>(names[0]);
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
					<span className="hidden text-cms-muted-foreground text-xs sm:inline">
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

	const reason = state.access.writable ? null : (state.access.reason as keyof typeof READ_ONLY_KEY | undefined);
	return (
		<SchemaEditProvider value={context}>
			<div className="flex min-h-0 flex-1 flex-col" data-testid="schema-screen">
				{actions && actionsSlot !== undefined
					? actionsSlot
						? createPortal(actions, actionsSlot)
						: null
					: actions && (
							<div className="flex items-center justify-end gap-2.5 border-b bg-cms-background px-4 py-2 lg:px-10">
								{actions}
							</div>
						)}
				<div className="min-h-0 flex-1 overflow-y-auto">
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
										<div className="flex shrink-0 flex-col gap-0.5 lg:w-52">
											<div className="flex items-center justify-between pb-2 pl-2.5">
												<span className="font-medium text-cms-muted-foreground text-xs">
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
												{names.map((name) => {
													const collection = collections[name];
													const active = name === selected;
													return (
														<button
															key={name}
															type="button"
															aria-current={active ? "true" : undefined}
															className={cn(
																"flex h-8 shrink-0 items-center gap-2 rounded-md border border-transparent px-2.5 text-left text-sm outline-none transition-colors hover:bg-cms-muted focus-visible:ring-2 focus-visible:ring-cms-ring/50",
																active && "border-cms-border bg-cms-card font-medium hover:bg-cms-card",
															)}
															onClick={() => setSelected(name)}
														>
															<span className="flex-1 truncate">{String(collection?.label ?? name)}</span>
															{!savedNames.includes(name) && <Badge variant="outline">{t("collection.new")}</Badge>}
															<span className="font-normal text-cms-muted-foreground text-xs">
																{t(collection?.kind === "item" ? "collection.kindItem" : "collection.kindDocument")}
															</span>
														</button>
													);
												})}
											</nav>
										</div>
										<div className="min-w-0 flex-1">
											{selected && collections[selected] ? (
												<CollectionEditor
													key={selected}
													name={selected}
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
												<p className="text-cms-muted-foreground text-sm">{t("collection.none")}</p>
											)}
										</div>
									</div>
								)}
								{tab === "locales" && (
									<LocalesEditor
										file={draft}
										savedCodes={localesOf(base).map((locale) => locale.code)}
										update={updateFile}
									/>
								)}
								{tab === "site" && <SiteEditor file={draft} siteUrl={state.siteUrl} update={updateFile} />}
								{tab === "admin" && <AdminEditor file={draft} update={updateFile} />}
								{tab === "file" && <FileInfo file={draft} state={state} />}
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
					if (tab !== "collections") router.navigate(site.adminHref("/settings/collections"));
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
export function SchemaSettings({ tab, actionsSlot }: { tab: SchemaTab; actionsSlot?: HTMLElement | null }) {
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
		return <SchemaEditor key={query.data.hash ?? "site"} state={query.data} tab={tab} actionsSlot={actionsSlot} />;
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
