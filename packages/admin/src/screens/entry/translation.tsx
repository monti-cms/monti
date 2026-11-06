import { type Block, type Doc, type EntryState, type Schema, translates } from "@monti-cms/core";
import {
	Banner,
	Box,
	CompareBlock,
	CompareBody,
	CompareCode,
	CompareHeading,
	CompareParagraph,
	CompareRow,
	CompareRows,
	CompareShared,
	CompareText,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
	EditorMargin,
	EditorTitleRule,
	Heading,
	Inline,
	Marker,
	MemoCardPopover,
	MemoDiff,
	MenuShortcut,
	ResizablePane,
	Segmented,
	Stack,
	StatusBarCell,
	StatusBarList,
	TabLink,
	TabLinks,
	Text,
	TextButton,
	TodoItem,
	Untranslated,
} from "@monti-cms/ui";
import type { Editor } from "@tiptap/react";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BlockTranslation } from "../../editor/block-menu";
import type { BodyCatalogs } from "../../editor/catalog";
import { findBlock } from "../../editor/proposal-marks";
import { type PairedRows, type PairedSourceBlock, showGhosts } from "../../editor/translation";
import { useAdmin } from "../../operations/admin-context";
import { useOperation, useRead } from "../../operations/use-operation";
import { type Part, shownBlocks, wordDiff } from "./compare-entries";
import { day } from "./dates";
import type { EntryEditorModel, EntryRead } from "./use-entry-editor";

/** `translations.status` for one group (doc 04): each language's entry, its state, its marks and its pending blocks. */
export type GroupStatus = {
	group: string;
	source: string | null;
	locales: { locale: string; id: string; state: EntryState; changes: number; pending: number }[];
	missing: string[];
};

/** A mark the source's changes left on a translation, as `translations.compare` gives it. */
export type TranslationMark =
	| { kind: "changed" | "removed"; block: string; from: string; before: Block | null; after: Block | null }
	| { kind: "added"; from: string; after: string | null; source: Block | null };

type Compared = {
	source: {
		id: string;
		locale: string;
		title: string;
		values: Record<string, unknown>;
		doc: Doc;
		publishedAt: string | null;
		updatedAt: string;
	};
	translation: { id: string; locale: string; doc: Doc };
	marks: TranslationMark[];
	pending: number;
};

/** One decision of `translations.setBlocks`. */
type Decision =
	| { do: "keepSource" | "confirm" | "detach" | "remove"; block: string }
	| { do: "add" | "skip"; from: string };

/** How the source shows beside a translation: not at all, in a pane beside it, or block by block in rows (translation.md, side by side). */
export type SourceView = "off" | "side" | "paired";

/**
 * A translation as the editor needs it (doc 04, `useTranslation`): the group's languages and their dots, the source and the marks, and the writes. A
 * write that needs the saved version saves the draft first, then reloads the entry, so the editor shows what the core decided.
 */
export function useTranslation(id: string, schema: Schema | undefined, editor: EntryEditorModel) {
	const read = editor.loaded as EntryRead | null;
	const multilingual = schema ? translates(schema) : false;
	const isTranslation = Boolean(schema && read && read.entry.locale !== schema.locales.source);
	const status = useRead<{ groups: GroupStatus[] }>(
		"translations.status",
		{ ids: [id] },
		{ skip: !multilingual, afterWrites: true },
	);
	const compared = useRead<Compared>("translations.compare", { id }, { skip: !isTranslation, afterWrites: true });
	const create = useOperation<{ output: { id: string } }>("translations.create");
	const setBlocks = useOperation("translations.setBlocks");
	const confirmAll = useOperation("translations.confirmAll");
	const get = useOperation<EntryRead>("entries.get");
	const group = status.data?.groups[0] ?? null;

	const write = async (run: (version: number) => Promise<{ ok: boolean }>) => {
		if (editor.dirty && !(await editor.save())) return;
		const fresh = await get.run({ id });
		if (fresh.ok && (await run(fresh.body.entry.version)).ok) await editor.loadLatest();
	};
	const decide = (blocks: Decision[]) => write((version) => setBlocks.run({ id, version, blocks }));
	return {
		multilingual,
		isTranslation,
		group,
		compared: isTranslation ? compared.data : null,
		/** A new translation of the group's source in `locale`; resolves to its id. */
		create: async (locale: string) => {
			if (!group?.source) return null;
			const made = await create.run({ source: group.source, locale });
			return made.ok ? made.body.output.id : null;
		},
		decide,
		confirmAll: () => write((version) => confirmAll.run({ id, version })),
		blockMenu: {
			keep: (block) => void decide([{ do: "keepSource", block }]),
			detach: (block) => void decide([{ do: "detach", block }]),
		} satisfies BlockTranslation,
	};
}

