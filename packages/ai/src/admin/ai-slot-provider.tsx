"use client";

import { CmsApiError, cmsFetch } from "@monti-cms/admin/api";
import { SlotRegistryProvider, type SlotSource } from "@monti-cms/admin/slots";
import { adminHref, cmsApiUrl, createTranslator } from "@monti-cms/core/client";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo } from "react";
import type { AiActionView } from "../actions";
import type { AiRunContext, AiRunResult } from "../definition";
import { attachedTo } from "../registry";
import { aiCommonMessages } from "./ai-common.messages";

const t = createTranslator(aiCommonMessages);

export const AI_ACTIONS_KEY = ["cms", "ai", "actions"] as const;

export interface AiActionsResponse {
	/** 연결이 준비되어 지금 쓸 수 있는 기능 이름. */
	usable: string[];
	items: AiActionView[];
}

export function useAiActions(enabled = true) {
	return useQuery({
		queryKey: AI_ACTIONS_KEY,
		queryFn: ({ signal }) =>
			cmsFetch<AiActionsResponse>(cmsApiUrl("/v1/ai/actions"), {
				signal,
				fallback: t("listFailed"),
			}),
		enabled,
		staleTime: 60_000,
	});
}

/** 실행 요청의 공통 정보(입력 밖). */
export interface AiRunEnv {
	collection?: string;
	locale?: string;
	entryId?: string;
	language?: string;
}

export interface AiRunOptions {
	env?: AiRunEnv;
	/** 실행할 때 적은 추가 요청. */
	request?: string;
	/** 저장하지 않은 고친 값(AI 화면의 `시험`). */
	draft?: unknown;
	/** 화면 기능의 저장하지 않은 기본 정보(새 기능 시험). */
	draftBase?: unknown;
	signal?: AbortSignal;
}

const requestBody = (action: string, options: AiRunOptions) => ({
	action,
	env: options.env ?? {},
	...(options.request?.trim() ? { request: options.request.trim() } : {}),
	...(options.draft !== undefined ? { draft: options.draft } : {}),
	...(options.draftBase !== undefined ? { draftBase: options.draftBase } : {}),
});

/** 기능을 이름으로 실행한다. */
export async function runAiAction(
	action: string,
	input: Readonly<Record<string, unknown>>,
	options: AiRunOptions = {},
): Promise<AiRunResult> {
	const response = await cmsFetch<{ result: AiRunResult }>(cmsApiUrl("/v1/ai/run"), {
		method: "POST",
		json: { ...requestBody(action, options), input },
		signal: options.signal,
		fallback: t("runFailed"),
	});
	return response.result;
}

/**
 * 기능을 흘려받기로 실행한다(M8-1). 받은 글이 늘 때마다 지금까지 받은 글 전체로 `onText`를 부르고,
 * 다 받으면 검사를 통과한 결과를 돌려준다.
 */
export async function streamAiAction(
	action: string,
	input: Readonly<Record<string, unknown>>,
	options: AiRunOptions & { onText: (text: string) => void },
): Promise<AiRunResult> {
	const fallback = t("runFailed");
	const response = await fetch(cmsApiUrl("/v1/ai/run"), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ...requestBody(action, options), input, stream: true }),
		signal: options.signal,
	});
	if (!response.ok || !response.body) {
		const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
		const message = typeof body.message === "string" ? body.message : fallback;
		throw new CmsApiError(response.status, typeof body.code === "string" ? body.code : undefined, message, [], body);
	}
	const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
	let buffer = "";
	let text = "";
	for (;;) {
		const { value, done } = await reader.read();
		if (value) buffer += value;
		const lines = buffer.split("\n");
		buffer = done ? "" : (lines.pop() ?? "");
		for (const line of lines) {
			if (!line.trim()) continue;
			const event = JSON.parse(line) as
				| { type: "delta"; text: string }
				| { type: "done"; result: AiRunResult }
				| { type: "error"; code: string; message: string };
			if (event.type === "delta") {
				text += event.text;
				options.onText(text);
			} else if (event.type === "done") return event.result;
			else throw new CmsApiError(502, event.code, event.message || fallback, [], {});
		}
		if (done) break;
	}
	throw new CmsApiError(502, "ai_failed", t("streamCut"), [], {});
}

