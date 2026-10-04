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
	/** Names of actions that are ready to use now because their connection is ready. */
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

/** Common information of a run request (outside the input). */
export interface AiRunEnv {
	collection?: string;
	locale?: string;
	entryId?: string;
	language?: string;
}

export interface AiRunOptions {
	env?: AiRunEnv;
	/** Extra request entered at run time. */
	request?: string;
	/** Unsaved edited values (Test in the AI screen). */
	draft?: unknown;
	/** Unsaved basic info of a screen action (testing a new action). */
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

/** Runs an action by name. */
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
 * Runs an action as a stream. Each time more text arrives, calls `onText` with all text received so far,
 * and when done returns the result that passed the checks.
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

/** Runs the same action over several inputs (up to 8 per request). Each input gets a result or a failure reason, in order. */
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

/** Converts the current state of a slot into action inputs and common information. Sends only the inputs present in the action definition. */
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

/** Whether this is the admin login screen (`login` under the admin path `admin.path`). Before login, the action list is not requested. */
const isLoginScreen = (pathname: string | null) =>
	pathname !== null && pathname.replace(/\/$/, "") === adminHref("/login");

/**
 * Attaches AI actions to screen slots. Among enabled actions, those whose attach target (`attach`) is this slot are attached as buttons.
 * An action is not attached if the connection it uses is not ready.
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
