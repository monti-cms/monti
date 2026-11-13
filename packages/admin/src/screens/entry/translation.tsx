import { type Block, type Doc, type EntryState, type FieldMark, type Schema, translates } from "@monti-cms/core";
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
	CompareText,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
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
	TabLink,
	TabLinks,
	Text,
	TextButton,
	TodoItem,
} from "@monti-cms/ui";
import type { Editor } from "@tiptap/react";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BlockTranslation } from "../../editor/block-menu";
import type { BodyCatalogs } from "../../editor/catalog";
import { findBlock } from "../../editor/proposal-marks";
import { nodeName } from "../../editor/schema";
import { linkOf, type PairedRows, type PairedSourceBlock } from "../../editor/translation";
import { useAdmin } from "../../operations/admin-context";
import { useOperation, useRead } from "../../operations/use-operation";
import { type Part, readableWordDiff, shownBlocks } from "./compare-entries";
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
	fields: FieldMark[];
	pending: number;
};

/** One decision of `translations.setBlocks`. */
type Decision =
	| { do: "keepSource" | "confirm" | "detach" | "remove"; block: string }
	| { do: "add"; from: string; keep?: boolean }
	| { do: "skip"; from: string }
	| { do: "confirmField"; field: string };

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
		{ skip: !multilingual, afterWrites: true, quiet: true },
	);
	// A refusal here is a state the editor knows: a translation whose source is gone (both in the trash) has nothing to compare with.
	const compared = useRead<Compared>(
		"translations.compare",
		{ id },
		{ skip: !isTranslation, afterWrites: true, quiet: true },
	);
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
	/** A block the editor made for a source block new since the translation: not in the stored body, paired with an added mark. */
	const isNew = (block: string, from: string) =>
		!(read?.entry.doc?.blocks ?? []).some((each) => each.id === block) &&
		(compared.data?.marks ?? []).some((mark) => mark.kind === "added" && mark.from === from);
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
		/** The source blocks new since the translation, each shown as an undecided block where it goes. */
		added: (isTranslation ? (compared.data?.marks ?? []) : []).flatMap((mark) =>
			mark.kind === "added" && mark.source ? [{ from: mark.from, after: mark.after, block: mark.source }] : [],
		),
		blockMenu: {
			// A block made for a block new in the source is not in the body yet: it comes in kept, or is left out, in one decision.
			keep: (block, from) =>
				void decide(isNew(block, from) ? [{ do: "add", from, keep: true }] : [{ do: "keepSource", block }]),
			detach: (block) => void decide([{ do: "detach", block }]),
			remove: (block, from) => {
				if (!isNew(block, from)) return false;
				void decide([{ do: "skip", from }]);
				return true;
			},
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
	onManage,
}: {
	schema: Schema;
	group: GroupStatus | null;
	current: string;
	onOpen: (id: string) => void;
	onCreate: (locale: string) => void;
	/** Goes to settings › languages, where languages are added and taken out (T92). */
	onManage: () => void;
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
				<DropdownMenu modal={false}>
					<DropdownMenuTrigger render={<TabLink render={<button type="button" />}>{t("translation.add")}</TabLink>} />
					<DropdownMenuContent side="bottom" align="start">
						{missing.length > 0 ? (
							<>
								<DropdownMenuGroup>
									<DropdownMenuLabel>{t("translation.addLabel")}</DropdownMenuLabel>
									{missing.map((code) => (
										<DropdownMenuItem key={code} onClick={() => onCreate(code)}>
											{name(code)}
											<MenuShortcut>{code}</MenuShortcut>
										</DropdownMenuItem>
									))}
								</DropdownMenuGroup>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={onManage}>{t("translation.manage")}</DropdownMenuItem>
							</>
						) : (
							// With every language there, the one thing left is to add a language to the site: the settings' (editor.md).
							<DropdownMenuItem onClick={onManage}>{t("translation.addInSettings")}</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
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

/** The source's words with the ones changed since the translation underlined in the warning color (`CompareText source`); `removed`: the words
 * before the change, the ones gone faint and struck through. */
const Words = ({ parts, removed = false }: { parts: Part[]; removed?: boolean }) =>
	parts.map((part, index) => (
		// biome-ignore lint/suspicious/noArrayIndexKey: the parts of one text, in order
		<CompareText key={index} changed={part.changed} source removed={removed}>
			{part.text}
		</CompareText>
	));

/** The source's changed blocks with the words that changed on the highlight: what the translation saw before, against the source now. */
function changedWords(compared: Compared): Map<string, Part[]> {
	return new Map(
		compared.marks.flatMap((mark) =>
			mark.kind === "changed"
				? [[mark.from, readableWordDiff(textOf(mark.before), textOf(mark.after)).server] as const]
				: [],
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

/** Each mark's word in the colors the changes lists use for the same words: changed, removed, new (translation.md, 2026-11-06 owner). */
export const MARK_TONE = { changed: "warning", removed: "danger", added: "success" } as const;
const MARKER_TONE = { changed: "changed", removed: "removed", added: "added" } as const;

/**
 * What changed in the source, as rows of the editor's to-do list (translation.md, 2026-11-10 owner): a group of its own under what stops publishing, since none
 * of it does. A row per changed or removed mark, its word in front, the field's name or the block's words on one line, and the one decision at the end
 * ("Leave as is" a changed one, "Remove" a removed block); pressing the row goes there. A block new in the source is not here: it is a to-do above. Writing in a marked place takes its mark away on its own, so the decision
 * is only for what needs no change. "Leave all as is" is the banner's.
 */
export function SourceChangeRows({
	compared,
	doc,
	fieldLabel,
	onGo,
	onGoField,
	onDecide,
}: {
	compared: Compared;
	doc: Doc;
	/** The name a field shows under. */
	fieldLabel: (field: string) => string;
	/** To the block a mark is on: its id, or for a block new in the source the source block's id (the editor's block paired with it). */
	onGo: (block: string) => void;
	/** To the field a mark is on. */
	onGoField: (field: string) => void;
	onDecide: (decision: Decision) => void;
}) {
	const { t } = useAdmin();
	const { marks, fields } = compared;
	const blocks = new Map(doc.blocks.map((block) => [block.id, block]));
	// A block new in the source is the to-do list's own row above (it stops publishing until decided): its "leave out" is on its card.
	const moved = marks.filter((mark) => mark.kind !== "added");
	return (
		<>
			{fields.map((mark) => (
				<TodoItem
					key={`field:${mark.field}`}
					title={fieldLabel(mark.field)}
					tag={t("translation.mark.changed")}
					tagTone={MARK_TONE.changed}
					actionLabel={t("translation.confirm")}
					onAction={() => onDecide({ do: "confirmField", field: mark.field })}
					onOpen={() => onGoField(mark.field)}
				/>
			))}
			{moved.map((mark) => (
				<TodoItem
					key={mark.block}
					title={textOf(blocks.get(mark.block) ?? mark.before)}
					tag={t(`translation.mark.${mark.kind}`)}
					tagTone={MARK_TONE[mark.kind]}
					actionLabel={t(mark.kind === "changed" ? "translation.confirm" : "translation.remove")}
					onAction={() => onDecide({ do: mark.kind === "changed" ? "confirm" : "remove", block: mark.block })}
					onOpen={() => onGo(mark.block)}
				/>
			))}
		</>
	);
}

/**
 * What the side-by-side rows show beside the translation's blocks (TranslatePaired): each source block with the words that changed marked, the
 * blocks' kinds, and each block's note (a block new in the source is noted by its source block).
 */
export function usePairedRows(compared: Compared | null, catalogs: BodyCatalogs | null): PairedRows | null {
	const { t } = useAdmin();
	return useMemo(() => {
		if (!compared) return null;
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
			kinds: new Map((catalogs?.kit.blocks ?? []).map((block) => [nodeName(block.type), t(block.label)])),
			notes: new Map(
				compared.marks.map((mark) => [
					mark.kind === "added" ? mark.from : mark.block,
					{ text: t(`translation.mark.${mark.kind}`), tone: MARK_TONE[mark.kind] },
				]),
			),
		};
	}, [compared, catalogs, t]);
}

/**
 * The source and the translation side by side (TranslatePaired): the head with each side's last edit, the titles, the translation's written in
 * place, then `children`, the body editor laid out as the rows beside the source (`BodyEditor paired`), where the translation is written too.
 */
export function PairedView({
	compared,
	translationUpdatedAt,
	title,
	titleChange,
	children,
}: {
	compared: Compared;
	translationUpdatedAt: string | null;
	/** The translation's title field. */
	title: ReactNode;
	/** The mark on the title, when the source's moved on. */
	titleChange?: ReactNode;
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
					note={titleChange}
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
export function SourceChangedBanner({
	compared,
	onConfirmAll,
	ref,
}: {
	compared: Compared;
	onConfirmAll: () => void;
	/** The banner's own box: the editor hands on the focus it held when "confirm all" takes it away. */
	ref?: React.Ref<HTMLDivElement>;
}) {
	const { t, language } = useAdmin();
	const count = compared.marks.length + compared.fields.length;
	if (count === 0) return null;
	const at = compared.source.publishedAt ? day(new Date(compared.source.publishedAt), language) : "";
	return (
		<Banner ref={ref} title={t("translation.changedTitle")} meta={t("translation.changedMeta", { date: at, count })}>
			{compared.fields.length > 0 || compared.marks.some((mark) => mark.kind !== "added") ? (
				<TextButton onClick={onConfirmAll}>{t("translation.confirmAll")}</TextButton>
			) : null}
		</Banner>
	);
}

/**
 * "변경" (cms-allow-korean: the mark's word) by a field whose source moved on, with the card a changed block has: its value before and after, and "Confirm". Words show what changed in them; `shown` draws any other
 * value (a picture, a pick). The translation's own value stays until someone changes it.
 */
export function FieldChange({
	mark,
	shown,
	anchor,
	onConfirm,
}: {
	mark: FieldMark;
	shown?: (value: unknown) => ReactNode;
	/** What the card hangs under; the mark itself when left out. */
	anchor?: () => Element | null;
	onConfirm: () => void;
}) {
	const { t } = useAdmin();
	const [open, setOpen] = useState(false);
	const place = useRef<HTMLButtonElement>(null);
	const diff = readableWordDiff(String(mark.before ?? ""), String(mark.after ?? ""));
	const side = (value: unknown, words: ReactNode) =>
		value === null ? <Text tone="faint">{t("entry.empty")}</Text> : shown ? shown(value) : words;
	return (
		<>
			<Marker ref={place} data-field-mark={mark.field} tone="changed" active={open} onClick={() => setOpen(!open)}>
				{t("translation.mark.changed")}
			</Marker>
			<MemoCardPopover
				anchor={anchor ?? (() => place.current)}
				open={open}
				onOpenChange={(next) => !next && setOpen(false)}
				where={t("translation.mark.changedWhere")}
				discardLabel={t("translation.confirm")}
				onDiscard={() => {
					setOpen(false);
					onConfirm();
				}}
			>
				<MemoDiff
					beforeLabel={t("translation.before")}
					afterLabel={t("translation.after")}
					before={side(mark.before, <Words parts={diff.mine} removed />)}
					after={side(mark.after, <Words parts={diff.server} />)}
				/>
			</MemoCardPopover>
		</>
	);
}

type Placed = { key: string; top: number; mark: TranslationMark | null; keep: boolean };

/**
 * The marks in the text's left margin (translation.md): "Changed" · "New" · "Removed" where the source moved, "Source" by a block kept in the source's words or
 * following it. A mark opens its card: a changed block's source before and after with "Confirm"; a removed one's "Confirm" and "Remove"; a new one (an
 * undecided block already, written like any other) its source with "Leave out" (left out of this language).
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

	/** The block a mark is about: its block, or for a source block new since the translation the undecided block paired with it. */
	const blockOf = useCallback(
		(mark: TranslationMark): HTMLElement | null => {
			if (editor.isDestroyed) return null;
			let at: number | null = null;
			editor.state.doc.forEach((node, pos) => {
				if (at !== null) return;
				if (mark.kind === "added" ? linkOf(node)?.from === mark.from : node.attrs.blockId === mark.block) at = pos;
			});
			return at === null ? null : (editor.view.nodeDOM(at) as HTMLElement | null);
		},
		[editor],
	);

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
			const element = blockOf(mark);
			const top = element ? element.getBoundingClientRect().top - origin : null;
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
	}, [editor, marks, blockOf]);

	useLayoutEffect(() => measure(), [measure]);
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

	/** A card hangs under the block of its mark (`MemoCardPopover`). */
	const anchorOf = (mark: TranslationMark) => () => blockOf(mark);
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
					where={t("translation.mark.addedWhere")}
					discardLabel={t("translation.skip")}
					onDiscard={() => decide({ do: "skip", from: mark.from })}
				>
					<MemoDiff afterLabel={t("translation.source")} after={textOf(mark.source)} />
				</MemoCardPopover>
			);
		const diff = readableWordDiff(textOf(mark.before), textOf(mark.after));
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
					before={<Words parts={diff.mine} removed />}
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
						tone={MARKER_TONE[item.mark.kind]}
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
