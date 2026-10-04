"use client";

import { createTranslator, supportsLocale, type TextChecker } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { PluginKey, type Transaction } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { type DocSegment, docRangeToSegment, extractSegments } from "./extract";
import { textCheckMessages } from "./messages";
import { createTextCheckPlugin, type TextCheckMeta, type TextCheckPluginState, textCheckIssues } from "./plugin";
import { checkSegments, type DocTextIssue, ignoreKey, placeIssues, TextCheckCache } from "./run";

const t = createTranslator(textCheckMessages);

/** Auto check (`auto: true`) runs once input pauses for this long. */
export const AUTO_CHECK_DELAY = 1500;

export interface TextCheckController {
	readonly editor: Editor;
	/** Name tag for this check's underline plugin (separate per check extension). */
	readonly pluginKey: PluginKey<TextCheckPluginState>;
	/** Checkers that check the language of this text. */
	readonly checkers: readonly TextChecker[];
	/** `id` of the checker currently running (a check opened with the button). `null` if none. */
	readonly running: string | null;
	readonly issues: readonly DocTextIssue[];
	/** The open result window. With `focus`, focus moves into the window (when picked from the list). */
	readonly open: { readonly key: string; readonly focus: boolean } | null;
	/** Checks with one checker (`id`). */
	readonly run: (checkerId: string) => Promise<void>;
	readonly close: () => void;
	readonly jump: (issue: DocTextIssue) => void;
	readonly apply: (issue: DocTextIssue, suggestion: string) => void;
	readonly ignore: (issue: DocTextIssue) => void;
}

const NO_ISSUES: readonly DocTextIssue[] = [];

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

const errorMessage = (error: unknown) => (error instanceof Error && error.message ? error.message : undefined);

/**
 * Spelling and sentence check for the editor. If no checker handles the language of the text, this is `null` and does nothing.
 *
 * - The button (`run`) runs a check. With selected text, only the paragraphs spanning that range are checked; otherwise the whole document.
 * - Only checkers with `auto: true` automatically check changed paragraphs once input pauses.
 * - A paragraph with the same text is not sent again (cache per checker, language and text). Re-checking or closing aborts in-flight requests.
 */
