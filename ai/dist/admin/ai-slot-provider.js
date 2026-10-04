"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { CmsApiError, cmsFetch } from "@monti-cms/admin/api";
import { SlotRegistryProvider } from "@monti-cms/admin/slots";
import { adminHref, cmsApiUrl, createTranslator } from "@monti-cms/core/client";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { attachedTo } from "../registry.js";
import { aiCommonMessages } from "./ai-common.messages.js";
const t = createTranslator(aiCommonMessages);
export const AI_ACTIONS_KEY = ["cms", "ai", "actions"];
export function useAiActions(enabled = true) {
    return useQuery({
        queryKey: AI_ACTIONS_KEY,
        queryFn: ({ signal }) => cmsFetch(cmsApiUrl("/v1/ai/actions"), {
            signal,
            fallback: t("listFailed"),
        }),
        enabled,
        staleTime: 60_000,
    });
}
const requestBody = (action, options) => ({
    action,
    env: options.env ?? {},
    ...(options.request?.trim() ? { request: options.request.trim() } : {}),
    ...(options.draft !== undefined ? { draft: options.draft } : {}),
    ...(options.draftBase !== undefined ? { draftBase: options.draftBase } : {}),
});
/** Runs an action by name. */
export async function runAiAction(action, input, options = {}) {
    const response = await cmsFetch(cmsApiUrl("/v1/ai/run"), {
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
export async function streamAiAction(action, input, options) {
    const fallback = t("runFailed");
    const response = await fetch(cmsApiUrl("/v1/ai/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...requestBody(action, options), input, stream: true }),
        signal: options.signal,
    });
    if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => ({})));
        const message = typeof body.message === "string" ? body.message : fallback;
        throw new CmsApiError(response.status, typeof body.code === "string" ? body.code : undefined, message, [], body);
    }
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    let text = "";
    for (;;) {
        const { value, done } = await reader.read();
        if (value)
            buffer += value;
        const lines = buffer.split("\n");
        buffer = done ? "" : (lines.pop() ?? "");
        for (const line of lines) {
            if (!line.trim())
                continue;
            const event = JSON.parse(line);
            if (event.type === "delta") {
                text += event.text;
                options.onText(text);
            }
            else if (event.type === "done")
                return event.result;
            else
                throw new CmsApiError(502, event.code, event.message || fallback, [], {});
        }
        if (done)
            break;
    }
    throw new CmsApiError(502, "ai_failed", t("streamCut"), [], {});
}
/** Runs the same action over several inputs (up to 8 per request). Each input gets a result or a failure reason, in order. */
export async function runAiActionMany(action, inputs, options = {}) {
    const response = await cmsFetch(cmsApiUrl("/v1/ai/run"), {
        method: "POST",
        json: { ...requestBody(action, options), inputs },
        signal: options.signal,
        fallback: t("runFailed"),
    });
    return response.results;
}
/** Converts the current state of a slot into action inputs and common information. Sends only the inputs present in the action definition. */
export function inputFromContext(action, context) {
    const image = context.mediaId || context.imageSrc
        ? {
            ...(context.mediaId ? { mediaId: context.mediaId } : {}),
            ...(context.imageSrc ? { src: context.imageSrc } : {}),
        }
        : undefined;
    const values = {
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
    const input = Object.fromEntries(Object.keys(action.input).flatMap((name) => (values[name] === undefined ? [] : [[name, values[name]]])));
    const env = {
        ...(context.collection ? { collection: context.collection } : {}),
        ...(context.locale ? { locale: context.locale } : {}),
        ...(context.entryId ? { entryId: context.entryId } : {}),
        ...(context.language ? { language: context.language } : {}),
    };
    return { input, env };
}
/** Whether this is the admin login screen (`login` under the admin path `admin.path`). Before login, the action list is not requested. */
const isLoginScreen = (pathname) => pathname !== null && pathname.replace(/\/$/, "") === adminHref("/login");
/**
 * Attaches AI actions to screen slots. Among enabled actions, those whose attach target (`attach`) is this slot are attached as buttons.
 * An action is not attached if the connection it uses is not ready.
 */
export function AiSlotProvider({ children }) {
    const pathname = usePathname();
    const { data } = useAiActions(!isLoginScreen(pathname));
    const sources = useMemo(() => {
        const usable = new Set(data?.usable ?? []);
        const actions = data ? data.items.filter((action) => action.enabled && usable.has(action.key)) : [];
        const source = (place) => actions
            .filter((action) => action.attach.some((attach) => attachedTo(attach, place)))
            .map((action) => ({
            id: action.key,
            label: action.label,
            icon: _jsx(Sparkles, { "aria-hidden": true }),
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
    return _jsx(SlotRegistryProvider, { sources: sources, children: children });
}
