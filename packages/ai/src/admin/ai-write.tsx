"use client";

import {
	type BrowserFormat,
	type EditorExtension,
	type EditorInsertAction,
	type EditorSelectionAction,
	errorNotice,
	type ErrorNotice as Notice,
	type Site,
	useSite,
	useTranslator,
} from "@monti-cms/admin";
import { type BlockAction, blockNodeName, DocPreview } from "@monti-cms/admin/editor";
import {
	Box,
	Button,
	CodeBlock,
	commonMessages,
	Del,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	ErrorNoticeView,
	FormFieldError,
	Grid,
	Heading,
	Inline,
	Ins,
	isComposingKey,
	Spark,
	Stack,
	Tabs,
	TabsList,
	TabsTrigger,
	Textarea,
	TextButton,
} from "@monti-cms/admin/kit";
import type { Editor, JSONContent } from "@tiptap/core";
import { RefreshCw } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { AiActionView } from "../actions";
import { aiCommonMessages } from "./ai-common.messages";
import { streamAiAction, useAiActions } from "./ai-slot-provider";
import { aiWriteMessages } from "./ai-write.messages";
import { contentOfText, documentOfText, textOfContent, useMdxFormat } from "./mdx-format";
import { diffWords } from "./word-diff";

/**
 * AI action that writes into the body. If the attach target is `selection` (selection menu, e.g. polish style), it polishes the chosen text,
 * shows what changed and then replaces it; if `insert` (slash menu, empty document, e.g. write a draft), it inserts at the cursor. If `block` (next to the block
 * handle, e.g. fix a diagram), it fixes that block's source, shows what changed and then replaces the block.
 * The result is streamed and shown gradually. Applying happens only when the user clicks.
 */

type Job =
	| { mode: "selection"; action: AiActionView; editor: Editor; from: number; to: number; source: string }
	| { mode: "insert"; action: AiActionView; editor: Editor; from: number; to: number }
	| {
			mode: "block";
			action: AiActionView;
			editor: Editor;
			from: number;
			to: number;
			source: string;
			/** Editor node name of the block being fixed. The result must also be this one block for it to replace. */
			nodeType: string;
	  };

type RunState =
	| { status: "idle" }
	| { status: "running"; text: string }
	| { status: "done"; text: string }
	| { status: "error"; text: string; notice: Notice };

/** MDX of the selection. A paragraph with only part selected contains only that part. */
function selectionMdx(site: Site, format: BrowserFormat, editor: Editor, from: number, to: number): string {
	const slice = editor.state.doc.slice(from, to);
	const nodes = (slice.content.toJSON() ?? []) as JSONContent[];
	// Selecting inside one paragraph yields only a text fragment. It has to be wrapped in a paragraph to be MDX.
	const content = slice.content.firstChild?.isInline ? [{ type: "paragraph", content: nodes }] : nodes;
	return textOfContent(site, format, content);
}

/** Result MDX as editor content. If the edit was inside one paragraph and the result is one paragraph, inserts only the text (the paragraph is not split). */
function contentFor(
	site: Site,
	format: BrowserFormat,
	editor: Editor,
	from: number,
	to: number,
	mdx: string,
): JSONContent[] {
	const blocks = contentOfText(site, format, mdx);
	const $from = editor.state.doc.resolve(from);
	const $to = editor.state.doc.resolve(to);
	const inline = $from.parent === $to.parent && $from.parent.isTextblock;
	const only = blocks.length === 1 ? blocks[0] : undefined;
	return inline && only?.type === "paragraph" ? (only.content ?? []) : blocks;
}

