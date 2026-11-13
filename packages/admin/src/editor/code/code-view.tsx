import type { CodeBlockSettings } from "@monti-cms/core";
import { ANCHOR, type LineEffect, languageName, lineStarts } from "@monti-cms/core/code";
import {
	BlockBarPlace,
	Caret,
	CodeArea,
	CodeAside,
	type CodeFoldEdge,
	CodeFrame,
	CodeGround,
	type CodeLineTone,
	CodeNumber,
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	FloatingBar,
	FloatingBarButton,
	IconButton,
	Inline,
	Input,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Separator,
	Text,
	TextButton,
} from "@monti-cms/ui";
import {
	Chat,
	Checkmark,
	ChevronDown,
	ChevronRight,
	Code,
	CollapseAll,
	Copy,
	Document,
	ListNumbered,
	Row,
	TypePattern,
	View,
} from "@monti-cms/ui/icons";
import { TextSelection } from "@tiptap/pm/state";
import { NodeViewContent, type NodeViewProps, NodeViewWrapper, useEditorState } from "@tiptap/react";
import { useContext, useRef, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { EditorMedia } from "../media-context";
import { markName } from "../schema";
import {
	type CodeData,
	cleanData,
	codeToolsKey,
	dataOf,
	foldKey,
	foldsOf,
	hiddenLines,
	lineAt,
	sendCode,
} from "./code-state";
import { LineMenu } from "./line-menu";
import { RulesCard } from "./rules-card";

/** What a line's effects draw in the editor: its ground and its mark (doc 17). */
function looksOf(settings: CodeBlockSettings, effects: readonly LineEffect[], line: number) {
	const on = effects.filter((effect) => effect.start <= line && line < effect.end);
	let tone: CodeLineTone | undefined;
	let mark: string | undefined;
	for (const definition of settings.lineEffects) {
		if (!on.some((effect) => effect.name === definition.name)) continue;
		const look = definition.editor;
		if (!tone && look && !look.wavy && look.tone)
			tone = look.tone === "success" ? "plus" : look.tone === "danger" ? "minus" : "highlight";
		mark ??= look?.marker;
	}
	return { tone, mark };
}

/**
 * A code block in the editor (doc 17): the box with its language and file name, the line numbers that pick lines (press or drag, the menu opens on
 * release; Shift extends; a right press opens it too), the lines' effects and folds, and over the box its tool row while the caret is in it.
 */
export function CodeBlockView({ node, editor, getPos, updateAttributes }: NodeViewProps) {
	const { t } = useAdmin();
	const media = useContext(EditorMedia);
	const settings = (editor.storage as unknown as { codeTools?: { settings: CodeBlockSettings | null } }).codeTools
		?.settings;
	const editable = media ? !media.readOnly : editor.isEditable;
	const data = dataOf(node);
	const code = node.textContent;
	const starts = lineStarts(code);
	const effects = data.lines ?? [];
	const blockId = String(node.attrs.blockId ?? "");
	const bar = useRef<HTMLDivElement>(null);
	const frame = useRef<HTMLDivElement>(null);
	const drag = useRef<{ anchor: number } | null>(null);
	const [menu, setMenu] = useState<{ start: number; end: number } | null>(null);
	const [card, setCard] = useState<"language" | "name" | "rules" | "tip" | null>(null);
	const [copied, setCopied] = useState(false);
	const [foldPointed, setFoldPointed] = useState<number | null>(null);
	const [hovered, setHovered] = useState(false);

	const view = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const at = getPos();
			const tools = codeToolsKey.getState(current.state);
			if (typeof at !== "number" || !tools) return null;
			const { from, to, empty } = current.state.selection;
			const inside = from > at && to < at + node.nodeSize;
			const picked = tools.picked?.pos === at ? tools.picked : null;
			const linking = tools.linking?.lines?.pos === at ? tools.linking.lines : null;
			const pointed = tools.pointed?.block === blockId ? tools.pointed.anchor : null;
			const words =
				inside && !empty && current.state.selection instanceof TextSelection
					? { from: from - at - 1, to: to - at - 1 }
					: null;
			return {
				inside,
				picked,
				linking,
				pointed,
				words,
				tip: words ? String(current.getAttributes(markName("codeTip")).text ?? "") : "",
				tipOn: words ? current.isActive(markName("codeTip")) : false,
				foldOn: words ? current.isActive(markName("codeFold")) : false,
				foldOpen: words ? current.getAttributes(markName("codeFold")).open === true : false,
				version: tools.version,
				folds: tools.folds,
				around: { pos: at, from, to },
			};
		},
	});
	const folds = view?.folds ?? new Map<string, boolean>();
	// The same folds the text hides: one the caret is in shows its lines, so the numbers stay level with the code.
	const hidden = hiddenLines(node, folds, view?.around);
	const rows = starts.map((_, line) => line).filter((line) => !hidden.has(line));
	const blockFolds = foldsOf(node, folds, view?.around);
	const foldOf = (line: number) => blockFolds.find(({ effect }) => effect.start === line);
	const edgeOf = (line: number): { edge?: CodeFoldEdge; lit: boolean } => {
		const around = blockFolds.find(({ effect, shown }) => shown && effect.start <= line && line < effect.end);
		if (!around) return { lit: false };
		const { effect } = around;
		return {
			edge: line === effect.start ? "start" : line === effect.end - 1 ? "end" : "middle",
			lit: foldPointed === effect.start,
		};
	};

	const set = (next: Partial<CodeData>) => updateAttributes({ data: cleanData({ ...data, ...next }) });
	const anchored = (anchor: string | null) =>
		effects.find((effect) => effect.name === ANCHOR && effect.attrs?.id === anchor) ?? null;
	const lit = anchored(view?.pointed ?? null);
	const toneOf = (line: number): CodeLineTone | undefined => {
		const pick = view?.picked ?? view?.linking;
		if (pick && pick.start <= line && line < pick.end) return "picked";
		if (lit && lit.start <= line && line < lit.end) return "lit";
		const pointedFold = foldPointed === null ? null : blockFolds.find(({ effect }) => effect.start === foldPointed);
		if (pointedFold && pointedFold.effect.start <= line && line < pointedFold.effect.end) return "lit";
		return settings ? looksOf(settings, effects, line).tone : undefined;
	};

	/** Picks lines by their numbers: the text's selection takes them too, so a copy takes them and the format card stays away. */
	const pick = (start: number, end: number) => {
		const at = getPos();
		if (typeof at !== "number") return;
		const from = at + 1 + (starts[start] ?? 0);
		const to = at + 1 + ((starts[end] ?? code.length + 1) - 1);
		const tr = editor.state.tr
			.setSelection(TextSelection.create(editor.state.doc, from, Math.max(from, to)))
			.setMeta(codeToolsKey, { picked: { pos: at, start, end } })
			.setMeta("addToHistory", false);
		editor.view.dispatch(tr);
	};
	const pickLinking = (start: number, end: number) => {
		const at = getPos();
		const linking = codeToolsKey.getState(editor.state)?.linking;
		if (typeof at !== "number" || !linking) return;
		sendCode(editor.view, { linking: { ...linking, lines: { pos: at, start, end } } });
	};
	const linkingNow = () => Boolean(codeToolsKey.getState(editor.state)?.linking);

	const press = (line: number, event: React.PointerEvent) => {
		if (!editable || event.button !== 0) return;
		event.preventDefault();
		const picked = view?.picked;
		const anchor = event.shiftKey && picked ? picked.start : line;
		drag.current = { anchor };
		const range = { start: Math.min(anchor, line), end: Math.max(anchor, line) + 1 };
		setMenu(null);
		if (linkingNow()) pickLinking(range.start, range.end);
		else pick(range.start, range.end);
		const release = () => {
			window.removeEventListener("pointerup", release);
			const current = codeToolsKey.getState(editor.state);
			drag.current = null;
			// While a code link is made, the lines are its second side: no menu.
			if (current?.linking) return;
			const now = current?.picked;
			if (now) setMenu({ start: now.start, end: now.end });
		};
		window.addEventListener("pointerup", release);
	};
	const extend = (line: number) => {
		if (!drag.current) return;
		const { anchor } = drag.current;
		const range = { start: Math.min(anchor, line), end: Math.max(anchor, line) + 1 };
		if (linkingNow()) pickLinking(range.start, range.end);
		else pick(range.start, range.end);
	};
	const pressRight = (line: number, event: React.MouseEvent) => {
		if (!editable) return;
		event.preventDefault();
		const picked = view?.picked;
		const range = picked && picked.start <= line && line < picked.end ? picked : { start: line, end: line + 1 };
		pick(range.start, range.end);
		setMenu({ start: range.start, end: range.end });
	};
	/** The tool row's "line effects": the lines picked, or the lines the caret or the selection is on. */
	const openMenu = () => {
		const at = getPos();
		if (typeof at !== "number") return;
		const picked = view?.picked;
		if (picked) return setMenu({ start: picked.start, end: picked.end });
		const { from, to } = editor.state.selection;
		const start = lineAt(starts, Math.max(0, from - at - 1));
		const end = lineAt(starts, Math.max(0, to - at - 1)) + 1;
		pick(start, end);
		setMenu({ start, end });
	};
	const toggleFold = (start: number, open: boolean) => sendCode(editor.view, { fold: foldKey(blockId, start), open });

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// No clipboard here (an unfocused page): nothing to say.
		}
	};

	const language = data.language;
	const languageLabel = language ? languageName(language) : t("editor.code.plain");
	const listed = settings?.languages ?? [];
	const tools = settings?.tools;
	const offeredEffects = settings?.lineEffects.filter((effect) => effect.offered) ?? [];
	// The blocks' one tool row (editor-tools.md): the pointer on the block, the caret in it, or a card or menu of it open.
	const showBar = editable && (hovered || view?.inside || view?.picked || card !== null || menu !== null);
	const numbersOff = !data.lineNumbers;
	const wordsTools = view?.words && tools && (tools.tooltip || tools.fold);
	const toggleMark = (type: "codeTip" | "codeFold", attrs: Record<string, unknown> | null) => {
		const name = markName(type);
		const chain = editor.chain().focus();
		if (attrs === null) chain.unsetMark(name).run();
		else chain.setMark(name, attrs).run();
	};

	return (
		<NodeViewWrapper
			data-block="codeBlock"
			onPointerEnter={() => setHovered(true)}
			onPointerLeave={() => setHovered(false)}
		>
			{showBar ? (
				<BlockBarPlace>
					<FloatingBar ref={bar} aria-label={t("editor.code.tools")}>
						<LanguageButton
							open={card === "language"}
							onOpenChange={(open) => setCard(open ? "language" : null)}
							label={languageLabel}
							anchor={bar}
							current={language}
							listed={listed}
							onPick={(next) => {
								set({ language: next || undefined });
								setCard(null);
							}}
						/>
						<NameButton
							open={card === "name"}
							onOpenChange={(open) => setCard(open ? "name" : null)}
							anchor={bar}
							value={data.title ?? ""}
							onChange={(title) => set({ title: title || undefined })}
						/>
						<Separator orientation="vertical" length="bar" />
						<FloatingBarButton
							label={t("editor.code.lineNumbers")}
							pressed={Boolean(data.lineNumbers)}
							onClick={() => set({ lineNumbers: data.lineNumbers ? undefined : true })}
						>
							<ListNumbered aria-hidden />
						</FloatingBarButton>
						{offeredEffects.length || tools?.fold || tools?.links ? (
							<FloatingBarButton label={t("editor.code.lineEffects")} pressed={menu !== null} onClick={openMenu}>
								<Row aria-hidden />
							</FloatingBarButton>
						) : null}
						{tools?.rules || data.rules?.length ? (
							<Popover open={card === "rules"} onOpenChange={(open) => setCard(open ? "rules" : null)}>
								<FloatingBarButton
									label={t("editor.code.rules")}
									pressed={card === "rules"}
									trigger={(button) => <PopoverTrigger render={button} />}
								>
									<TypePattern aria-hidden />
								</FloatingBarButton>
								<RulesCard
									anchor={bar}
									rules={data.rules ?? []}
									code={code}
									lineCount={starts.length}
									picked={view?.words ? code.slice(view.words.from, view.words.to) : ""}
									tools={tools ?? { rules: true, fold: true, tooltip: true, textStyles: true, links: true }}
									onChange={(rules) => set({ rules })}
								/>
							</Popover>
						) : null}
						{wordsTools ? (
							<>
								<Separator orientation="vertical" length="bar" />
								{tools.tooltip ? (
									<Popover open={card === "tip"} onOpenChange={(open) => setCard(open ? "tip" : null)}>
										<FloatingBarButton
											label={t("marks.codeTip")}
											pressed={Boolean(view?.tipOn)}
											trigger={(button) => <PopoverTrigger render={button} />}
										>
											<Chat aria-hidden />
										</FloatingBarButton>
										<PopoverContent anchor={bar} align="start" width="sm" initialFocus={false}>
											<Input
												size="md"
												autoFocus
												aria-label={t("editor.code.tipText")}
												placeholder={t("editor.code.tipText")}
												defaultValue={view?.tip ?? ""}
												onKeyDown={(event) => {
													if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
													event.preventDefault();
													const text = event.currentTarget.value.trim();
													toggleMark("codeTip", text ? { text } : null);
													setCard(null);
												}}
											/>
										</PopoverContent>
									</Popover>
								) : null}
								{tools.fold ? (
									<>
										<FloatingBarButton
											label={t("editor.code.foldWords")}
											pressed={Boolean(view?.foldOn)}
											onClick={() => toggleMark("codeFold", view?.foldOn ? null : {})}
										>
											<CollapseAll aria-hidden />
										</FloatingBarButton>
										{view?.foldOn ? (
											<FloatingBarButton
												named
												label={t("editor.code.openAtFirst")}
												pressed={Boolean(view?.foldOpen)}
												onClick={() => toggleMark("codeFold", view?.foldOpen ? {} : { open: true })}
											>
												<View aria-hidden />
												{t("editor.code.openAtFirst")}
											</FloatingBarButton>
										) : null}
									</>
								) : null}
							</>
						) : null}
						<Separator orientation="vertical" length="bar" />
						<FloatingBarButton label={copied ? t("editor.code.copied") : t("editor.code.copy")} onClick={copy}>
							{copied ? <Checkmark aria-hidden /> : <Copy aria-hidden />}
						</FloatingBarButton>
					</FloatingBar>
				</BlockBarPlace>
			) : null}
			<CodeFrame
				ref={frame}
				head={
					<>
						<Inline gap={8} minWidth={0}>
							<Text variant="caption" tone="muted">
								{languageLabel}
							</Text>
							{data.title ? (
								<Text variant="caption" mono truncate>
									{data.title}
								</Text>
							) : null}
						</Inline>
						{/* Read-only has no tool row: copying stays, at the head row's end. */}
						{editable ? null : (
							<IconButton size="xs" label={copied ? t("editor.code.copied") : t("editor.code.copy")} onClick={copy}>
								{copied ? <Checkmark aria-hidden /> : <Copy aria-hidden />}
							</IconButton>
						)}
					</>
				}
			>
				<CodeArea
					picking={Boolean(view?.picked)}
					aside={blockFolds
						// A closed fold inside another closed fold has its first line hidden too: only the outer one says what it hides.
						.filter(({ shown, effect }) => !shown && rows.includes(effect.start))
						.map(({ effect }) => (
							<CodeAside key={effect.start} row={rows.indexOf(effect.start)}>
								<TextButton size="caption" onClick={() => toggleFold(effect.start, true)}>
									{t("editor.code.folded", { n: effect.end - effect.start - 1 })}
								</TextButton>
							</CodeAside>
						))}
					gutter={rows.map((line) => {
						const fold = foldOf(line);
						const { edge, lit: foldLit } = edgeOf(line);
						return (
							<CodeNumber
								key={line}
								data-line={line}
								number={line + 1}
								tone={toneOf(line)}
								mark={settings ? looksOf(settings, effects, line).mark : undefined}
								numbersOff={numbersOff}
								readOnly={!editable}
								folds={blockFolds.length > 0}
								edge={edge}
								foldLit={foldLit}
								onPointerDown={(event) => press(line, event)}
								onPointerEnter={() => extend(line)}
								onContextMenu={(event) => pressRight(line, event)}
								fold={
									fold ? (
										<IconButton
											size="xs"
											label={t(fold.open ? "editor.code.foldFrom" : "editor.code.unfoldFrom", { n: line + 1 })}
											aria-expanded={fold.open}
											onPointerDown={(event) => event.stopPropagation()}
											onPointerEnter={() => setFoldPointed(line)}
											onPointerLeave={() => setFoldPointed(null)}
											onClick={() => toggleFold(line, !fold.open)}
										>
											{fold.open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
										</IconButton>
									) : undefined
								}
							/>
						);
					})}
					grounds={rows.map((line) => <CodeGround key={line} tone={toneOf(line)} />)}
				>
					<NodeViewContent />
				</CodeArea>
			</CodeFrame>
			{menu && editable && settings ? (
				<LineMenu
					editor={editor}
					frame={frame}
					blockId={blockId}
					getPos={getPos}
					start={menu.start}
					end={Math.min(menu.end, starts.length)}
					effects={effects}
					settings={settings}
					onChange={(lines) => set({ lines })}
					onClose={() => setMenu(null)}
				/>
			) : null}
		</NodeViewWrapper>
	);
}

