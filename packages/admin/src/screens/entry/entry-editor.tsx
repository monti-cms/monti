import { type EntryState, type PublishTask, publicPath } from "@monti-cms/core";
import {
	Banner,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	EditorHeader,
	EditorTitleRule,
	EntryStatus,
	type EntryStatusKind,
	FormField,
	FormFieldLabel,
	IconButton,
	Inline,
	Input,
	Separator,
	SplitButton,
	Stack,
	StatusBar,
	StatusBarAnnouncer,
	StatusBarCell,
	StatusBarList,
	StatusBarSpacer,
	Text,
	TextButton,
	TodoDone,
	TodoItem,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	useShortcut,
} from "@monti-cms/ui";
import { ChevronLeft, OverflowMenuHorizontal, RightPanelOpen, Spark } from "@monti-cms/ui/icons";
import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { download } from "../../download";
import { useLeaveGuard } from "../../draft/leave-guard";
import { BodyEditor } from "../../editor/body-editor";
import { docLength, useBodyCatalogs } from "../../editor/use-body-editor";
import { useAdmin } from "../../operations/admin-context";
import { useOperation, useRead } from "../../operations/use-operation";
import { SessionEndedBanner } from "../frame/session-ended";
import type { SchemaRead } from "../settings/schema-draft";
import { type CompareMode, CompareView } from "./compare-view";
import { clock, day, dayTime } from "./dates";
import { EntryProperties, fieldInputId, panelLayout } from "./entry-properties";
import { type EntryRead, type SaveState, useEntryEditor } from "./use-entry-editor";
import { usePublish } from "./use-publish";

const STATUS: Record<EntryState, EntryStatusKind> = {
	draft: "draft",
	published: "published",
	changed: "editing",
	archived: "archived",
};

const SAVE_KEYS = ["mod", "s"] as const;

/** Where a to-do row points, in the panel or the body (editor.md: the row's detail says only the place). */
const taskPlace = (task: PublishTask) => (task.field && task.field !== "doc" ? "panel" : "body");

/**
 * The entry editor (doc 02, editor.md): a page of its own outside the frame. The head holds the way back, the entry's address and state, save,
 * preview and publish; the writing column holds the title and the body; the property panel sits beside it; the status bar says how the save stands,
 * what is left to do before publishing and how long the text is. A save refused because the entry was saved elsewhere, and input this browser kept from
 * an earlier visit, show a banner under the head and open the comparison.
 */
