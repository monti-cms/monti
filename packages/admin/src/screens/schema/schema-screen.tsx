"use client";

import { useSite, useTranslator } from "@monti-cms/core/client";
import type { SchemaIssue, SchemaScreenState } from "@monti-cms/core/schema-edit";
import { useQuery } from "@tanstack/react-query";
import { Lock, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "../../lib/utils/cn";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Skeleton } from "../../ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { errorText } from "../admin-api";
import { AdminShell } from "../shared/admin-shell";
import { useConfirm } from "../shared/confirm-dialog";
import { CollectionEditor } from "./collection-editor";
import { IssueList, Labeled, Pick, SchemaEditProvider } from "./controls";
import { LocalesEditor } from "./locales-editor";
import { schemaMessages } from "./messages";
import { reloadPage, rememberSaved, takeSavedMessage } from "./reload";
import { ReviewDialog } from "./review-dialog";
import { fetchSchema, type SavedSchema, SCHEMA_KEY } from "./schema-api";
import {
	addCollection,
	collectionsOf,
	isObj,
	localesOf,
	nameProblem,
	type Obj,
	type Rename,
	recordRename,
	removeCollection,
	sameJson,
	setCollection,
} from "./schema-model";

/** Why a schema file may not be edited here, as the key of the sentence that says it. */
const READ_ONLY_KEY = {
	production: "readonly.production",
	no_schema_file: "readonly.noFile",
	not_writable: "readonly.notWritable",
} as const;

function AddCollection({
	taken,
	onAdd,
}: {
	taken: readonly string[];
	onAdd: (name: string, kind: "document" | "item") => void;
}) {
	const t = useTranslator(schemaMessages);
	const [name, setName] = useState("");
	const [kind, setKind] = useState<"document" | "item">("document");
	const problem = name === "" ? null : nameProblem(name, taken);
	return (
		<div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-2" data-testid="add-collection">
			<Labeled label={t("collection.newName")} className="min-w-32 flex-1">
				<Input
					value={name}
					aria-label={t("collection.newName")}
					placeholder="article"
					aria-invalid={problem ? true : undefined}
					onChange={(event) => setName(event.target.value)}
				/>
			</Labeled>
			<Pick
				label={t("collection.kind")}
				className="w-36"
				value={kind}
				items={[
					{ value: "document", label: t("collection.kindDocument") },
					{ value: "item", label: t("collection.kindItem") },
				]}
				onChange={(value) => setKind(value as "document" | "item")}
			/>
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={name === "" || problem !== null}
				onClick={() => {
					onAdd(name, kind);
					setName("");
				}}
			>
				<Plus aria-hidden />
				{t("collection.add")}
			</Button>
			{problem && <p className="w-full text-cms-destructive text-xs">{t(`name.${problem}`)}</p>}
		</div>
	);
}