function LanguageButton({
	open,
	onOpenChange,
	label,
	anchor,
	current,
	listed,
	onPick,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	label: string;
	anchor: React.RefObject<HTMLDivElement | null>;
	current: string | undefined;
	listed: readonly string[];
	onPick: (language: string) => void;
}) {
	const { t } = useAdmin();
	const [typed, setTyped] = useState("");
	const query = typed.trim().toLowerCase();
	const rows = listed.filter(
		(id) => !query || id.toLowerCase().includes(query) || languageName(id).toLowerCase().includes(query),
	);
	const unknown = current && !listed.includes(current) ? current : null;
	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) setTyped("");
			}}
		>
			<FloatingBarButton
				named
				label={t("editor.code.languageIs", { name: label })}
				pressed={open}
				trigger={(button) => <PopoverTrigger render={button} />}
			>
				<Code aria-hidden />
				{label}
				<Caret />
			</FloatingBarButton>
			<PopoverContent anchor={anchor} align="start" padding="menu" width="md">
				<Command shouldFilter={false}>
					<CommandInput
						placeholder={t("editor.code.findLanguage")}
						aria-label={t("editor.code.findLanguage")}
						value={typed}
						onValueChange={setTyped}
					/>
					<CommandList>
						{rows.length === 0 ? <CommandEmpty>{t("editor.code.noLanguage")}</CommandEmpty> : null}
						{query ? null : (
							<>
								<CommandItem value="plain" checked={!current} onSelect={() => onPick("")}>
									{t("editor.code.plain")}
								</CommandItem>
								{unknown ? (
									<CommandItem value={unknown} checked onSelect={() => onPick(unknown)}>
										<Inline gap={6} minWidth={0}>
											<Text>{unknown}</Text>
											<Text variant="caption" tone="faint">
												{t("editor.code.notListed")}
											</Text>
										</Inline>
									</CommandItem>
								) : null}
								<CommandSeparator />
							</>
						)}
						{rows.map((id) => (
							<CommandItem key={id} value={id} checked={id === current} onSelect={() => onPick(id)}>
								<Inline gap={6} minWidth={0}>
									<Text>{languageName(id)}</Text>
									<Text variant="caption" tone="faint" mono>
										{id}
									</Text>
								</Inline>
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

function NameButton({
	open,
	onOpenChange,
	anchor,
	value,
	onChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	anchor: React.RefObject<HTMLDivElement | null>;
	value: string;
	onChange: (value: string) => void;
}) {
	const { t } = useAdmin();
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<FloatingBarButton
				label={t("editor.code.fileName")}
				pressed={open || Boolean(value)}
				trigger={(button) => <PopoverTrigger render={button} />}
			>
				<Document aria-hidden />
			</FloatingBarButton>
			<PopoverContent anchor={anchor} align="start" width="sm" initialFocus={false}>
				<Input
					size="md"
					mono
					autoFocus
					aria-label={t("editor.code.fileName")}
					placeholder={t("editor.code.fileName")}
					defaultValue={value}
					onBlur={(event) => onChange(event.currentTarget.value.trim())}
					onKeyDown={(event) => {
						if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
						event.preventDefault();
						onChange(event.currentTarget.value.trim());
						onOpenChange(false);
					}}
				/>
			</PopoverContent>
		</Popover>
	);
}