export function EntryEditor({
	collection,
	id,
	compare,
	onBack,
	onCompare,
	onOpen,
}: {
	collection: string;
	id: string;
	/** The comparison shown over the editor (`?compare=`), or `null`. */
	compare: CompareMode | null;
	onBack: () => void;
	onCompare: (mode: CompareMode | null) => void;
	/** Another entry (a copy just made). */
	onOpen: (id: string) => void;
}) {
	const { t, language } = useAdmin();
	const source = useMemo(() => ({ kind: "entry" as const, id }), [id]);
	const editor = useEntryEditor(source);
	const schema = useRead<SchemaRead>("schema.read");
	const catalogs = useBodyCatalogs(collection);
	const [panel, setPanel] = useState(true);
	const [tab, setTab] = useState(0);
	const [todoOpen, setTodoOpen] = useState(false);
	const body = useRef<Editor | null>(null);
	const keepEditor = useCallback((made: Editor | null) => {
		body.current = made;
	}, []);
	const publish = usePublish(editor, { onBlocked: () => setTodoOpen(true) });
	const preview = useOperation<{ token: string; path: string | null }>("entries.previewLink");
	const duplicate = useOperation<{ output: { id: string } }>("entries.duplicate");
	const archive = useOperation("entries.archive");
	const unarchive = useOperation("entries.unarchive");
	const exporter = useOperation("entries.export");
	const saveKeys = useShortcut(SAVE_KEYS);
	useLeaveGuard({ changes: editor.draft.changes, revertAll: editor.draft.revertAll });

	const read = editor.loaded as EntryRead | null;
	const archived = read?.state === "archived";
	const trashed = Boolean(read?.entry.trashedAt);
	const readOnly = archived || trashed;
	const definition = schema.data?.schema.collections[collection];
	const fieldLabels = schema.data?.adminValues[collection]?.fields ?? {};
	const fieldLabel = (field: string) => fieldLabels[field]?.label ?? field;
	const slug = String(editor.value("slug") ?? "");
	const address = schema.data && slug ? publicPath(schema.data.schema, collection, slug) : null;

	const save = editor.save;
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "s") {
				event.preventDefault();
				if (!readOnly) void save();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [save, readOnly]);

	/** A to-do row takes the cursor to its place: the field in its tab, or the block in the body. */
	const goTo = (task: PublishTask) => {
		setTodoOpen(false);
		if (taskPlace(task) === "panel" && task.field) {
			setPanel(true);
			const layout = panelLayout(schema.data, collection, t("entry.defaultTab"));
			const index = layout.findIndex((each) =>
				each.fields.some((entry) => (typeof entry === "string" ? entry : entry.fields).includes(task.field ?? "")),
			);
			if (index >= 0) setTab(index);
			const field = task.field;
			requestAnimationFrame(() => document.getElementById(fieldInputId(field))?.focus());
			return;
		}
		const view = body.current;
		if (!view) return;
		let at: number | null = null;
		view.state.doc.descendants((node, pos) => {
			if (at !== null) return false;
			if (task.block && node.attrs.blockId === task.block) at = pos;
			return true;
		});
		if (at === null) return view.commands.focus();
		const node = view.state.doc.nodeAt(at);
		const inside = node?.isTextblock ? at + 1 : at;
		view.chain().focus().setTextSelection(inside).scrollIntoView().run();
	};

	if (compare && read)
		return (
			<CompareView
				editor={editor}
				mode={compare}
				schema={schema.data}
				collection={collection}
				address={address}
				onBack={() => onCompare(null)}
			/>
		);

	const saveCell: Record<SaveState, { text: string; tone?: "warning" | "danger"; press?: () => void }> = {
		unsaved: { text: t("entry.save.unsaved"), tone: "warning", press: () => void save() },
		saved: { text: t("entry.save.saved") },
		browser: { text: t("entry.save.browser"), tone: "warning", press: () => onCompare("draft") },
		conflict: { text: t("entry.save.conflict"), tone: "danger", press: () => onCompare("conflict") },
		signedOut: { text: t("entry.save.signedOut"), tone: "danger", press: editor.signIn },
	};
	const cell = saveCell[editor.saveState];

	// The required fields that are filled: the ✓ line under the rows says what was checked.
	const filled = Object.entries(definition?.fields ?? {})
		.filter(
			([field, def]) =>
				def.required &&
				!publish.tasks.some((task) => task.field === field) &&
				(field === "title" ? editor.title : editor.value(field === "slug" ? "slug" : `values.${field}`)),
		)
		.map(([field]) => (field === "title" ? t("entry.title") : fieldLabel(field)));
	const taskTitle = (task: PublishTask) =>
		task.code === "required" && task.field
			? t("entry.todo.fill", { field: task.field === "title" ? t("entry.title") : fieldLabel(task.field) })
			: t(task.message);
	const taskDetail = (task: PublishTask) =>
		task.field === "title"
			? t("entry.todo.title")
			: taskPlace(task) === "panel"
				? t(task.code === "required" ? "entry.todo.panelEmpty" : "entry.todo.panel")
				: t("entry.todo.body");

	const hasContent = editor.title.trim() !== "" || editor.doc.blocks.length > 0;
	const publishedAt = publish.publishedAt;

	const head = readOnly ? (
		archived ? (
			<Button
				variant="primary"
				loading={unarchive.pending}
				onClick={async () => {
					if ((await unarchive.run({ ids: [id] })).ok) await editor.reload();
				}}
			>
				{t("entry.unarchive")}
			</Button>
		) : null
	) : (
		<>
			<Tooltip>
				<TooltipTrigger
					render={
						<TextButton loading={editor.saving} onClick={() => void save()}>
							{t("entry.saveAction")}
						</TextButton>
					}
				/>
				<TooltipContent side="bottom">{saveKeys}</TooltipContent>
			</Tooltip>
			{hasContent ? (
				<Button
					variant="secondary"
					loading={preview.pending}
					onClick={async () => {
						if (editor.dirty && !(await save())) return;
						const link = await preview.run({ id });
						if (link.ok && link.body.path)
							window.open(`${link.body.path}?preview=${encodeURIComponent(link.body.token)}`, "_blank", "noopener");
					}}
				>
					{t("entry.preview")}
				</Button>
			) : null}
			{publish.button === "first" ? (
				<Button variant="primary" loading={publish.publishing} onClick={() => void publish.publish()}>
					{t("entry.publish")}
				</Button>
			) : (
				<SplitButton
					menuLabel={t("entry.publishMenu")}
					disabled={publish.button === "done"}
					loading={publish.publishing}
					onClick={() => void publish.publish("keep")}
					menu={
						<>
							<DropdownMenuItem
								onClick={() => void publish.publish("keep")}
								caption={publishedAt ? t("entry.publishKeep", { date: day(publishedAt, language) }) : undefined}
							>
								{t("entry.publish")}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => void publish.publish("today")}
								caption={t("entry.publishTodayDate", { date: day(new Date(), language) })}
							>
								{t("entry.publishToday")}
							</DropdownMenuItem>
						</>
					}
				>
					{publish.button === "done" ? t("entry.publishedState") : t("entry.publish")}
				</SplitButton>
			)}
		</>
	);

	return (
		<Stack gap={0} height="screen" overflow="clip" background="page">
			{/* Every banner of the screen stands at its very top, broader first: the session over this entry's own (common.md, banners). */}
			<SessionEndedBanner />
			{editor.loadRefusal ? (
				<Banner tone="danger" title={t("entry.loadFailed")} plainMeta>
					<TextButton onClick={() => void editor.reload()}>{t("entry.retry")}</TextButton>
				</Banner>
			) : null}
			{editor.conflict ? (
				<Banner
					tone="danger"
					title={
						editor.conflict.at ? t("entry.conflict", { at: clock(editor.conflict.at) }) : t("entry.conflictNoTime")
					}
					meta={t("entry.conflictMeta")}
					plainMeta
				>
					<TextButton variant="underline" onClick={() => onCompare("conflict")}>
						{t("entry.compare")}
					</TextButton>
					<TextButton onClick={() => void editor.loadLatest()}>{t("entry.loadLatest")}</TextButton>
				</Banner>
			) : null}
			{editor.browserCopy ? (
				<Banner
					title={t("entry.browserCopy")}
					meta={editor.browserCopy.savedAt ? dayTime(editor.browserCopy.savedAt, language) : undefined}
				>
					<TextButton variant="underline" onClick={() => onCompare("draft")}>
						{t("entry.compare")}
					</TextButton>
					<TextButton onClick={editor.loadBrowserCopy}>{t("entry.loadCopy")}</TextButton>
					<TextButton variant="quiet" onClick={editor.dropBrowserCopy}>
						{t("entry.dropCopy")}
					</TextButton>
				</Banner>
			) : null}
			{trashed ? <Banner tone="neutral" title={t("entry.trashedBanner")} /> : null}
			<EditorHeader>
				<Inline gap={12} minWidth={0} paddingX={12}>
					<TextButton variant="quiet" onClick={onBack}>
						<ChevronLeft aria-hidden />
						{schema.data?.adminValues[collection]?.label ?? collection}
					</TextButton>
					{address ? (
						<Text variant="meta" tone="faint" truncate>
							{address}
						</Text>
					) : null}
					{read ? <EntryStatus status={STATUS[read.state]}>{t(`entry.state.${read.state}`)}</EntryStatus> : null}
				</Inline>
				<Inline gap={12} justify="end">
					{head}
					{/* The pill stands alone: the line sets it apart from the screen's tools (the panel, ⋯, ✦). */}
					<Separator orientation="vertical" length="control" flush />
					<IconButton label={t("entry.properties")} side="bottom" pressed={panel} onClick={() => setPanel(!panel)}>
						<RightPanelOpen aria-hidden />
					</IconButton>
					{readOnly ? null : (
						<DropdownMenu>
							<IconButton
								label={t("entry.more")}
								side="bottom"
								trigger={(button) => <DropdownMenuTrigger render={button} />}
							>
								<OverflowMenuHorizontal aria-hidden />
							</IconButton>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onClick={async () => {
										const copy = await duplicate.run({ id });
										if (copy.ok) onOpen(copy.body.output.id);
									}}
								>
									{t("entry.duplicate")}
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={async () => {
										if ((await archive.run({ ids: [id] })).ok) await editor.reload();
									}}
								>
									{t("entry.archive")}
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={async () => {
										const file = await exporter.run({ ids: [id] });
										if (file.ok) download(`${collection}-${slug || id}.json`, file.body);
									}}
								>
									{t("entry.export")}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
					<IconButton label={t("frame.assistant")} side="bottom">
						<Spark aria-hidden />
					</IconButton>
				</Inline>
			</EditorHeader>
			<Inline align="stretch" gap={0} grow minHeight={0} overflow="hidden">
				<Stack gap={0} grow minWidth={0} overflow="y" paddingX={48} paddingTop={16}>
					<Stack gap={0} grow width="full" maxWidth="reading" centered paddingBottom={48}>
						<Stack gap={0} paddingTop={16} paddingBottom={32}>
							<FormField>
								<FormFieldLabel htmlFor={fieldInputId("title")} hidden>
									{t("entry.title")}
								</FormFieldLabel>
								<Input
									id={fieldInputId("title")}
									value={editor.title}
									placeholder={t("entry.title")}
									size="display"
									appearance="inline"
									disabled={readOnly}
									onChange={(event) => editor.set("title", event.target.value)}
								/>
							</FormField>
							<EditorTitleRule />
						</Stack>
						{read && catalogs ? (
							<BodyEditor
								key={editor.bodyKey}
								doc={editor.doc}
								catalogs={catalogs}
								onChange={(doc) => editor.set("doc", doc)}
								editable={!readOnly}
								templates
								onEditor={keepEditor}
							/>
						) : null}
					</Stack>
				</Stack>
				{panel ? (
					<EntryProperties
						editor={editor}
						schema={schema.data}
						collection={collection}
						tab={tab}
						onTab={setTab}
						readOnly={readOnly}
					/>
				) : null}
			</Inline>
			{read ? (
				<StatusBar>
					{readOnly ? null : (
						<StatusBarCell tone={cell.tone} onClick={cell.press} render={cell.press ? undefined : <span />}>
							{cell.text}
						</StatusBarCell>
					)}
					<StatusBarAnnouncer>{cell.text}</StatusBarAnnouncer>
					<StatusBarList
						trigger={
							<StatusBarCell tone={publish.blocking > 0 ? "warning" : undefined}>
								{publish.tasks.length > 0
									? t("entry.todo.count", { count: publish.tasks.length })
									: t("entry.todo.none")}
							</StatusBarCell>
						}
						label={t("entry.todo.label")}
						count={publish.tasks.length}
						open={todoOpen}
						onOpenChange={setTodoOpen}
					>
						{publish.tasks.map((task, index) => (
							<TodoItem
								key={`${task.code}:${task.field ?? ""}:${task.block ?? ""}:${index}`}
								title={taskTitle(task)}
								detail={taskDetail(task)}
								blocking={task.blocking}
								onOpen={() => goTo(task)}
							/>
						))}
						{publish.tasks.length === 0 ? (
							<TodoDone>{t("entry.todo.none")}</TodoDone>
						) : filled.length > 0 ? (
							<TodoDone>{filled.join(" · ")}</TodoDone>
						) : null}
					</StatusBarList>
					<StatusBarSpacer />
					<StatusBarCell end render={<span />}>
						{t("entry.chars", { count: docLength(editor.doc) })}
					</StatusBarCell>
				</StatusBar>
			) : null}
		</Stack>
	);
}