function WriteDialog({
	job,
	format,
	getEntry,
	onClose,
}: {
	job: Job;
	format: BrowserFormat;
	getEntry: GetEntry;
	onClose: () => void;
}) {
	const site = useSite();
	const t = useTranslator(aiWriteMessages);
	const tc = useTranslator(commonMessages);
	const common = useTranslator(aiCommonMessages);
	const [request, setRequest] = useState("");
	const [state, setState] = useState<RunState>({ status: "idle" });
	const controllerRef = useRef<AbortController | null>(null);
	const { action, editor } = job;

	const run = async () => {
		controllerRef.current?.abort();
		const controller = new AbortController();
		controllerRef.current = controller;
		setState({ status: "running", text: "" });
		const entry = getEntry?.();
		const input: Record<string, unknown> =
			job.mode === "selection"
				? { selection: job.source, title: entry?.title || undefined }
				: job.mode === "block"
					? { block: job.source, title: entry?.title || undefined }
					: {
							title: entry?.title || undefined,
							body: textOfContent(site, format, editor.getJSON().content ?? []) || undefined,
						};
		try {
			const result = await streamAiAction(
				site,
				action.key,
				Object.fromEntries(Object.entries(input).filter(([name, value]) => value && action.input[name])),
				{
					env: {
						...(entry?.collection ? { collection: entry.collection } : {}),
						...(entry?.locale ? { locale: entry.locale } : {}),
						...(entry?.entryId ? { entryId: entry.entryId } : {}),
					},
					request,
					signal: controller.signal,
					onText: (text) => setState({ status: "running", text }),
				},
			);
			if (controller.signal.aborted) return;
			setState({ status: "done", text: "text" in result ? result.text : "" });
		} catch (error) {
			if (controller.signal.aborted) return;
			setState((current) => ({
				status: "error",
				text: "text" in current ? current.text : "",
				notice: errorNotice(site, error, common("runFailed")),
			}));
		}
	};

	// A draft (insert) has no text to fix, so it always asks for a request. An action with ask-for-request on also asks first.
	const askRequest = job.mode === "insert" || action.askInstruction;
	// Polish and block fix, where the text to fix is set, run as soon as they open. A block action with ask-for-request on asks for a request first.
	const fixed = job.mode === "selection" || (job.mode === "block" && !action.askInstruction);
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs only once when opened
	useEffect(() => {
		if (fixed) void run();
		return () => controllerRef.current?.abort();
	}, []);

	// A block fix replaces only when the result is one block of the same kind.
	const blockProblem = useMemo(() => {
		if (job.mode !== "block" || state.status !== "done") return null;
		const blocks = contentOfText(site, format, state.text);
		return blocks.length === 1 && blocks[0]?.type === job.nodeType ? null : t("blockMismatch");
	}, [job, state, format, t, site]);

	const apply = () => {
		if (state.status !== "done" || !state.text || blockProblem) return;
		// A block is replaced entirely with the result block.
		const content =
			job.mode === "block"
				? contentOfText(site, format, state.text)
				: contentFor(site, format, editor, job.from, job.to, state.text);
		editor.chain().focus().insertContentAt({ from: job.from, to: job.to }, content).run();
		onClose();
	};

	const diff = useMemo(
		() => (job.mode !== "insert" && state.status === "done" ? diffWords(job.source, state.text) : null),
		[job, state],
	);
	const running = state.status === "running";
	const result = "text" in state ? state.text : "";
	// Even on failure, any text received is shown.
	const showResult = running || state.status === "done" || (state.status === "error" && !!state.text);
	// Fixed text (polish) is viewed from the changes; block and draft from the rendered shape.
	const [view, setView] = useState<"preview" | "source">(job.mode === "selection" ? "source" : "preview");

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent size="xl">
				<DialogHeader>
					<DialogTitle>
						<Inline gap={8}>
							<Spark aria-hidden />
							{action.label}
						</Inline>
					</DialogTitle>
				</DialogHeader>
				{askRequest && (
					<Stack
						as="form"
						gap={8}
						onSubmit={(event) => {
							event.preventDefault();
							if (!running) void run();
						}}
					>
						<Textarea
							aria-label={t("request")}
							value={request}
							rows={3}
							onChange={(event) => setRequest(event.target.value)}
							onKeyDown={(event) => {
								// Enter inserts a newline; Cmd/Ctrl+Enter runs.
								if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !isComposingKey(event)) {
									event.preventDefault();
									if (!running) void run();
								}
							}}
							placeholder={job.mode === "insert" ? t("askWrite") : job.mode === "block" ? t("askChange") : t("request")}
							autoFocus={!fixed}
						/>
						<Inline justify="end">
							<Button type="submit" size="sm" disabled={running}>
								{state.status === "idle" ? <Spark aria-hidden /> : <RefreshCw aria-hidden />}
								{running ? t("running") : state.status === "idle" ? t("run") : t("runAgain")}
							</Button>
						</Inline>
					</Stack>
				)}
				{showResult && (
					<Tabs value={view} onValueChange={(value) => setView(value as "preview" | "source")}>
						<TabsList>
							<TabsTrigger value="preview">{t("preview")}</TabsTrigger>
							<TabsTrigger value="source">{job.mode === "insert" ? t("sourceInsert") : t("sourceChanges")}</TabsTrigger>
						</TabsList>
						<Box minWidth={0} role="status" aria-live="polite">
							{view === "preview" ? (
								<ResultPreview job={job} format={format} text={result} done={state.status === "done"} />
							) : (
								<CodeBlock maxHeight="half">{diff ? <DiffText parts={diff} /> : result || t("running")}</CodeBlock>
							)}
						</Box>
					</Tabs>
				)}
				{state.status === "error" ? (
					<ErrorNoticeView notice={state.notice} />
				) : (
					blockProblem && <FormFieldError>{blockProblem}</FormFieldError>
				)}
				<DialogFooter>
					<Inline gap={8} justify={askRequest ? "end" : "between"} width="full">
						{!askRequest && (
							<TextButton type="button" disabled={running} onClick={() => void run()}>
								<RefreshCw aria-hidden />
								{running ? t("running") : t("runAgain")}
							</TextButton>
						)}
						<Inline gap={8}>
							<Button type="button" variant="secondary" size="sm" onClick={onClose}>
								{tc("cancel")}
							</Button>
							<Button
								type="button"
								size="sm"
								disabled={state.status !== "done" || !state.text || !!blockProblem}
								onClick={apply}
							>
								{job.mode === "insert" ? t("insert") : t("replace")}
							</Button>
						</Inline>
					</Inline>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Text with the changes (removed and added) marked. */