/** 같은 기능을 여러 입력에 돌린다(한 요청 최대 8개). 입력마다 결과나 실패 이유가 순서대로 온다. */
export async function runAiActionMany(
	action: string,
	inputs: ReadonlyArray<Readonly<Record<string, unknown>>>,
	options: AiRunOptions = {},
): Promise<Array<{ result: AiRunResult } | { error: string }>> {
	const response = await cmsFetch<{ results: Array<{ result: AiRunResult } | { error: string }> }>(
		cmsApiUrl("/v1/ai/run"),
		{
			method: "POST",
			json: { ...requestBody(action, options), inputs },
			signal: options.signal,
			fallback: t("runFailed"),
		},
	);
	return response.results;
}

/** 자리의 지금 상황을 기능 입력과 공통 정보로 옮긴다. 기능 정의에 있는 입력만 보낸다. */
export function inputFromContext(
	action: Pick<AiActionView, "input">,
	context: AiRunContext,
): { input: Record<string, unknown>; env: AiRunEnv } {
	const image =
		context.mediaId || context.imageSrc
			? {
					...(context.mediaId ? { mediaId: context.mediaId } : {}),
					...(context.imageSrc ? { src: context.imageSrc } : {}),
				}
			: undefined;
	const values: Record<string, unknown> = {
		title: context.title,
		summary: context.summary,
		body: context.body,
		current: context.current,
		around: context.around,
		selection: context.selection,
		code: context.code,
		filename: context.filename,
		image,
	};
	const input = Object.fromEntries(
		Object.keys(action.input).flatMap((name) => (values[name] === undefined ? [] : [[name, values[name]]])),
	);
	const env: AiRunEnv = {
		...(context.collection ? { collection: context.collection } : {}),
		...(context.locale ? { locale: context.locale } : {}),
		...(context.entryId ? { entryId: context.entryId } : {}),
		...(context.language ? { language: context.language } : {}),
	};
	return { input, env };
}

/** 관리자 로그인 화면인가(관리자 경로 `admin.path` 아래 `login`). 로그인 전에는 기능 목록을 묻지 않는다. */
const isLoginScreen = (pathname: string | null) =>
	pathname !== null && pathname.replace(/\/$/, "") === adminHref("/login");

/**
 * AI 기능을 화면 자리에 연결한다. 켠 기능 중 붙을 곳(`attach`)이 이 자리인 것이 버튼으로 붙는다.
 * 그 기능이 쓸 연결이 준비되지 않았으면 붙이지 않는다.
 */
export function AiSlotProvider({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const { data } = useAiActions(!isLoginScreen(pathname));

	const sources = useMemo<SlotSource[]>(() => {
		const usable = new Set(data?.usable ?? []);
		const actions = data ? data.items.filter((action) => action.enabled && usable.has(action.key)) : [];
		const source: SlotSource = (place) =>
			actions
				.filter((action) => action.attach.some((attach) => attachedTo(attach, place)))
				.map((action) => ({
					id: action.key,
					label: action.label,
					icon: <Sparkles aria-hidden />,
					menuLabel: t("slotMenu"),
					apply: action.apply,
					askInstruction: action.askInstruction,
					instant: action.instant,
					run: (context, signal) => {
						const { input, env } = inputFromContext(action, context);
						return runAiAction(action.key, input, { env, request: context.request, signal });
					},
				}));
		return [source];
	}, [data]);

	return <SlotRegistryProvider sources={sources}>{children}</SlotRegistryProvider>;
}