export function useTextCheck(
	editor: Editor | null,
	{ checkers: registered, locale }: { checkers: readonly TextChecker[]; locale: string },
): TextCheckController | null {
	const checkers = useMemo(() => registered.filter((checker) => supportsLocale(checker, locale)), [registered, locale]);
	const active = !!editor && checkers.length > 0;
	const [cache] = useState(() => new TextCheckCache());
	const [ignored] = useState(() => new Set<string>());
	const manualRef = useRef<AbortController | null>(null);
	const autoRef = useRef<AbortController | null>(null);
	const [running, setRunning] = useState<string | null>(null);
	// Give each extension its own name tag so underline plugins do not collide even with several check extensions.
	const [pluginKey] = useState(() => new PluginKey<TextCheckPluginState>("cmsTextCheck"));
	const [open, setOpen] = useState<TextCheckController["open"]>(null);

	const issues = useEditorState({
		editor,
		selector: ({ editor: current }) => (current && active ? textCheckIssues(current.state, pluginKey) : NO_ISSUES),
		equalityFn: (a, b) => a === b,
	});

	useEffect(() => {
		if (!editor || !active) return;
		const plugin = createTextCheckPlugin({
			key: pluginKey,
			onIssueClick: (issue) => setOpen({ key: issue.key, focus: false }),
		});
		editor.registerPlugin(plugin);
		return () => {
			manualRef.current?.abort();
			autoRef.current?.abort();
			setOpen(null);
			if (!editor.isDestroyed) editor.unregisterPlugin(pluginKey);
		};
	}, [editor, active, pluginKey]);

	/** Puts the result for a checked paragraph (name) back onto the current document. Skipped if the paragraph text changed during the check (so its name differs). */
	const place = useCallback(
		(
			current: Editor,
			done: readonly TextChecker[],
			ids: ReadonlySet<string>,
			scopes?: ReadonlyMap<string, { start: number; end: number }>,
		) => {
			const segments = extractSegments(current.state.doc, { locale }).filter((segment) => ids.has(segment.id));
			const placed = placeIssues({ checkers: done, segments, locale, cache, ignored, scopes });
			const ranges = segments.map((segment) => {
				const scope = scopes?.get(segment.id);
				const from = scope ? segment.starts[scope.start] : undefined;
				const to = scope ? segment.ends[scope.end - 1] : undefined;
				return from !== undefined && to !== undefined ? { from, to } : { from: segment.from, to: segment.to };
			});
			const meta: TextCheckMeta = {
				type: "replace",
				checkerIds: done.map((checker) => checker.id),
				ranges,
				issues: placed,
			};
			current.view.dispatch(current.state.tr.setMeta(pluginKey, meta).setMeta("addToHistory", false));
			return placed.length;
		},
		[cache, ignored, locale, pluginKey],
	);

	/** Runs per checker separately. Returns the checkers that finished and those that failed (excluding aborted ones). */
	const checkAll = useCallback(
		async (list: readonly TextChecker[], segments: readonly DocSegment[], signal: AbortSignal) => {
			const results = await Promise.allSettled(
				list.map((checker) => checkSegments({ checker, segments, locale, cache, signal })),
			);
			const done: TextChecker[] = [];
			const failed: { checker: TextChecker; error: unknown }[] = [];
			results.forEach((result, index) => {
				const checker = list[index];
				if (!checker) return;
				if (result.status === "fulfilled") done.push(checker);
				else if (!isAbort(result.reason)) failed.push({ checker, error: result.reason });
			});
			return { done, failed };
		},
		[cache, locale],
	);

	const run = useCallback(
		async (checkerId: string) => {
			const targets = checkers.filter((checker) => checker.id === checkerId);
			if (!editor || !active || targets.length === 0) return;
			manualRef.current?.abort();
			autoRef.current?.abort();
			const controller = new AbortController();
			manualRef.current = controller;
			const { selection, doc } = editor.state;
			const range = selection.empty ? null : { from: selection.from, to: selection.to };
			const segments = extractSegments(doc, { locale, range });
			if (segments.length === 0) {
				manualRef.current = null;
				toast(t("nothingToCheck"));
				return;
			}
			const scopes = range
				? new Map(
						segments.flatMap((segment) => {
							const scope = docRangeToSegment(segment, range.from, range.to);
							return scope ? [[segment.id, scope] as const] : [];
						}),
					)
				: undefined;
			setOpen(null);
			setRunning(checkerId);
			try {
				const { done, failed } = await checkAll(targets, segments, controller.signal);
				if (controller.signal.aborted || editor.isDestroyed) return;
				const count = done.length > 0 ? place(editor, done, new Set(segments.map((segment) => segment.id)), scopes) : 0;
				const [first] = failed;
				if (first) {
					toast.error(t("failed", { label: first.checker.label }), { description: errorMessage(first.error) });
				} else if (count === 0) toast.success(t("nothingToFix"));
			} finally {
				if (manualRef.current === controller) {
					manualRef.current = null;
					setRunning(null);
				}
			}
		},
		[editor, active, locale, checkers, checkAll, place],
	);

	// Auto check: only checkers with `auto: true`, and only paragraphs that differ from when opened (changed paragraphs).
	useEffect(() => {
		if (!editor || !active) return;
		const autoCheckers = checkers.filter((checker) => checker.auto);
		if (autoCheckers.length === 0) return;
		const known = new Set<string>();
		const remember = () => {
			for (const segment of extractSegments(editor.state.doc, { locale })) known.add(segment.text);
		};
		remember();
		let timer: ReturnType<typeof setTimeout> | undefined;
		let failedOnce = false;
		const fire = async () => {
			if (editor.isDestroyed) return;
			// Defer while composing or while a button check is running.
			if (editor.view.composing || manualRef.current) {
				timer = setTimeout(fire, AUTO_CHECK_DELAY);
				return;
			}
			const segments = extractSegments(editor.state.doc, { locale }).filter((segment) => !known.has(segment.text));
			if (segments.length === 0) return;
			autoRef.current?.abort();
			const controller = new AbortController();
			autoRef.current = controller;
			const { done, failed } = await checkAll(autoCheckers, segments, controller.signal);
			if (controller.signal.aborted || editor.isDestroyed) return;
			if (autoRef.current === controller) autoRef.current = null;
			if (done.length > 0) place(editor, done, new Set(segments.map((segment) => segment.id)));
			// Fully finished paragraphs are not placed again by the next auto check (results follow their positions).
			if (failed.length === 0) for (const segment of segments) known.add(segment.text);
			// Report an auto check failure only once (so notifications do not pile up on every input).
			const [first] = failed;
			if (first && !failedOnce) {
				failedOnce = true;
				toast.error(t("failed", { label: first.checker.label }), { description: errorMessage(first.error) });
			}
		};
		const onTransaction = ({ transaction }: { transaction: Transaction }) => {
			if (!transaction.docChanged) return;
			// Filling the whole body from outside (such as loading a post) is not input. Those paragraphs are not treated as changed paragraphs.
			if (transaction.getMeta("preventUpdate")) {
				remember();
				return;
			}
			clearTimeout(timer);
			timer = setTimeout(fire, AUTO_CHECK_DELAY);
		};
		editor.on("transaction", onTransaction);
		return () => {
			editor.off("transaction", onTransaction);
			clearTimeout(timer);
			autoRef.current?.abort();
		};
	}, [editor, active, checkers, locale, checkAll, place]);

	const close = useCallback(() => setOpen(null), []);

	const jump = useCallback(
		(issue: DocTextIssue) => {
			if (!editor) return;
			editor.chain().setTextSelection({ from: issue.from, to: issue.to }).scrollIntoView().run();
			// Open after the list menu closes and returns focus.
			setTimeout(() => setOpen({ key: issue.key, focus: true }), 0);
		},
		[editor],
	);

	const apply = useCallback(
		(issue: DocTextIssue, suggestion: string) => {
			if (!editor || !editor.isEditable) return;
			const current = textCheckIssues(editor.state, pluginKey).find((item) => item.key === issue.key);
			if (!current) return;
			editor.view.dispatch(editor.state.tr.insertText(suggestion, current.from, current.to));
			setOpen(null);
			editor.commands.focus();
		},
		[editor, pluginKey],
	);

	const ignore = useCallback(
		(issue: DocTextIssue) => {
			if (!editor) return;
			const key = ignoreKey(issue);
			ignored.add(key);
			const keys = textCheckIssues(editor.state, pluginKey)
				.filter((item) => ignoreKey(item) === key)
				.map((item) => item.key);
			const meta: TextCheckMeta = { type: "remove", keys };
			editor.view.dispatch(editor.state.tr.setMeta(pluginKey, meta).setMeta("addToHistory", false));
			setOpen(null);
			editor.commands.focus();
		},
		[editor, ignored, pluginKey],
	);

	return useMemo(
		() =>
			editor && active
				? { editor, pluginKey, checkers, running, issues: issues ?? NO_ISSUES, open, run, close, jump, apply, ignore }
				: null,
		[editor, active, pluginKey, checkers, running, issues, open, run, close, jump, apply, ignore],
	);
}