function DiffText({ parts }: { parts: ReturnType<typeof diffWords> }) {
	return parts.map((part, index) =>
		part.type === "same" ? (
			// biome-ignore lint/suspicious/noArrayIndexKey: the changes list is rebuilt for each result
			<span key={index}>{part.text}</span>
		) : part.type === "del" ? (
			// biome-ignore lint/suspicious/noArrayIndexKey: the changes list is rebuilt for each result
			<Del key={index}>{part.text}</Del>
		) : (
			// biome-ignore lint/suspicious/noArrayIndexKey: the changes list is rebuilt for each result
			<Ins key={index}>{part.text}</Ins>
		),
	);
}

/** The inset box a rendered text sits in. */
function ResultPanel({ children }: { children: ReactNode }) {
	return (
		<Box maxHeight="half" overflow="y" radius="md" background="tool" padding={12}>
			{children}
		</Box>
	);
}

/** A text as the rendered post. A text the format cannot read is shown as it is. */
function TextPreview({ format, text, label }: { format: BrowserFormat; text: string; label: string }) {
	const doc = useMemo(() => documentOfText(format, text), [format, text]);
	return doc ? <DocPreview doc={doc} label={label} /> : <CodeBlock maxHeight="none">{text}</CodeBlock>;
}

/**
 * Renders the result in its text shape (diagrams and charts as pictures). While writing, half-written code does not render, so the source is shown.
 * Block fix shows the current block and the changed one side by side.
 */
function ResultPreview({ job, format, text, done }: { job: Job; format: BrowserFormat; text: string; done: boolean }) {
	const t = useTranslator(aiWriteMessages);
	const after = done ? (
		<TextPreview format={format} text={text} label={t("after")} />
	) : (
		<CodeBlock maxHeight="none">{text || t("running")}</CodeBlock>
	);
	if (job.mode === "insert") return <ResultPanel>{after}</ResultPanel>;
	return (
		<Grid columns={2} gap={12}>
			<Stack as="section" gap={8} minWidth={0}>
				<Heading as="h3" variant="label" tone="muted">
					{t("now")}
				</Heading>
				<ResultPanel>
					<TextPreview format={format} text={job.source} label={t("now")} />
				</ResultPanel>
			</Stack>
			<Stack as="section" gap={8} minWidth={0}>
				<Heading as="h3" variant="label" tone="muted">
					{t("after")}
				</Heading>
				<ResultPanel>{after}</ResultPanel>
			</Stack>
		</Grid>
	);
}

