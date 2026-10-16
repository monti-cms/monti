import { adminRoute, CmsError, cmsErrorText, ok, parseWith, pluginLog, readJsonBody } from "@monti-cms/core/server";
import type { Site } from "@monti-cms/core/site";
import { type AiRunBody, aiRunBodySchemaOf, inputSchemaFor, type ResolvedAiAction } from "../../action";
import { actionWithDraft, getAction } from "../../actions";
import { coreMessages } from "../../core.messages";
import { AiError } from "../../errors";
import { AI_PLUGIN_NAME } from "../../name";
import { type AiCall, type AiRunDeps, runAiAction, streamAiAction } from "../../run";
import { runMessages } from "../../run.messages";
import { loadAiRuntime } from "../../settings";
import { loadSnippets } from "../../snippets";
import { aiStoreFor } from "../../store";
import { aiRunDeps } from "../ai-route";

const log = pluginLog(AI_PLUGIN_NAME);

/** Number of concurrent calls in a batch run. */
const CONCURRENCY = 3;

/** Runs one action on one input. An input that does not match the action definition gives 400. */
async function runOne(action: ResolvedAiAction, body: AiRunBody, input: unknown, deps: AiRunDeps) {
	const parsed = parseWith(
		inputSchemaFor(action.input, deps.site.createTranslator(coreMessages)),
		input,
		"Invalid AI input",
	);
	const call: AiCall = { input: parsed as Record<string, unknown>, env: body.env, request: body.request };
	return runAiAction(action, call, deps);
}

/** Streaming response: JSON with one event per line (`delta`, `done`, `error`). Errors after the start are also reported as an `error` line. */
type StreamEvent =
	| { type: "delta"; text: string }
	| { type: "done"; result: unknown }
	| { type: "error"; code: string; message: string; fix?: string; detail?: string };

function streamResponse(site: Site, run: (send: (event: StreamEvent) => void) => Promise<void>): Response {
	const t = site.createTranslator(runMessages);
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (event: StreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
			// If the receiver disconnected first, the stream is already closed.
			const close = () => {
				try {
					controller.close();
				} catch {
					// Already closed.
				}
			};
			try {
				await run(send);
			} catch (error) {
				// If the screen withdrew the request (e.g. closed the dialog), nobody is receiving, so end quietly.
				if (error instanceof Error && error.name === "AbortError") return close();
				if (error instanceof CmsError) {
					send({ type: "error", code: error.code, ...cmsErrorText(site, error) });
				} else {
					log.error("stream failed:", error);
					send({ type: "error", code: "upstream_failed", message: t("noAnswer") });
				}
			}
			close();
		},
	});
	return new Response(body, {
		headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
	});
}

/**
 * Runs an AI action by name and returns the result (candidates, text, MDX, memo). Does not change values. Applying happens when the user clicks on screen.
 * If `inputs` (several inputs) is sent, returns a result or failure reason per input in order (translation's Translate all). Problems that would be the same for the other inputs, such as key, credit or request-count
 * problems, stop the whole request. The AI screen's Test sends `draft`, the edited value that is not saved yet.
 * With `stream`, the result is streamed bit by bit (only one input of a streaming action).
 */
export const POST = adminRoute(async ({ request, cms }) => {
	const { site } = cms;
	const t = site.createTranslator(runMessages);
	const store = aiStoreFor(cms);
	const body = parseWith(aiRunBodySchemaOf(site.createTranslator(coreMessages)), await readJsonBody(request));
	const action =
		body.draft === undefined
			? await getAction(site, store, body.action)
			: await actionWithDraft(site, store, body.action, body.draft, body.draftBase);
	if (body.draft === undefined && !action.enabled) throw new AiError("service_unavailable", t("disabled"));

	const runtime = await loadAiRuntime(site, store, action);
	const deps = {
		...aiRunDeps(cms, runtime, request.signal, new URL(request.url).origin),
		snippets: await loadSnippets(site, store),
	};
	const model = action.engine === "decide" ? runtime.decider?.model : runtime.generator?.model;
	const started = Date.now();

	if (body.stream) {
		if (body.inputs !== undefined) throw new AiError("invalid_input", t("streamOneInput"));
		if (!deps.generator) throw new AiError("service_unavailable", t("noGenerator"));
		const parsed = parseWith(
			inputSchemaFor(action.input, site.createTranslator(coreMessages)),
			body.input,
			"Invalid AI input",
		);
		const call: AiCall = { input: parsed as Record<string, unknown>, env: body.env, request: body.request };
		return streamResponse(site, async (send) => {
			const result = await streamAiAction(action, call, deps, (text) => send({ type: "delta", text }));
			log.info(`${action.key} model=${model} stream ${Date.now() - started}ms`);
			send({ type: "done", result });
		});
	}

	if (body.inputs === undefined) {
		const result = await runOne(action, body, body.input, deps);
		// The body and result are not kept.
		log.info(`${action.key} model=${model} ${Date.now() - started}ms`);
		return ok({ result });
	}

	const inputs = body.inputs;
	const results: Array<{ result: unknown } | { error: string }> = new Array(inputs.length);
	let next = 0;
	const worker = async () => {
		while (next < inputs.length) {
			const index = next++;
			try {
				results[index] = { result: await runOne(action, body, inputs[index], deps) };
			} catch (error) {
				// A format error in one input fails only that input.
				if (error instanceof AiError && error.code === "upstream_failed")
					results[index] = { error: cmsErrorText(deps.site, error).message };
				else throw error;
			}
		}
	};
	await Promise.all(Array.from({ length: Math.min(CONCURRENCY, inputs.length) }, worker));
	const failed = results.filter((item) => "error" in item).length;
	log.info(`${action.key} inputs=${inputs.length} failed=${failed} model=${model} ${Date.now() - started}ms`);
	return ok({ results });
});