/**
 * The entry's languages over its title (editor.md: language tabs and "+ Language"): a tab per language the group has, a dot where the source changed since
 * it was translated, and "+ Language" with the languages it lacks. Picking one makes its translation and opens it.
 */
export function LocaleTabs({
	schema,
	group,
	current,
	onOpen,
	onCreate,
}: {
	schema: Schema;
	group: GroupStatus | null;
	current: string;
	onOpen: (id: string) => void;
	onCreate: (locale: string) => void;
}) {
	const { t } = useAdmin();
	const name = (code: string) => schema.locales.list.find((locale) => locale.code === code)?.name ?? code;
	const missing = group?.missing ?? [];
	return (
		<Box as="nav" aria-label={t("translation.languages")} grow minWidth={0}>
			<TabLinks>
				{(group?.locales ?? []).map((locale) => (
					<TabLink
						key={locale.locale}
						current={locale.id === current}
						dot={locale.changes > 0 ? "warning" : undefined}
						dotLabel={locale.changes > 0 ? t("translation.sourceChanged") : undefined}
						render={<button type="button" onClick={() => locale.id !== current && onOpen(locale.id)} />}
					>
						{name(locale.locale)}
					</TabLink>
				))}
				{/* With every language there, nothing is left to add here: adding a language is the settings' (T92). */}
				{missing.length > 0 ? (
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger render={<TabLink render={<button type="button" />}>{t("translation.add")}</TabLink>} />
						<DropdownMenuContent side="bottom" align="start">
							<DropdownMenuGroup>
								<DropdownMenuLabel>{t("translation.addLabel")}</DropdownMenuLabel>
								{missing.map((code) => (
									<DropdownMenuItem key={code} onClick={() => onCreate(code)}>
										{name(code)}
										<MenuShortcut>{code}</MenuShortcut>
									</DropdownMenuItem>
								))}
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
			</TabLinks>
		</Box>
	);
}

const VIEWS: SourceView[] = ["off", "side", "paired"];

/** The way the source shows: "Source" and the three views (translation.md). */
export function SourceViewPicker({ value, onChange }: { value: SourceView; onChange: (view: SourceView) => void }) {
	const { t } = useAdmin();
	return (
		<Inline gap={12}>
			<Text variant="note">{t("translation.source")}</Text>
			<Segmented
				aria-label={t("translation.sourceView")}
				value={value}
				onValueChange={(next) => onChange(next as SourceView)}
				options={VIEWS.map((view) => ({ value: view, label: t(`translation.view.${view}`) }))}
				size="sm"
				inline
			/>
		</Inline>
	);
}

/** Words with the changed ones on the highlight. */
const Words = ({ parts }: { parts: Part[] }) =>
	parts.map((part, index) => (
		// biome-ignore lint/suspicious/noArrayIndexKey: the parts of one text, in order
		<CompareText key={index} changed={part.changed}>
			{part.text}
		</CompareText>
	));

/** The source's changed blocks with the words that changed on the highlight: what the translation saw before, against the source now. */
function changedWords(compared: Compared): Map<string, Part[]> {
	return new Map(
		compared.marks.flatMap((mark) =>
			mark.kind === "changed" ? [[mark.from, wordDiff(textOf(mark.before), textOf(mark.after)).server] as const] : [],
		),
	);
}

/** A block read only, in the looks of the comparison, its changed words marked when `parts` are given. */
function ReadBlock({ block, parts }: { block: Block; parts?: Part[] }) {
	const shown = shownBlocks({ type: "doc", blocks: [block] })[0];
	const words = parts ? <Words parts={parts} /> : shown?.text;
	return shown?.look === "heading" ? (
		<CompareHeading>{words}</CompareHeading>
	) : shown?.look === "code" ? (
		<CompareCode>{words}</CompareCode>
	) : (
		<CompareParagraph>{words}</CompareParagraph>
	);
}

/** A body read only, block by block, in the looks of the comparison; `current` is the block on the block ground. */
function ReadBody({ doc, changed, current }: { doc: Doc; changed: Map<string, Part[]>; current: string | null }) {
	return (
		<CompareBody>
			{doc.blocks.map((block) => (
				<CompareBlock key={block.id} data-block={block.id} current={block.id === current}>
					<ReadBlock block={block} parts={changed.get(block.id)} />
				</CompareBlock>
			))}
		</CompareBody>
	);
}

/**
 * The source beside the translation, read only, on the tool ground (translation.md, the source pane). `current` is the source block paired with the
 * translation's block the cursor is in: it is on the block ground, and the pane scrolls to keep it in view.
 */
export function SourcePane({
	compared,
	localeName,
	current,
}: {
	compared: Compared;
	localeName: string;
	current: string | null;
}) {
	const { t } = useAdmin();
	const pane = useRef<HTMLElement>(null);
	useEffect(() => {
		if (!current) return;
		pane.current?.querySelector(`[data-block="${CSS.escape(current)}"]`)?.scrollIntoView({ block: "nearest" });
	}, [current]);
	return (
		<ResizablePane
			resizeKey="monti.translation.source"
			defaultWidth={560}
			min={360}
			max={840}
			label={t("translation.sourceWidth")}
		>
			<Box
				ref={pane}
				as="aside"
				aria-label={t("translation.sourcePane", { language: localeName })}
				background="tool"
				grow
				overflow="y"
			>
				<Box paddingX={40} paddingTop={16} paddingBottom={48} maxWidth="reading" centered>
					<Inline minHeight="control-md">
						<Text variant="meta" tone="subtle">
							{t("translation.sourcePane", { language: localeName })}
						</Text>
					</Inline>
					<Stack gap={0} paddingTop={16} paddingBottom={32}>
						<Heading as="h1" variant="display" tone="muted">
							{compared.source.title}
						</Heading>
						<EditorTitleRule />
					</Stack>
					<Text tone="muted">
						<ReadBody doc={compared.source.doc} changed={changedWords(compared)} current={current} />
					</Text>
				</Box>
			</Box>
		</ResizablePane>
	);
}

function textOf(block: Block | null | undefined) {
	return block ? (shownBlocks({ type: "doc", blocks: [block] })[0]?.text ?? "") : "";
}

/**
 * "Source changed 3" in the status bar (translation.md): a note, not a to-do, so a cell of its own. Its list names each mark's block and goes to it;
 * "Confirm all" under it confirms the changed and removed ones.
 */
export function SourceChangedCell({
	compared,
	doc,
	onGo,
	onConfirmAll,
	onRemove,
}: {
	compared: Compared;
	doc: Doc;
	/** To the block a mark is on, or the one a new block goes after. */
	onGo: (block: string | null) => void;
	onConfirmAll: () => void;
	/** Removes a block whose source block was removed. */
	onRemove: (block: string) => void;
}) {
	const { t } = useAdmin();
	const [open, setOpen] = useState(false);
	const { marks } = compared;
	if (marks.length === 0) return null;
	const blocks = new Map(doc.blocks.map((block) => [block.id, block]));
	return (
		<StatusBarList
			trigger={<StatusBarCell tone="warning">{t("translation.changedCount", { count: marks.length })}</StatusBarCell>}
			label={t("translation.changedTitle")}
			count={marks.length}
			open={open}
			onOpenChange={setOpen}
			footer={
				marks.some((mark) => mark.kind !== "added") ? (
					<TextButton
						onClick={() => {
							setOpen(false);
							onConfirmAll();
						}}
					>
						{t("translation.confirmAll")}
					</TextButton>
				) : undefined
			}
		>
			{marks.map((mark) => (
				<TodoItem
					key={mark.kind === "added" ? `added:${mark.from}` : mark.block}
					title={textOf(mark.kind === "added" ? mark.source : (blocks.get(mark.block) ?? mark.before))}
					marker={<Marker tone="changed">{t(`translation.mark.${mark.kind}`)}</Marker>}
					{...(mark.kind === "removed"
						? {
								actionLabel: t("translation.remove"),
								onAction: () => {
									setOpen(false);
									onRemove(mark.block);
								},
							}
						: {})}
					onOpen={() => {
						setOpen(false);
						onGo(mark.kind === "added" ? mark.after : mark.block);
					}}
				/>
			))}
		</StatusBarList>
	);
}

/**
 * What the side-by-side rows show beside the translation's blocks (TranslatePaired): each source block with the words that changed marked, each
 * translation block's kind and its note, and the source blocks new since the translation.
 */
export function usePairedRows(compared: Compared | null, doc: Doc, catalogs: BodyCatalogs | null): PairedRows | null {
	const { t } = useAdmin();
	return useMemo(() => {
		if (!compared) return null;
		const kind = (block: Block) => {
			const definition = catalogs?.kit.blocks.find((each) => each.type === block.type);
			return definition ? t(definition.label) : block.type;
		};
		const changed = changedWords(compared);
		const shown = (block: Block): PairedSourceBlock => {
			const look = shownBlocks({ type: "doc", blocks: [block] })[0]?.look;
			return {
				look: look === "heading" ? "heading" : look === "code" ? "code" : "text",
				parts: changed.get(block.id) ?? [{ text: textOf(block), changed: false }],
			};
		};
		return {
			source: new Map(compared.source.doc.blocks.map((block) => [block.id, shown(block)])),
			kinds: new Map(doc.blocks.map((block) => [block.id, kind(block)])),
			notes: new Map(
				compared.marks.flatMap((mark) =>
					mark.kind === "added" ? [] : [[mark.block, t(`translation.mark.${mark.kind}`)] as const],
				),
			),
			added: compared.marks.flatMap((mark) =>
				mark.kind === "added" && mark.source
					? [
							{
								key: `added:${mark.from}`,
								after: mark.after,
								kind: kind(mark.source),
								note: t("translation.mark.added"),
								block: shown(mark.source),
							},
						]
					: [],
			),
		};
	}, [compared, doc, catalogs, t]);
}

/**
 * The source and the translation side by side (TranslatePaired): the head with each side's last edit, the titles, the translation's written in
 * place, then `children`, the body editor laid out as the rows beside the source (`BodyEditor paired`), where the translation is written too.
 */
export function PairedView({
	compared,
	translationUpdatedAt,
	title,
	children,
}: {
	compared: Compared;
	translationUpdatedAt: string | null;
	/** The translation's title field. */
	title: ReactNode;
	children: ReactNode;
}) {
	const { language } = useAdmin();
	const updated = (at: string | null) => (at ? day(new Date(at), language) : "");
	return (
		<Stack gap={0}>
			<CompareRows>
				<CompareRow head source={updated(compared.source.updatedAt)} translation={updated(translationUpdatedAt)} />
				<CompareRow
					title
					source={
						<Heading as="h2" variant="page">
							{compared.source.title}
						</Heading>
					}
					translation={
						<Heading as="h2" variant="page">
							{title}
						</Heading>
					}
				/>
			</CompareRows>
			{children}
		</Stack>
	);
}

/** A body without its blocks still in the source's words: what the character count counts (a new translation counts none). */
export const decidedOnly = (doc: Doc): Doc => ({
	...doc,
	blocks: doc.blocks.filter((block) => block.link?.state !== "pending"),
});

/** "The source changed · Oct 26 · 3 places" with "Confirm all" (translation.md, the banner). */
export function SourceChangedBanner({ compared, onConfirmAll }: { compared: Compared; onConfirmAll: () => void }) {
	const { t, language } = useAdmin();
	const count = compared.marks.length;
	if (count === 0) return null;
	const at = compared.source.publishedAt ? day(new Date(compared.source.publishedAt), language) : "";
	return (
		<Banner title={t("translation.changedTitle")} meta={t("translation.changedMeta", { date: at, count })}>
			{compared.marks.some((mark) => mark.kind !== "added") ? (
				<TextButton onClick={onConfirmAll}>{t("translation.confirmAll")}</TextButton>
			) : null}
		</Banner>
	);
}

type Placed = { key: string; top: number; mark: TranslationMark | null; keep: boolean };

/**
 * The marks in the text's left margin (translation.md): "Changed" · "New" · "Removed" where the source moved, "Source" by a block kept in the source's words or
 * following it. A mark opens its card: a changed block's source before and after with "Confirm"; a removed one's "Confirm"; a new one's "Bring in" (it comes in
 * as a dimmed block) and "Leave out" (left out of this language).
 */
export function TranslationMargin({
	editor,
	marks,
	onDecide,
}: {
	editor: Editor;
	marks: TranslationMark[];
	onDecide: (decision: Decision) => void;
}) {
	const { t } = useAdmin();
	const [placed, setPlaced] = useState<Placed[]>([]);
	const [open, setOpen] = useState<string | null>(null);

	const measure = useCallback(() => {
		if (editor.isDestroyed) return;
		const body = editor.view.dom.closest("[data-slot=editor-body]");
		if (!body) return;
		const origin = body.getBoundingClientRect().top;
		const topOf = (id: string, end = false) => {
			const found = findBlock(editor.state.doc, id);
			const element = found ? (editor.view.nodeDOM(found.pos) as HTMLElement | null) : null;
			if (!element) return null;
			const box = element.getBoundingClientRect();
			return (end ? box.bottom : box.top) - origin;
		};
		const next: Placed[] = [];
		for (const mark of marks) {
			const key = mark.kind === "added" ? `added:${mark.from}` : mark.block;
			const ghost = mark.kind === "added" ? editor.view.dom.querySelector(`[data-ghost="${CSS.escape(key)}"]`) : null;
			const top =
				mark.kind === "added" ? (ghost ? ghost.getBoundingClientRect().top - origin : null) : topOf(mark.block);
			if (top !== null) next.push({ key, top, mark, keep: false });
		}
		editor.state.doc.forEach((node) => {
			const state = (node.attrs.link as Block["link"] | null)?.state;
			const id = String(node.attrs.blockId ?? "");
			if ((state === "keepSource" || state === "followSource") && !next.some((each) => each.key === id)) {
				const top = topOf(id);
				if (top !== null) next.push({ key: id, top, mark: null, keep: true });
			}
		});
		setPlaced(next);
	}, [editor, marks]);

	// A block new in the source shows as a dimmed line where it would go, until it is brought in or left out.
	useLayoutEffect(() => {
		if (editor.isDestroyed) return;
		const ghosts = marks.flatMap((mark) =>
			mark.kind === "added" ? [{ key: `added:${mark.from}`, after: mark.after, text: textOf(mark.source) }] : [],
		);
		editor.view.dispatch(showGhosts(editor.state, ghosts));
		measure();
	}, [editor, marks, measure]);
	useEffect(() => {
		// The text's width changes with the panes beside it, and its lines with it: measure again whenever its box does.
		const resized = new ResizeObserver(() => measure());
		resized.observe(editor.view.dom);
		editor.on("update", measure);
		return () => {
			resized.disconnect();
			editor.off("update", measure);
		};
	}, [editor, measure]);

	/** A card hangs under the block of its mark (`MemoCardPopover`): the block, or the dimmed line of a new one. */
	const anchorOf = (mark: TranslationMark) => () => {
		if (editor.isDestroyed) return null;
		if (mark.kind === "added")
			return editor.view.dom.querySelector(`[data-ghost="${CSS.escape(`added:${mark.from}`)}"]`);
		const found = findBlock(editor.state.doc, mark.block);
		return found ? (editor.view.nodeDOM(found.pos) as Element | null) : null;
	};
	const card = (item: Placed) => {
		const mark = item.mark;
		if (!mark) return null;
		const close = () => setOpen(null);
		const decide = (decision: Decision) => {
			close();
			onDecide(decision);
		};
		const shared = {
			anchor: anchorOf(mark),
			open: open === item.key,
			onOpenChange: (next: boolean) => !next && close(),
		};
		if (mark.kind === "added")
			return (
				<MemoCardPopover
					{...shared}
					where={t("translation.mark.added")}
					discardLabel={t("translation.skip")}
					onDiscard={() => decide({ do: "skip", from: mark.from })}
					acceptLabel={t("translation.bringIn")}
					onAccept={() => decide({ do: "add", from: mark.from })}
				>
					<MemoDiff afterLabel={t("translation.source")} after={textOf(mark.source)} />
				</MemoCardPopover>
			);
		const diff = wordDiff(textOf(mark.before), textOf(mark.after));
		return (
			<MemoCardPopover
				{...shared}
				where={t(mark.kind === "changed" ? "translation.mark.changedWhere" : "translation.mark.removedWhere")}
				discardLabel={t("translation.confirm")}
				onDiscard={() => decide({ do: "confirm", block: mark.block })}
				// A block whose source block is gone: confirm keeps it on its own, or remove it here too (doc 04, the marks).
				{...(mark.kind === "removed"
					? { acceptLabel: t("translation.remove"), onAccept: () => decide({ do: "remove", block: mark.block }) }
					: {})}
			>
				<MemoDiff
					beforeLabel={t("translation.before")}
					afterLabel={t("translation.after")}
					before={<Words parts={diff.mine} />}
					{...(mark.kind === "removed"
						? { none: t("translation.mark.gone") }
						: { after: <Words parts={diff.server} /> })}
				/>
			</MemoCardPopover>
		);
	};

	return placed.map((item) => (
		<EditorMargin key={item.key} top={item.top}>
			{item.mark ? (
				<span data-mark-key={item.key}>
					<Marker
						tone="changed"
						active={open === item.key}
						onClick={() => setOpen(open === item.key ? null : item.key)}
					>
						{t(`translation.mark.${item.mark.kind}`)}
					</Marker>
				</span>
			) : (
				<Marker tone="keep">{t("translation.mark.keep")}</Marker>
			)}
			{card(item)}
		</EditorMargin>
	));
}