type GetEntry = Parameters<EditorExtension>[0]["getEntry"];

/** Whether the editor is an empty document. Re-checked on every change. */
function useIsEmpty(editor: Editor | null) {
	const [empty, setEmpty] = useState(false);
	useEffect(() => {
		if (!editor) return;
		const update = () => setEmpty(editor.isEmpty);
		update();
		editor.on("update", update);
		return () => {
			editor.off("update", update);
		};
	}, [editor]);
	return empty;
}

/** AI writing attached as an edit-screen extension (polish style, write a draft). */
export const useAiWriteExtension: EditorExtension = ({ getEntry }) => {
	const site = useSite();
	const t = useTranslator(aiWriteMessages);
	const { data } = useAiActions();
	// The model reads and writes MDX, so writing works through the `mdx` format. Without it there is nothing to write with.
	const format = useMdxFormat();
	const [editor, setEditor] = useState<Editor | null>(null);
	const [job, setJob] = useState<Job | null>(null);
	const empty = useIsEmpty(editor);

	const usable = useMemo(() => {
		const ready = new Set(data?.usable ?? []);
		const actions = format ? (data?.items ?? []).filter((action) => action.enabled && ready.has(action.key)) : [];
		return {
			selection: actions.filter((action) => action.attach.some((attach) => attach.slot === "selection")),
			insert: actions.filter((action) => action.attach.some((attach) => attach.slot === "insert")),
			block: actions.filter((action) => action.attach.some((attach) => attach.slot === "block")),
		};
	}, [data, format]);

	const selectionActions = useMemo<EditorSelectionAction[]>(
		() =>
			usable.selection.map((action) => ({
				id: `ai:${action.key}`,
				label: action.label,
				run: (current) => {
					const { from, to } = current.state.selection;
					if (from === to || !format) return;
					setJob({
						mode: "selection",
						action,
						editor: current,
						from,
						to,
						source: selectionMdx(site, format, current, from, to),
					});
				},
			})),
		[usable.selection, format, site],
	);

	const insertActions = useMemo<EditorInsertAction[]>(
		() =>
			usable.insert.map((action) => ({
				id: `ai:${action.key}`,
				title: action.label,
				description: t("insertDescription"),
				keywords: ["ai", action.label],
				icon: "sparkles",
				run: (current, range) => setJob({ mode: "insert", action, editor: current, from: range.from, to: range.to }),
			})),
		[usable.insert, t],
	);

	const blockActions = useMemo<BlockAction[]>(
		() =>
			usable.block.map((action) => {
				// Editor node name of the block this action is attached to.
				const nodes = new Set(
					action.attach.flatMap((attach) => (attach.slot === "block" ? [blockNodeName({ name: attach.block })] : [])),
				);
				return {
					id: `ai:${action.key}`,
					label: action.label,
					icon: <Spark aria-hidden />,
					isAvailable: (current, pos) => nodes.has(current.state.doc.nodeAt(pos)?.type.name ?? ""),
					run: (current, pos) => {
						const node = current.state.doc.nodeAt(pos);
						if (!node || !format) return;
						const source = textOfContent(site, format, [node.toJSON() as JSONContent]);
						setJob({
							mode: "block",
							action,
							editor: current,
							from: pos,
							to: pos + node.nodeSize,
							source,
							nodeType: node.type.name,
						});
					},
				};
			}),
		[usable.block, format, site],
	);

	const firstInsert = usable.insert[0];
	return {
		toolbar: (
			<>
				{/* In an empty document, the toolbar writes a draft directly. */}
				{empty && editor && firstInsert && (
					<TextButton
						type="button"
						variant="quiet"
						onClick={() => {
							const { from, to } = editor.state.selection;
							setJob({ mode: "insert", action: firstInsert, editor, from, to });
						}}
					>
						<Spark aria-hidden />
						{firstInsert.label}
					</TextButton>
				)}
			</>
		),
		overlay: job && format && (
			<WriteDialog job={job} format={format} getEntry={getEntry} onClose={() => setJob(null)} />
		),
		selectionActions,
		insertActions,
		blockActions,
		onEditor: setEditor,
	};
};
