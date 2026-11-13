import {
	cleanMediaValue,
	type EntryState,
	localeModeOf,
	notChosenFields,
	type PublishTask,
	publicPath,
	storedFields,
	type TrashedEntry,
} from "@monti-cms/core";
import {
	Banner,
	Box,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	EditorHeader,
	EditorMarginLine,
	EditorTitleRule,
	EntryStatus,
	type EntryStatusKind,
	FormField,
	FormFieldLabel,
	IconButton,
	Inline,
	Input,
	ProposalBubble,
	ProposalBubbleDock,
	Separator,
	SplitButton,
	Stack,
	StandalonePage,
	StatusBar,
	StatusBarAnnouncer,
	StatusBarCell,
	StatusBarList,
	StatusBarListGroup,
	StatusBarSpacer,
	Text,
	TextButton,
	TodoDone,
	TodoItem,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	toast,
	useShortcut,
} from "@monti-cms/ui";
import {
	Archive,
	ChevronLeft,
	Copy,
	Export,
	OverflowMenuHorizontal,
	RightPanelOpen,
	TrashCan,
} from "@monti-cms/ui/icons";
import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssistantButton } from "../../assistant/assistant-button";
import { draftContext } from "../../assistant/draft-context";
import { useOpenConversation, useRemakeItem, useScreenContext } from "../../assistant/use-assistant";
import { download } from "../../download";
import { useLeaveFiles, useLeaveGuard, useUploadsGoing } from "../../draft/leave-guard";
import { BodyEditor } from "../../editor/body-editor";
import { openImageCard } from "../../editor/media-context";
import { StaleProposalMargin } from "../../editor/proposal-margin";
import {
	anchorBlock,
	drawable,
	findBlock,
	scrollToProposal,
	staleProposals,
	takeInEditor,
} from "../../editor/proposal-marks";
import { type PairedRows, pairedSource } from "../../editor/translation";
import { docLength, useBodyCatalogs } from "../../editor/use-body-editor";
import { useFieldUploads } from "../../media/use-field-uploads";
import { useAdmin } from "../../operations/admin-context";
import { useOperation, useRead } from "../../operations/use-operation";
import { usePurge, useRestore, useTrashMove } from "../../trash/use-trash";
import { focusText, useFocusHandOff } from "../frame/focus-hand-off";
import { SessionEndedBanner } from "../frame/session-ended";
import { useLanguageName } from "../list/column-menu";
import type { SchemaRead } from "../settings/schema-draft";
import { type CompareMode, CompareView } from "./compare-view";
import { clock, day, dayTime } from "./dates";
import { EntryProperties, fieldInputId, fieldPath, panelFields, panelLayout } from "./entry-properties";
import {
	decidedOnly,
	FieldChange,
	LocaleTabs,
	PairedView,
	SourceChangedBanner,
	SourceChangeRows,
	SourcePane,
	type SourceView,
	SourceViewPicker,
	TranslationMargin,
	usePairedRows,
	useTranslation,
} from "./translation";
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
	onTrash,
	onCompare,
	onOpen,
	onLanguages,
}: {
	collection: string;
	id: string;
	/** The comparison shown over the editor (`?compare=`), or `null`. */
	compare: CompareMode | null;
	onBack: () => void;
	/** To the trash's screen: where an entry in the trash goes back to, and where one deleted for good leaves for. */
	onTrash: () => void;
	onCompare: (mode: CompareMode | null) => void;
	/** Another entry (a copy just made). */
	onOpen: (id: string) => void;
	/** To settings › languages, from the "+ Language" menu. */
	onLanguages: () => void;
}) {
	const { t, language, apiBase, templates: templatesOn } = useAdmin();
	const languageName = useLanguageName();
	const source = useMemo(() => ({ kind: "entry" as const, id }), [id]);
	const schema = useRead<SchemaRead>("schema.read");
	const structure = schema.data?.schema;
	// A translation's choice is its source's, which its own values do not hold: nothing of it is taken for another option's.
	const sourceLocale = structure?.locales.source;
	const notChosen = useCallback(
		(values: Record<string, unknown>, locale: string) =>
			structure && locale === sourceLocale
				? notChosenFields(structure.collections[collection], values)
				: new Set<string>(),
		[structure, sourceLocale, collection],
	);
	const editor = useEntryEditor(source, notChosen);
	const catalogs = useBodyCatalogs(collection);
	const [panel, setPanel] = useState(true);
	const [tab, setTab] = useState(0);
	const [todoOpen, setTodoOpen] = useState(false);
	const [altCard, setAltCard] = useState<string | null>(null);
	const body = useRef<Editor | null>(null);
	const [bodyEditor, setBodyEditor] = useState<Editor | null>(null);
	const keepEditor = useCallback((made: Editor | null) => {
		body.current = made;
		setBodyEditor(made);
	}, []);
	const publish = usePublish(editor, { onBlocked: () => setTodoOpen(true) });
	// The field's alt text was for the old picture (2026-11-09, owner): the new one has only what was said while it went up.
	const fieldUploads = useFieldUploads((field, item, said) => {
		editor.set(`values.${field}`, cleanMediaValue({ media: item.id, ...said }));
	});
	const preview = useOperation<{ token: string; path: string | null }>("entries.previewLink");
	const duplicate = useOperation<{ output: { id: string } }>("entries.duplicate");
	const archive = useOperation("entries.archive");
	const uploadsGoing = useUploadsGoing();
	const unarchive = useOperation("entries.unarchive");
	const exporter = useOperation("entries.export");
	const saveKeys = useShortcut(SAVE_KEYS);
	useLeaveGuard({
		changes: editor.draft.changes,
		revertAll: editor.draft.revertAll,
		save: async () => (await editor.save()) !== null,
	});

	const read = editor.loaded as EntryRead | null;
	// What goes along with a request to the assistant from here (doc 10, context): this entry as it was read, and what is not saved yet.
	const unsavedNow = editor.draft.changes;
	useScreenContext(
		read ? { screen: "entry", collection, entry: { id, version: read.entry.version, title: read.entry.title } } : null,
		() => draftContext(unsavedNow),
	);
	const archived = read?.state === "archived";
	const trashed = Boolean(read?.entry.trashedAt);
	const readOnly = archived || trashed;
	// In the trash (doc 11): how long it stays and what a permanent delete keeps, read with it.
	const inTrash = useRead<TrashedEntry>("trash.get", { id }, { skip: !trashed, afterWrites: true }).data;
	const trash = useTrashMove();
	const restore = useRestore();
	const purge = usePurge();
	const fieldLabels = schema.data?.adminValues[collection]?.fields ?? {};
	const fieldLabel = (field: string) => fieldLabels[field]?.label ?? field;
	const slug = String(editor.value("slug") ?? "");
	const address = schema.data && slug ? publicPath(schema.data.schema, collection, slug, read?.entry.locale) : null;

	// Languages (doc 04): the tabs over the title, and in a translation its source beside it, side by side, or not at all.
	const translation = useTranslation(id, schema.data?.schema, editor);
	const compared = translation.compared;
	const [view, setView] = useState<SourceView>("side");
	const leaveFiles = useLeaveFiles();
	const showView = (next: SourceView) => {
		const change = () => {
			setView(next);
			// The source takes the place of the properties beside the text (translation.md, the head row).
			if (next !== "off") setPanel(false);
		};
		// Side by side the body is drawn elsewhere: it starts again, and a picture going up in it stops.
		if ((next === "paired") !== (view === "paired")) leaveFiles(change);
		else change();
	};
	const opensBeside = translation.isTranslation && view !== "off";
	useEffect(() => {
		if (opensBeside) setPanel(false);
	}, [opensBeside]);
	// The source block paired with the translation's block the cursor is in, marked beside it (translation.md, the source pane).
	const [pair, setPair] = useState<string | null>(null);
	useEffect(() => {
		if (!bodyEditor || !translation.isTranslation) return;
		const sync = () => setPair(bodyEditor.isFocused ? pairedSource(bodyEditor.state) : null);
		const events = ["selectionUpdate", "focus", "blur"] as const;
		for (const event of events) bodyEditor.on(event, sync);
		return () => {
			for (const event of events) bodyEditor.off(event, sync);
		};
	}, [bodyEditor, translation.isTranslation]);
	const sourceName = (code: string) =>
		schema.data?.schema.locales.list.find((locale) => locale.code === code)?.name ?? code;
	const beside =
		compared && view === "side" ? (
			<SourcePane compared={compared} localeName={sourceName(compared.source.locale)} current={pair} />
		) : null;
	const paired = Boolean(compared) && view === "paired";
	const pairedRows = usePairedRows(paired ? compared : null, catalogs);
	// With the entry's other controls: before the read, and after one that failed, "+ language" made a translation of an entry nobody had read, and the
	// tabs stood elsewhere than where they stay.
	const languages =
		read && translation.multilingual && schema.data ? (
			<Inline minHeight="control-md" justify="between" gap={12}>
				<LocaleTabs
					schema={schema.data.schema}
					group={translation.group}
					current={id}
					onOpen={onOpen}
					onCreate={async (code) => {
						const made = await translation.create(code);
						if (made) onOpen(made);
					}}
					onManage={onLanguages}
				/>
				{translation.isTranslation ? <SourceViewPicker value={view} onChange={showView} /> : null}
			</Inline>
		) : null;

	// The assistant's proposals on this entry that the editor shows where they apply, in the order they were made: a change of the body
	// drawn over the text (T32), one the text has moved away from, hung beside its block (T87), and a change of the title or a field,
	// blue in its input (T86). One bubble walks them all. What the editor does not draw (a move, a publish, a whole body, a field the
	// panel does not show) is not counted: it waits on its conversation's card.
	const [looking, setLooking] = useState(0);
	const [staleOpen, setStaleOpen] = useState<string | null>(null);
	const [remaking, setRemaking] = useState<ReadonlySet<string>>(new Set());
	const remakeItem = useRemakeItem();
	const bodyNow = body.current?.state.doc;
	const drawn = bodyNow ? drawable(bodyNow, editor.bodyProposals) : editor.bodyProposals;
	// A stale change hangs in the text's margin: side by side the margin is not drawn, and it is not walked there.
	const stale = bodyNow && !paired ? staleProposals(bodyNow, editor.bodyProposals) : [];
	const translated = translation.isTranslation;
	const shownPaths = useMemo(() => {
		const paths = new Set(["title"]);
		const definition = structure?.collections[collection];
		if (!definition || !read) return paths;
		const stored = storedFields(definition);
		const inPanel = new Set(panelFields(schema.data, collection));
		const hidden = notChosen(
			Object.fromEntries(Object.keys(stored).map((field) => [field, editor.value(fieldPath(field))])),
			read.entry.locale,
		);
		for (const [field, each] of Object.entries(stored)) {
			if (!inPanel.has(each.under?.field ?? field) || hidden.has(field)) continue;
			// In a translation a field that is the same in every language is the source's, read only: nothing is drawn in it.
			if (translated && localeModeOf(field, each) === "same") continue;
			paths.add(fieldPath(field));
		}
		return paths;
	}, [structure, collection, read, schema.data, notChosen, editor.value, translated]);
	type Walked =
		| { kind: "body"; id: string; item: (typeof drawn)[number] }
		| { kind: "stale"; id: string; item: (typeof drawn)[number]; block: string }
		| { kind: "fields"; id: string; item: (typeof editor.fieldProposals)[number]; paths: string[] };
	const made = new Map(editor.draft.proposals.map(({ item }, index) => [item.id, index]));
	const walk: Walked[] = [
		...drawn.map((item) => ({ kind: "body" as const, id: item.id, item })),
		...stale.map(({ item, block }) => ({ kind: "stale" as const, id: item.id, item, block })),
		...editor.fieldProposals
			.map((item) => ({
				kind: "fields" as const,
				id: item.id,
				item,
				paths: item.paths.filter((path) => shownPaths.has(path)),
			}))
			.filter((each) => each.paths.length > 0),
	].sort((one, other) => (made.get(one.id) ?? 0) - (made.get(other.id) ?? 0));
	// Not before the entry is read, nor after a read that failed: the bubble and its keys would take or discard proposals nobody has seen, on an
	// entry that may be archived or in the trash.
	const at = Math.min(looking, walk.length - 1);
	const walking = !read || readOnly ? null : (walk[at] ?? null);
	/** Takes the screen to a field: its tab, then its input. */
	const toField = (path: string) => {
		if (path === "title") return document.getElementById(fieldInputId("title"))?.focus();
		const field = path === "slug" ? "slug" : path.slice("values.".length);
		setPanel(true);
		const layout = panelLayout(schema.data, collection, t("entry.defaultTab"));
		const under = storedFields(structure?.collections[collection])[field]?.under?.field ?? field;
		const index = layout.findIndex((each) =>
			each.fields.some((entry) => (typeof entry === "string" ? entry : entry.fields).includes(under)),
		);
		if (index >= 0) setTab(index);
		requestAnimationFrame(() => document.getElementById(fieldInputId(field))?.focus());
	};
	/** Brings what the bubble points at into view: the change in the text, the stale one's card, the field. */
	const show = (walked: Walked) => {
		setStaleOpen(walked.kind === "stale" ? walked.id : null);
		if (walked.kind === "fields") return toField(walked.paths[0] ?? "title");
		const view = body.current;
		if (!view) return;
		if (walked.kind === "body") return scrollToProposal(view.view, walked.item);
		const found = findBlock(view.state.doc, walked.block);
		const dom = found ? view.view.nodeDOM(found.pos) : null;
		if (dom instanceof HTMLElement) dom.scrollIntoView({ block: "center", behavior: "smooth" });
	};
	const look = (direction: -1 | 1) => {
		const next = (at + direction + walk.length) % walk.length;
		setLooking(next);
		const walked = walk[next];
		if (walked) show(walked);
	};
	const take = (walked: Walked) => {
		if (walked.kind === "fields") return editor.draft.accept(walked.id);
		// A change the text moved away from cannot go in as it is: its card has the two ways out.
		if (walked.kind === "stale") return show(walked);
		if (!body.current || !catalogs) return;
		takeInEditor(body.current, walked.item, catalogs.kit);
		editor.takeBody(walked.id);
	};
	const takeAll = () => {
		for (const walked of walk) if (walked.kind !== "stale") take(walked);
	};
	const discardWalked = () => editor.draft.discardThese(walk.map((walked) => walked.id));
	/**
	 * "Make again": the assistant makes the change again on the entry as it is. It reads what is saved, so what is on the screen is saved
	 * first; a save that is refused says so itself, and nothing is made again.
	 */
	const remake = remakeItem
		? async (item: string) => {
				if (editor.dirty && (await editor.save()) === null) return;
				setRemaking((now) => new Set(now).add(item));
				await remakeItem(item);
				await editor.draft.reloadProposals();
				setRemaking((now) => new Set([...now].filter((each) => each !== item)));
			}
		: undefined;
	// ⌘↵ takes the proposal the bubble points at and ⌘⌫ discards it (components/proposal.md, the bubble).
	const keyed = useRef({ walking, take, discard: editor.discardProposal });
	keyed.current = { walking, take, discard: editor.discardProposal };
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const { walking: walked, take: takeIt, discard } = keyed.current;
			if (!walked || !(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
			if (event.key === "Enter") {
				event.preventDefault();
				takeIt(walked);
			} else if (event.key === "Backspace") {
				event.preventDefault();
				void discard(walked.id);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// A body change none of whose blocks is in the saved text any more has no place to hang (doc 10, item 18): it is let go once the
	// text is saved without them. Before the save the blocks may still come back (an undo), and it only stays undrawn.
	const placeless = () => {
		const now = body.current?.state.doc;
		return now
			? editor.bodyProposals
					.filter((item) => drawable(now, [item]).length === 0 && anchorBlock(now, item) === null)
					.map((item) => item.id)
			: [];
	};
	const saveEntry = editor.save;
	const letGo = editor.draft.discardThese;
	const placelessNow = useRef(placeless);
	placelessNow.current = placeless;
	const save = useCallback(async () => {
		const saved = await saveEntry();
		if (saved) void letGo(placelessNow.current(), { quiet: true });
		return saved;
	}, [saveEntry, letGo]);

	/** The focus to the text being written: the body, or the title when the body is not there; to the comparison's first control when it took the editor's place. */
	const toText = useCallback(() => () => focusText(() => body.current, fieldInputId("title")), []);
	// What goes away by its own action had the keyboard's focus on that action, and hands it to the text: a banner (discard or load this
	// browser's copy, load the latest, try again, confirm all, compare), and the save cell, a button only while there is something to save or
	// to look at (saved, it is words). Nothing is remembered from the press: a save that fails leaves the cell, and the focus on it.
	const handOff = useFocusHandOff(toText);
	const openConversation = useOpenConversation();
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
			// A field of a conditional field's option sits under that field, in its tab (doc 19).
			const under = storedFields(schema.data?.schema.collections[collection])[task.field]?.under?.field ?? task.field;
			const index = layout.findIndex((each) =>
				each.fields.some((entry) => (typeof entry === "string" ? entry : entry.fields).includes(under)),
			);
			if (index >= 0) setTab(index);
			// A picture's words are written in its settings card, as a body's image has them (flow 1·12).
			if (task.code === "missingAlt") setAltCard(task.field);
			else {
				const field = fieldInputId(task.field);
				requestAnimationFrame(() => document.getElementById(field)?.focus());
			}
			return;
		}
		const view = body.current;
		if (!view) return;
		// An image's words are written in its settings card, not in the text (flow 1·12).
		if (task.code === "missingAlt" && task.block && openImageCard(view, task.block)) return;
		let at: number | null = null;
		view.state.doc.descendants((node, pos) => {
			if (at !== null) return false;
			if (task.block && node.attrs.blockId === task.block) at = pos;
			return true;
		});
		// A source block new since the translation is named by its own id: its undecided block is the one paired with it.
		if (at === null && task.block)
			view.state.doc.forEach((node, pos) => {
				if (at === null && (node.attrs.link as { from?: string } | null)?.from === task.block) at = pos;
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
				toText={handOff}
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

	// What changed in the source since the translation saw it: rows of the to-do list, after what stops publishing.
	// A block new in the source is already a to-do (it stops publishing until decided): the group leaves it out, so it is listed and counted once.
	const sourceCount =
		compared && !readOnly ? compared.marks.filter((mark) => mark.kind !== "added").length + compared.fields.length : 0;
	const sourceOnly = sourceCount > 0 && publish.tasks.length === 0;
	const sourceRows =
		compared && sourceCount > 0 ? (
			<SourceChangeRows
				compared={compared}
				doc={editor.doc}
				fieldLabel={(field) => (field === "title" ? t("entry.title") : fieldLabel(field))}
				onGo={(block) => {
					setTodoOpen(false);
					goTo({ code: "mark", field: "doc", block, blocking: false, message: { key: "" } });
				}}
				onGoField={(field) => {
					setTodoOpen(false);
					if (field === "title") document.getElementById(fieldInputId("title"))?.focus();
					else goTo({ code: "mark", field, blocking: false, message: { key: "" } });
				}}
				onDecide={(decision) => void translation.decide([decision])}
			/>
		) : null;
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

	const confirmField = (field: string) => void translation.decide([{ do: "confirmField", field }]);
	const titleMark = readOnly ? undefined : compared?.fields.find((mark) => mark.field === "title");
	const titleChange = titleMark ? (
		<FieldChange
			mark={titleMark}
			// Under the title, where a changed block's card opens under its block.
			anchor={() => document.getElementById(fieldInputId("title"))}
			onConfirm={() => confirmField("title")}
		/>
	) : undefined;
	// The title and the body, the same in the text alone and side by side (where the title takes the size of its row, and the body the rows).
	// Like the body, the title is not there before the entry is read: an empty title to type into would read as an untitled entry, and what was typed
	// in it stood over the saved title when that came (T153). Keys pressed before then go nowhere, as there is nothing to take them.
	const titleCell = readOnly ? null : editor.draft.cell("title");
	const titleProposed = titleCell?.kind === "proposed" ? titleCell : null;
	const titleField = (size: "display" | "inherit") =>
		read ? (
			<FormField>
				<FormFieldLabel htmlFor={fieldInputId("title")} hidden>
					{t("entry.title")}
				</FormFieldLabel>
				<Input
					id={fieldInputId("title")}
					// A title the assistant proposed is in the title, blue, until it is taken, changed or discarded (T86).
					value={titleProposed ? String(titleProposed.value ?? "") : editor.title}
					proposal={titleProposed !== null}
					placeholder={compared?.source.title || t("entry.title")}
					size={size}
					appearance="inline"
					disabled={readOnly}
					onChange={(event) => editor.set("title", event.target.value)}
				/>
			</FormField>
		) : null;
	// A translation's body waits for its comparison: the source blocks new since it was translated go in as undecided blocks when the editor is made,
	// and it is made again when they change (one is decided).
	const addedKey = translation.added.map((each) => each.from).join(",");
	const bodyField = (rows: PairedRows | null) =>
		read && catalogs && (!translation.isTranslation || compared) ? (
			<BodyEditor
				key={`${editor.bodyKey}:${addedKey}`}
				added={translation.added}
				doc={editor.doc}
				files={editor.files}
				catalogs={catalogs}
				onChange={(doc) => editor.set("doc", doc)}
				editable={!readOnly}
				templates={templatesOn}
				onEditor={keepEditor}
				proposals={{
					items: editor.bodyProposals,
					current: walking?.kind === "body" ? walking.id : null,
					onTaken: editor.takeBody,
				}}
				translation={translation.isTranslation && !readOnly ? translation.blockMenu : undefined}
				paired={rows}
				margin={
					rows
						? undefined
						: (made) => (
								<>
									{translation.isTranslation ? (
										<TranslationMargin
											editor={made}
											marks={compared?.marks ?? []}
											onDecide={(decision) => void translation.decide([decision])}
										/>
									) : null}
									{readOnly ? null : (
										<StaleProposalMargin
											editor={made}
											stale={stale}
											open={staleOpen}
											onOpen={setStaleOpen}
											onDiscard={(item) => void editor.discardProposal(item)}
											onRemake={remake}
											remaking={remaking}
										/>
									)}
								</>
							)
				}
			/>
		) : null;
	const publishedAt = publish.publishedAt;

	// What acts on the entry waits for the entry: before it is read nothing says whether it is published, archived or in the trash.
	const head = !read ? null : readOnly ? (
		trashed ? (
			// The one pill of an entry in the trash (doc 11): it comes back as a draft, here.
			<Button
				variant="primary"
				loading={restore.pending}
				onClick={async () => {
					if (await restore.run([source])) await editor.reload();
				}}
			>
				{t("trash.restore")}
			</Button>
		) : archived ? (
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
							// The site's admin API turns the preview on for this browser and goes on to the entry's page (doc 16).
							window.open(
								`${apiBase}/preview?token=${encodeURIComponent(link.body.token)}&path=${encodeURIComponent(link.body.path)}`,
								"_blank",
								"noopener",
							);
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
		<StandalonePage
			// Every banner of the screen stands at its very top, broader first: the session over this entry's own (common.md, banners).
			banner={
				<>
					<SessionEndedBanner />
					{editor.loadRefusal ? (
						<Banner ref={handOff} tone="danger" title={t("entry.loadFailed")} plainMeta>
							<TextButton onClick={() => void editor.reload()}>{t("entry.retry")}</TextButton>
						</Banner>
					) : null}
					{editor.conflict ? (
						<Banner
							ref={handOff}
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
							ref={handOff}
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
					{trashed ? (
						<Banner
							tone="neutral"
							title={t("entry.trashedBanner")}
							meta={inTrash ? t("trash.left", { days: inTrash.daysLeft }) : undefined}
						/>
					) : null}
					{compared && !readOnly ? (
						<SourceChangedBanner ref={handOff} compared={compared} onConfirmAll={() => void translation.confirmAll()} />
					) : null}
				</>
			}
		>
			{trash.dialog}
			{purge.dialog}
			<EditorHeader>
				<Inline gap={12} minWidth={0} paddingX={12}>
					<TextButton variant="quiet" onClick={trashed ? onTrash : onBack}>
						<ChevronLeft aria-hidden />
						{trashed ? t("frame.trash") : (schema.data?.adminValues[collection]?.label ?? collection)}
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
					{head ? <Separator orientation="vertical" length="control" flush /> : null}
					{/* With the entry's other controls: before the read, and after a read that failed, it stood pressed and opened nothing. */}
					{read ? (
						<IconButton
							label={t("entry.properties")}
							side="bottom"
							pressed={panel}
							onClick={() => {
								// The properties take the place of the source beside the text: one pane at a time.
								if (!panel && translation.isTranslation) setView("off");
								setPanel(!panel);
							}}
						>
							<RightPanelOpen aria-hidden />
						</IconButton>
					) : null}
					{!read ? null : trashed ? (
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
									variant="danger"
									onClick={() => purge.start({ rows: [source], reserves: inTrash?.reserves, onPurged: onTrash })}
								>
									<TrashCan aria-hidden />
									{t("trash.purge")}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : readOnly ? null : (
						<DropdownMenu>
							<IconButton
								label={t("entry.more")}
								side="bottom"
								trigger={(button) => <DropdownMenuTrigger render={button} />}
							>
								<OverflowMenuHorizontal aria-hidden />
							</IconButton>
							<DropdownMenuContent align="end">
								{/* A translation is not copied (its source is) and has no rows of its own here (screens/translation.md, ⋯). */}
								{translation.isTranslation ? null : (
									<>
										<DropdownMenuItem
											onClick={async () => {
												const copy = await duplicate.run({ id });
												if (copy.ok) onOpen(copy.body.output.id);
											}}
										>
											<Copy aria-hidden />
											{t("entry.duplicate")}
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={async () => {
												// An archived entry cannot be changed, so a file on its way would have nowhere to land: archiving waits for it
												// (2026-11-12, owner). The button is not greyed: it says why, and is pressed again once the file is up.
												if (uploadsGoing() > 0) {
													toast(t("leave.uploads.title"));
													return;
												}
												if ((await archive.run({ ids: [id] })).ok) await editor.reload();
											}}
										>
											<Archive aria-hidden />
											{t("entry.archive")}
										</DropdownMenuItem>
									</>
								)}
								<DropdownMenuItem
									onClick={async () => {
										const file = await exporter.run({ ids: [id] });
										if (file.ok) download(`${collection}-${slug || id}.json`, file.body);
									}}
								>
									<Export aria-hidden />
									{t("entry.export")}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								{/* A translation goes alone: its source stays, and the row says so (flow 3·15). */}
								{translation.isTranslation && schema.data ? (
									<DropdownMenuItem
										variant="danger"
										icon={<TrashCan aria-hidden />}
										caption={t("trash.sourceStays", { language: languageName(schema.data.schema.locales.source) })}
										onClick={() => void trash.start({ rows: [source], title: editor.title, onMoved: onBack })}
									>
										{t("trash.translationToTrash")}
									</DropdownMenuItem>
								) : (
									<DropdownMenuItem
										variant="danger"
										onClick={() => void trash.start({ rows: [source], title: editor.title, onMoved: onBack })}
									>
										<TrashCan aria-hidden />
										{t("trash.toTrash")}
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
					<AssistantButton />
				</Inline>
			</EditorHeader>
			<Inline align="stretch" gap={beside ? 40 : 0} grow minHeight={0} overflow="hidden">
				{beside}
				<Stack gap={0} grow minWidth={0} overflow="y" paddingX={48} paddingTop={16}>
					{paired && compared ? (
						<Stack gap={0} grow width="full" maxWidth="list" centered paddingBottom={48}>
							<Box paddingBottom={16}>{languages}</Box>
							<PairedView
								compared={compared}
								translationUpdatedAt={read?.entry.updatedAt ?? null}
								title={titleField("inherit")}
								titleChange={titleChange}
							>
								{bodyField(pairedRows)}
							</PairedView>
						</Stack>
					) : (
						<Stack gap={0} grow width="full" maxWidth="reading" centered paddingBottom={48}>
							{languages}
							{read ? (
								<Stack gap={0} paddingTop={16} paddingBottom={32}>
									<EditorMarginLine margin={titleChange}>{titleField("display")}</EditorMarginLine>
									<EditorTitleRule />
								</Stack>
							) : null}
							{bodyField(null)}
						</Stack>
					)}
					{walking ? (
						<ProposalBubbleDock ref={handOff}>
							<ProposalBubble
								name={walking.item.request}
								onOpen={openConversation ? () => openConversation(walking.item.conversationId) : undefined}
								position={at + 1}
								total={walk.length}
								previousLabel={t("bubble.previous")}
								nextLabel={t("bubble.next")}
								onPrevious={() => look(-1)}
								onNext={() => look(1)}
								discardAllLabel={t("bubble.discardAll")}
								onDiscardAll={() => void discardWalked()}
								acceptAllLabel={t("bubble.acceptAll")}
								onAcceptAll={takeAll}
							/>
						</ProposalBubbleDock>
					) : null}
				</Stack>
				{/* The properties wait for the entry as the title and the body do (T153): drawn from the schema alone, every field stood empty and took input
				    for an entry that was not read yet, and a file chosen or sent up then was written over the saved value when it landed. */}
				{panel && read ? (
					<EntryProperties
						editor={editor}
						schema={schema.data}
						collection={collection}
						tab={tab}
						onTab={setTab}
						readOnly={readOnly}
						shared={translation.isTranslation ? (compared?.source.values ?? null) : null}
						uploads={fieldUploads}
						altCard={altCard}
						onAltCard={setAltCard}
						changes={compared && !readOnly ? { marks: compared.fields, onConfirm: confirmField } : undefined}
					/>
				) : null}
			</Inline>
			{read ? (
				<StatusBar>
					{readOnly ? null : (
						<StatusBarCell
							ref={handOff}
							tone={cell.tone}
							onClick={cell.press}
							render={cell.press ? undefined : <span />}
						>
							{cell.text}
						</StatusBarCell>
					)}
					<StatusBarAnnouncer>{cell.text}</StatusBarAnnouncer>
					{/* One list of what is left in the entry: what stops publishing, then what changed in the source (translation.md, 2026-11-10 owner). */}
					<StatusBarList
						trigger={
							<StatusBarCell tone={publish.blocking > 0 ? "warning" : undefined}>
								{publish.tasks.length + sourceCount > 0
									? t("entry.todo.count", { count: publish.tasks.length + sourceCount })
									: t("entry.todo.none")}
							</StatusBarCell>
						}
						label={t(sourceOnly ? "translation.changedTitle" : "entry.todo.label")}
						count={sourceOnly ? sourceCount : publish.tasks.length}
						open={todoOpen}
						onOpenChange={setTodoOpen}
					>
						{sourceOnly ? null : (
							<>
								{publish.tasks.map((task, index) => (
									<TodoItem
										key={`${task.code}:${task.field ?? ""}:${task.block ?? ""}:${index}`}
										title={taskTitle(task)}
										detail={taskDetail(task)}
										blocking={task.blocking}
										onOpen={() => goTo(task)}
									/>
								))}
								{/* The list holds what is left to do, nothing done beside it (2026-11-10, owner): a row that is done goes. */}
								{publish.tasks.length === 0 ? <TodoDone>{t("entry.todo.none")}</TodoDone> : null}
							</>
						)}
						{sourceRows && sourceOnly ? sourceRows : null}
						{sourceRows && !sourceOnly ? (
							<StatusBarListGroup label={t("translation.changedTitle")} count={sourceCount}>
								{sourceRows}
							</StatusBarListGroup>
						) : null}
					</StatusBarList>
					<StatusBarSpacer />
					<StatusBarCell end render={<span />}>
						{t("entry.chars", { count: docLength(decidedOnly(editor.doc)) })}
					</StatusBarCell>
				</StatusBar>
			) : null}
		</StandalonePage>
	);
}
