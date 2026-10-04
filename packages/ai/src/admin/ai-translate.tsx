"use client";

import type { EditorExtension } from "@monti-cms/admin";
import { errorText } from "@monti-cms/admin/api";
import type { BlockAction } from "@monti-cms/admin/editor";
import { Button, Popover, PopoverContent, PopoverTrigger, Textarea } from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/react";
import { Languages, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { runAiActionMany, useAiActions } from "./ai-slot-provider";
import { aiTranslateMessages } from "./ai-translate.messages";
import { applyTranslation, collectUnits, type TranslateUnit, unitAt } from "./ai-translate-units";
import { OptionSelect } from "./custom-editor";

const t = createTranslator(aiTranslateMessages);

/**
 * 번역본 에디터의 AI 번역(v2 D2). 안내 글(`untranslated`)이 남은 블록이 "아직 번역 안 된 곳"이다.
 * 번역은 일반 AI 기능이다. 붙을 곳이 `translation`인 기능(입력 `block`·`from`·`to`, MDX 결과)을 블록마다 부른다.
 * 그런 기능이 여럿이면 블록 손잡이 옆에 기능마다 버튼이 붙고, `모두 번역`에서 기능을 고른다.
 * 블록의 원문 MDX(안내 글 표시를 걷어 낸 것)를 보내고, 서버가 번역·구조 검사를 통과한 MDX만 돌려주면 그 블록을 바꾼다.
 * 검사에 걸린 블록은 안내 글로 남는다. 번역 단위와 바꾸는 규칙은 `ai-translate-units.ts`다.
 */

/** 한 요청에 보내는 블록 수와 글자 수(서버 상한보다 작게). */
const BATCH_BLOCKS = 4;
const BATCH_CHARS = 12_000;
/** 동시에 보내는 요청 수. */
const PARALLEL_REQUESTS = 2;

type TranslateResult = { id: string; mdx: string } | { id: string; error: string };

async function requestTranslation(
	action: string,
	blocks: Array<{ id: string; mdx: string }>,
	locales: { sourceLocale: string; targetLocale: string },
	request: string,
	signal: AbortSignal,
): Promise<TranslateResult[]> {
	const results = await runAiActionMany(
		action,
		blocks.map((block) => ({ block: block.mdx, from: locales.sourceLocale, to: locales.targetLocale })),
		{ request, signal, env: { locale: locales.targetLocale } },
	);
	return results.map((item, index) => {
		const id = blocks[index]?.id ?? "";
		return "error" in item ? { id, error: item.error } : { id, mdx: "text" in item.result ? item.result.text : "" };
	});
}

/** 블록을 요청 단위로 묶는다. 한 블록이 커도 나누지 않고 혼자 보낸다. */
function batches<T extends { mdx: string }>(blocks: T[]): T[][] {
	const groups: T[][] = [];
	let current: T[] = [];
	let chars = 0;
	for (const block of blocks) {
		if (current.length > 0 && (current.length >= BATCH_BLOCKS || chars + block.mdx.length > BATCH_CHARS)) {
			groups.push(current);
			current = [];
			chars = 0;
		}
		current.push(block);
		chars += block.mdx.length;
	}
	if (current.length > 0) groups.push(current);
	return groups;
}

/**
 * 번역본 에디터의 AI 번역 동작. `blockActions`는 블록 손잡이 옆 번역 기능(기능마다 하나, 이름은 기능 이름),
 * `toolbar`는 툴바의 `모두 번역`이다. 쓸 수 있는 번역 기능이 없으면 둘 다 없다.
 */
export function useAiTranslate(locales: { sourceLocale: string; targetLocale: string } | null) {
	const { data } = useAiActions(locales !== null);
	const features = useMemo(
		() =>
			locales
				? (data?.items ?? []).filter(
						(item) =>
							item.enabled &&
							item.result === "mdx" &&
							item.attach.some((attach) => attach.slot === "translation") &&
							data?.usable.includes(item.key),
					)
				: [],
		[data, locales],
	);
	/** `모두 번역`에 쓸 기능. 고른 기능이 사라졌으면 첫 기능이다. */
	const [chosenKey, setChosenKey] = useState<string | null>(null);
	const feature = features.find((item) => item.key === chosenKey) ?? features[0];
	const actionKey = feature?.key ?? "";
	const editorRef = useRef<Editor | null>(null);
	const [busyBlocks, setBusyBlocks] = useState<ReadonlySet<number>>(new Set());
	const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
	const [request, setRequest] = useState("");
	const [open, setOpen] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	/** 블록 하나씩 번역하는 요청. 툴바의 `중지`가 함께 멈춘다. */
	const blockAbortRef = useRef(new Map<number, AbortController>());

	const setEditor = useCallback((editor: Editor | null) => {
		editorRef.current = editor;
	}, []);

	/** 진행 중인 번역(모두 번역·블록 번역)을 모두 멈춘다. */
	const stop = useCallback(() => {
		abortRef.current?.abort();
		for (const controller of blockAbortRef.current.values()) controller.abort();
	}, []);

	// 편집 화면을 떠나면 진행 중인 번역을 멈춘다.
	useEffect(() => stop, [stop]);

	const translateOne = useCallback(
		async (editor: Editor, pos: number, action: string) => {
			if (!locales) return;
			const unit = unitAt(editor.state.doc, pos);
			if (!unit) return;
			// 블록 번역은 툴바의 추가 요청을 쓰지 않는다(그 요청은 `모두 번역`에만 붙는다).
			blockAbortRef.current.get(pos)?.abort();
			const controller = new AbortController();
			blockAbortRef.current.set(pos, controller);
			setBusyBlocks((current) => new Set([...current, pos]));
			try {
				const [result] = await requestTranslation(
					action,
					[{ id: "b0", mdx: unit.mdx }],
					locales,
					"",
					controller.signal,
				);
				if (!result || controller.signal.aborted) return;
				if ("error" in result) {
					toast.error(t("toast.failedOne", { reason: result.error }));
					return;
				}
				const applied = applyTranslation(editor, unit, result.mdx, pos);
				if (applied === "changed") toast.message(t("toast.blockChanged"));
				else if (applied === "invalid") toast.error(t("toast.invalidOne"));
			} catch (error) {
				if (controller.signal.aborted) toast.message(t("toast.stopped"));
				else toast.error(errorText(error, t("runFailed")));
			} finally {
				if (blockAbortRef.current.get(pos) === controller) blockAbortRef.current.delete(pos);
				setBusyBlocks((current) => new Set([...current].filter((item) => item !== pos)));
			}
		},
		[locales],
	);

	const translateAll = useCallback(async () => {
		const editor = editorRef.current;
		if (!editor || !locales) return;
		const blocks: Array<TranslateUnit & { id: string }> = collectUnits(editor.state.doc).map((unit, index) => ({
			...unit,
			id: `b${index}`,
		}));
		if (blocks.length === 0) {
			toast.message(t("toast.noBlocks"));
			return;
		}
		const controller = new AbortController();
		abortRef.current = controller;
		setOpen(false);
		setProgress({ done: 0, total: blocks.length });
		const groups = batches(blocks);
		const failures: string[] = [];
		let skipped = 0;
		let fatal: string | null = null;
		let next = 0;
		const worker = async () => {
			while (next < groups.length && !controller.signal.aborted && !fatal) {
				const group = groups[next++] ?? [];
				try {
					const results = await requestTranslation(
						actionKey,
						group.map(({ id, mdx }) => ({ id, mdx })),
						locales,
						request,
						controller.signal,
					);
					for (const result of results) {
						const block = group.find((item) => item.id === result.id);
						if (!block) continue;
						if ("error" in result) failures.push(result.error);
						else {
							const applied = applyTranslation(editor, block, result.mdx, null);
							if (applied === "changed") skipped += 1;
							else if (applied === "invalid") failures.push(t("toast.invalidMany"));
						}
					}
				} catch (error) {
					if (controller.signal.aborted) return;
					fatal = errorText(error, t("runFailed"));
				}
				setProgress((current) => (current ? { ...current, done: current.done + group.length } : current));
			}
		};
		await Promise.all(Array.from({ length: Math.min(PARALLEL_REQUESTS, groups.length) }, worker));
		setProgress(null);
		abortRef.current = null;
		if (controller.signal.aborted) toast.message(t("toast.stoppedKeep"));
		else if (fatal) toast.error(fatal);
		else if (failures.length > 0 || skipped > 0) {
			toast.warning(
				`${t("toast.partial", { done: blocks.length - failures.length - skipped, kept: failures.length + skipped })}${failures[0] ? ` · ${failures[0]}` : ""}`,
			);
		} else toast.success(t("toast.all", { count: blocks.length }));
	}, [locales, request, actionKey]);

	const blockActions = useMemo<BlockAction[]>(
		() =>
			features.map((item) => ({
				id: `ai-translate:${item.key}`,
				label: item.label,
				icon: <Languages aria-hidden className="size-3.5" />,
				isAvailable: (editor, pos) => unitAt(editor.state.doc, pos) !== null && progress === null,
				isBusy: (pos) => busyBlocks.has(pos),
				run: (editor, pos) => void translateOne(editor, pos, item.key),
			})),
		[features, busyBlocks, progress, translateOne],
	);

	const running = progress !== null || busyBlocks.size > 0;
	const toolbar = feature ? (
		running ? (
			<span className="flex items-center gap-1">
				{progress && (
					<span className="text-cms-muted-foreground text-xs tabular-nums">
						{t("progress", { done: progress.done, total: progress.total })}
					</span>
				)}
				<Button type="button" size="sm" variant="ghost" className="gap-1.5 text-cms-muted-foreground" onClick={stop}>
					<Square aria-hidden className="size-4" />
					{t("stop")}
				</Button>
			</span>
		) : (
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					render={<Button type="button" size="sm" variant="ghost" className="gap-1.5 text-cms-muted-foreground" />}
				>
					<Languages aria-hidden className="size-4" />
					{t("all")}
				</PopoverTrigger>
				<PopoverContent align="end" className="w-72 gap-2 p-3 text-xs">
					<form
						className="flex flex-col gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							void translateAll();
						}}
					>
						{features.length > 1 && (
							<OptionSelect
								aria-label={t("action")}
								value={feature.key}
								options={features.map((item) => ({ value: item.key, label: item.label }))}
								onChange={setChosenKey}
							/>
						)}
						{feature.askInstruction && (
							<Textarea
								aria-label={t("request")}
								placeholder={t("request")}
								rows={3}
								value={request}
								onChange={(event) => setRequest(event.target.value)}
								onKeyDown={(event) => {
									// 줄바꿈은 Enter, 실행은 Cmd/Ctrl+Enter다.
									if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
										event.preventDefault();
										void translateAll();
									}
								}}
								className="min-h-16 resize-y text-xs md:text-xs"
							/>
						)}
						<Button type="submit" size="sm" className="self-end">
							<Languages aria-hidden />
							{t("run")}
						</Button>
					</form>
				</PopoverContent>
			</Popover>
		)
	) : null;

	return { blockActions, toolbar, setEditor };
}

/** 편집 화면 확장으로 붙인 AI 번역. 번역본 편집기의 툴바에 `모두 번역`, 블록 손잡이 옆에 번역 기능을 둔다. */
export const useAiTranslateExtension: EditorExtension = ({ translateLocales }) => {
	const translate = useAiTranslate(translateLocales);
	return {
		toolbar: translate.toolbar,
		blockActions: translate.blockActions.length > 0 ? translate.blockActions : undefined,
		onEditor: translate.setEditor,
	};
};