/** The parts of the file the screen does not edit: site and admin settings and seed data (shown as they are), and the transforms already recorded. */
function FileInfo({ file }: { file: Obj }) {
	const t = useTranslator(schemaMessages);
	const migrations = Array.isArray(file.migrations) ? (file.migrations as Obj[]) : [];
	const rest = (["site", "admin", "seed"] as const).filter((key) => file[key] !== undefined);
	return (
		<div className="flex flex-col gap-4">
			<p className="text-cms-muted-foreground text-xs">{t("file.hint")}</p>
			{rest.map((key) => (
				<section key={key} className="flex flex-col gap-1">
					<h4 className="font-medium text-sm">{key}</h4>
					<pre className="max-h-64 overflow-auto rounded-md border bg-cms-muted/40 p-2 text-xs">
						{JSON.stringify(file[key], null, 2)}
					</pre>
				</section>
			))}
			<section className="flex flex-col gap-1">
				<h4 className="font-medium text-sm">{t("file.migrations")}</h4>
				{migrations.length === 0 ? (
					<p className="text-cms-muted-foreground text-xs">{t("file.noMigrations")}</p>
				) : (
					<ul className="flex flex-col gap-1 text-xs">
						{migrations.map((migration) => (
							<li key={String(migration.id)} className="rounded-md border px-2 py-1">
								<code>{String(migration.id)}</code>{" "}
								<span className="text-cms-muted-foreground">{String(migration.op)}</span>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}

function SchemaEditor({ state }: { state: SchemaScreenState }) {
	const t = useTranslator(schemaMessages);
	const base = useMemo(() => (isObj(state.schema) ? (state.schema as Obj) : {}), [state.schema]);
	const writable = state.access.writable;
	const [draft, setDraft] = useState<Obj>(base);
	const [renames, setRenames] = useState<Rename[]>([]);
	const [issues, setIssues] = useState<readonly SchemaIssue[]>([]);
	const [reviewing, setReviewing] = useState(false);
	const [applyFailed, setApplyFailed] = useState(false);
	const [tab, setTab] = useState("collections");
	const collections = collectionsOf(draft);
	const names = Object.keys(collections);
	const [selectedName, setSelected] = useState<string | undefined>(names[0]);
	const selected = selectedName && selectedName in collections ? selectedName : names[0];
	const { confirm, dialog } = useConfirm();
	const dirty = !sameJson(draft, base);
	const savedNames = Object.keys(collectionsOf(base));

	useEffect(() => {
		const message = takeSavedMessage();
		if (message) toast.success(message);
	}, []);
	useEffect(() => {
		if (!dirty) return;
		const warn = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);

	const updateFile = (change: (file: Obj) => Obj) => setDraft((current) => change(current));
	const context = useMemo(
		() => ({
			disabled: !writable,
			vocabulary: state.vocabulary,
			issues,
			collectionNames: names,
			file: draft,
		}),
		[writable, state.vocabulary, issues, names, draft],
	);

	const discard = async () => {
		const ok = await confirm({
			title: t("discard.title"),
			description: t("discard.description"),
			confirmLabel: t("discard.confirm"),
			destructive: true,
		});
		if (!ok) return;
		setDraft(base);
		setRenames([]);
		setIssues([]);
	};

	const reason = state.access.writable ? null : (state.access.reason as keyof typeof READ_ONLY_KEY | undefined);
	return (
		<SchemaEditProvider value={context}>
			<div className="flex min-h-0 flex-1 flex-col" data-testid="schema-screen">
				<div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 lg:px-5">
					<code className="rounded bg-cms-muted px-1.5 py-0.5 text-xs">{state.file ?? t("status.noFile")}</code>
					<Badge variant="secondary">{t("status.version", { version: state.schemaVersion })}</Badge>
					<Badge variant="outline">
						{state.applied ? t("status.applied", { version: state.applied.schemaVersion }) : t("status.notApplied")}
					</Badge>
					{!writable && (
						<Badge variant="outline" className="gap-1">
							<Lock aria-hidden />
							{t("status.readOnly")}
						</Badge>
					)}
					<div className="ml-auto flex items-center gap-2">
						{dirty && writable && (
							<>
								<Button type="button" variant="ghost" size="sm" onClick={() => void discard()}>
									{t("actions.discard")}
								</Button>
								<span className="hidden text-cms-muted-foreground text-xs sm:inline">{t("actions.unsaved")}</span>
							</>
						)}
						<Button type="button" size="sm" disabled={!writable || !dirty} onClick={() => setReviewing(true)}>
							{t("actions.review")}
						</Button>
					</div>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto">
					<div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 lg:px-5">
						{reason && (
							<Alert layout="stack" data-testid="schema-read-only">
								<AlertTitle>{t("readonly.title")}</AlertTitle>
								<AlertDescription>{t(READ_ONLY_KEY[reason])}</AlertDescription>
							</Alert>
						)}
						{applyFailed && (
							<Alert variant="danger" layout="stack">
								<AlertDescription>{t("save.applyFailedNote")}</AlertDescription>
							</Alert>
						)}
						{state.issues.length > 0 && (
							<Alert variant="danger" layout="stack" data-testid="schema-file-invalid">
								<AlertTitle>{t("invalid.title")}</AlertTitle>
								<AlertDescription className="flex flex-col gap-2">
									<span>{t("invalid.description")}</span>
									<IssueList issues={state.issues} />
								</AlertDescription>
							</Alert>
						)}
						{issues.length > 0 && !reviewing && (
							<Alert variant="danger" layout="stack">
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
							<Tabs value={tab} onValueChange={(value) => typeof value === "string" && setTab(value)}>
								<TabsList className="w-full justify-start sm:w-fit">
									<TabsTrigger value="collections">{t("tabs.collections")}</TabsTrigger>
									<TabsTrigger value="locales">{t("tabs.locales")}</TabsTrigger>
									<TabsTrigger value="file">{t("tabs.file")}</TabsTrigger>
								</TabsList>
								<TabsContent value="collections" className="pt-3">
									<div className="flex flex-col gap-4 lg:flex-row">
										<nav
											aria-label={t("tabs.collections")}
											className="flex shrink-0 gap-1 overflow-x-auto pb-1 lg:w-52 lg:flex-col lg:overflow-visible lg:pb-0"
										>
											{names.map((name) => {
												const collection = collections[name];
												const active = name === selected;
												return (
													<Button
														key={name}
														type="button"
														variant={active ? "secondary" : "ghost"}
														size="sm"
														aria-current={active ? "true" : undefined}
														className={cn("shrink-0 justify-start", active && "font-medium")}
														onClick={() => setSelected(name)}
													>
														<span className="truncate">{String(collection?.label ?? name)}</span>
														{!savedNames.includes(name) && <Badge variant="outline">{t("collection.new")}</Badge>}
													</Button>
												);
											})}
											{writable && (
												<AddCollection
													taken={names}
													onAdd={(name, kind) => {
														updateFile((file) => addCollection(file, name, kind));
														setSelected(name);
													}}
												/>
											)}
										</nav>
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
								</TabsContent>
								<TabsContent value="locales" className="pt-3">
									<LocalesEditor
										file={draft}
										savedCodes={localesOf(base).map((locale) => locale.code)}
										update={updateFile}
									/>
								</TabsContent>
								<TabsContent value="file" className="pt-3">
									<FileInfo file={draft} />
								</TabsContent>
							</Tabs>
						)}
					</div>
				</div>
			</div>
			{dialog}
			{state.hash !== null && (
				<ReviewDialog
					open={reviewing}
					onOpenChange={setReviewing}
					draft={draft}
					renames={renames}
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

/** The schema settings screen: edits `monti.schema.json` on the development server, shows it read-only everywhere else. */
export function SchemaScreen() {
	const site = useSite();
	const t = useTranslator(schemaMessages);
	const query = useQuery({
		queryKey: SCHEMA_KEY,
		queryFn: ({ signal }) => fetchSchema(site, signal),
		// The file is the truth: a screen that was open while it changed would edit a stale copy.
		staleTime: 0,
		refetchOnWindowFocus: false,
	});
	const error = query.error ? errorText(site, query.error, t("load.failed")) : null;
	return (
		<AdminShell title={t("title")} sidebar={{ activeNav: "schema" }}>
			{query.data ? (
				<SchemaEditor key={query.data.hash ?? "site"} state={query.data} />
			) : (
				<div className="flex flex-col gap-3 p-5">
					{error ? (
						<Alert variant="danger" layout="stack">
							<AlertDescription className="flex items-center gap-3">
								{error}
								<Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
									{t("load.retry")}
								</Button>
							</AlertDescription>
						</Alert>
					) : (
						<Skeleton className="h-40 w-full" />
					)}
				</div>
			)}
		</AdminShell>
	);
}
