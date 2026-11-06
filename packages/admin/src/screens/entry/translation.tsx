import { type Block, type Doc, type EntryState, type Schema, translates } from "@monti-cms/core";
import {
	Banner,
	Box,
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
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { BlockTranslation } from "../../editor/block-menu";
import type { BodyCatalogs } from "../../editor/catalog";
import { findBlock } from "../../editor/proposal-marks";
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

/** A body read only, block by block, in the looks of the comparison. */
function ReadBody({ doc }: { doc: Doc }) {
	return (
		<CompareBody>
			{shownBlocks(doc).map((block) =>
				block.look === "heading" ? (
					<CompareHeading key={block.id}>{block.text}</CompareHeading>
				) : block.look === "code" ? (
					<CompareCode key={block.id}>{block.text}</CompareCode>
				) : (
					<CompareParagraph key={block.id}>{block.text}</CompareParagraph>
				),
			)}
		</CompareBody>
	);
}

/** The source beside the translation, read only, on the tool ground (translation.md, the source pane). */
export function SourcePane({ compared, localeName }: { compared: Compared; localeName: string }) {
	const { t } = useAdmin();
	return (
		<ResizablePane
			resizeKey="monti.translation.source"
			defaultWidth={560}
			min={360}
			max={840}
			label={t("translation.sourceWidth")}
		>
			<Box
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
					</Stack>
					<Text tone="muted">
						<ReadBody doc={compared.source.doc} />
					</Text>
				</Box>
			</Box>
		</ResizablePane>
	);
}

const textOf = (block: Block | null | undefined) =>
	block ? (shownBlocks({ type: "doc", blocks: [block] })[0]?.text ?? "") : "";

/**
 * "Source changed 3" in the status bar (translation.md): a note, not a to-do, so a cell of its own. Its list names each mark's block and goes to it;
 * "Confirm all" under it confirms the changed and removed ones.
 */
export function SourceChangedCell({
	compared,
	doc,
	onGo,
	onConfirmAll,
}: {
	compared: Compared;
	doc: Doc;
	/** To the block a mark is on, or the one a new block goes after. */
	onGo: (block: string | null) => void;
	onConfirmAll: () => void;
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
 * The source and the translation block by block (TranslatePaired): a row per translation block with the source block it is paired with, and a row for
 * each block new in the source. A block that follows the source shows it faint, with "Change here only".
 */
export function PairedView({
	compared,
	translationTitle,
	doc,
	catalogs,
	onDetach,
}: {
	compared: Compared;
	translationTitle: string;
	/** The translation as it is being written (the draft). */
	doc: Doc;
	catalogs: BodyCatalogs | null;
	onDetach: (block: string) => void;
}) {
	const { t, language } = useAdmin();
	const sourceBlocks = new Map(compared.source.doc.blocks.map((block) => [block.id, block]));
	const kind = (block: Block) => {
		const definition = catalogs?.kit.blocks.find((each) => each.type === block.type);
		return definition ? t(definition.label) : block.type;
	};
	const markOf = (id: string) => compared.marks.find((mark) => mark.kind !== "added" && mark.block === id);
	const rows: ReactNode[] = [];
	const added = (after: string | null) =>
		compared.marks
			.filter(
				(mark): mark is Extract<TranslationMark, { kind: "added" }> => mark.kind === "added" && mark.after === after,
			)
			.map((mark) => (
				<CompareRow
					key={`added:${mark.from}`}
					name={mark.source ? kind(mark.source) : ""}
					note={t("translation.mark.added")}
					source={textOf(mark.source)}
					translation={<Untranslated>{textOf(mark.source)}</Untranslated>}
				/>
			));
	rows.push(...added(null));
	for (const block of doc.blocks) {
		const link = block.link;
		const source = link ? sourceBlocks.get(link.from) : undefined;
		const mark = markOf(block.id);
		const changed = mark?.kind === "changed" ? wordDiff(textOf(mark.before), textOf(mark.after)).server : null;
		rows.push(
			<CompareRow
				key={block.id}
				name={kind(block)}
				note={mark ? t(`translation.mark.${mark.kind}`) : undefined}
				source={changed ? <Words parts={changed} /> : textOf(source)}
				translation={
					link?.state === "pending" ? (
						<Untranslated>{textOf(block)}</Untranslated>
					) : link?.state === "followSource" ? (
						<CompareShared
							action={
								<TextButton variant="underline" onClick={() => onDetach(block.id)}>
									{t("translation.detach")}
								</TextButton>
							}
						>
							{textOf(source ?? block)}
						</CompareShared>
					) : (
						textOf(block)
					)
				}
			/>,
		);
		rows.push(...added(block.id));
	}
	const updated = (at: string | null) => (at ? day(new Date(at), language) : "");
	return (
		<CompareRows>
			<CompareRow head source={updated(compared.source.updatedAt)} translation="" />
			<CompareRow
				title
				source={
					<Heading as="h2" variant="page">
						{compared.source.title}
					</Heading>
				}
				translation={
					<Heading as="h2" variant="page">
						{translationTitle || <Untranslated>{compared.source.title}</Untranslated>}
					</Heading>
				}
			/>
			{rows}
		</CompareRows>
	);
}

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
			const top = mark.kind === "added" ? (mark.after ? topOf(mark.after, true) : 0) : topOf(mark.block);
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

	useLayoutEffect(() => measure(), [measure]);
	useEffect(() => {
		editor.on("update", measure);
		window.addEventListener("resize", measure);
		return () => {
			editor.off("update", measure);
			window.removeEventListener("resize", measure);
		};
	}, [editor, measure]);

	const anchorOf = (key: string) => () =>
		editor.view.dom.closest("[data-slot=editor-body]")?.querySelector(`[data-mark-key="${CSS.escape(key)}"]`) ?? null;
	const card = (item: Placed) => {
		const mark = item.mark;
		if (!mark) return null;
		const close = () => setOpen(null);
		const decide = (decision: Decision) => {
			close();
			onDecide(decision);
		};
		const shared = {
			anchor: anchorOf(item.key),
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
					<Box paddingX={16} paddingTop={16} paddingBottom={16}>
						<Text variant="body">{textOf(mark.source)}</Text>
					</Box>
				</MemoCardPopover>
			);
		const diff = wordDiff(textOf(mark.before), textOf(mark.after));
		return (
			<MemoCardPopover
				{...shared}
				where={t(mark.kind === "changed" ? "translation.mark.changedWhere" : "translation.mark.removedWhere")}
				discardLabel={t("translation.confirm")}
				onDiscard={() => decide({ do: "confirm", block: mark.block })}
			>
				<MemoDiff
					beforeLabel={t("translation.before")}
					afterLabel={t("translation.after")}
					before={<Words parts={diff.mine} />}
					after={mark.kind === "removed" ? t("translation.mark.gone") : <Words parts={diff.server} />}
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
