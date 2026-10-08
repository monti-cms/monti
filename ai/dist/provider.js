import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { slugify } from "@monti-cms/core/client";
import { APICallError, generateText, NoObjectGeneratedError, Output, RetryError, streamText } from "ai";
import { z } from "zod";
import { AiError } from "./errors.js";
import { providerMessages } from "./provider.messages.js";
export const isFakeAi = () => process.env.CMS_AI_FAKE === "1" && process.env.NODE_ENV !== "production";
/** Explanation the service put in the error body (`{"error": {"message": …}}` etc.). Empty string if none. */
function serviceMessage(detail) {
    let message = detail;
    try {
        const body = JSON.parse(detail);
        const candidate = typeof body.error === "string" ? body.error : (body.error?.message ?? body.message);
        if (typeof candidate === "string")
            message = candidate;
    }
    catch {
        // If it is not JSON, use the body as is.
    }
    return message.replace(/\s+/g, " ").trim().slice(0, 200);
}
/** Turns a service error into an AI error to show on screen. Appends the service's explanation and also logs it. */
function providerError(site, status, detail) {
    const t = site.createTranslator(providerMessages);
    const message = serviceMessage(detail);
    console.error("AI provider error:", status, message);
    const withDetail = (text) => (message ? `${text} — ${message}` : text);
    if (status === 401 || status === 403)
        return new AiError("ai_unavailable", withDetail(t("service.key")));
    if (status === 402)
        return new AiError("ai_unavailable", withDetail(t("service.credit")));
    if (status === 404)
        return new AiError("ai_failed", withDetail(t("service.address")));
    if (status === 429)
        return new AiError("ai_rate_limited", withDetail(t("service.rateLimited")));
    return new AiError("ai_failed", withDetail(t("service.problem")));
}
const isAbort = (error) => error instanceof Error && error.name === "AbortError";
/**
 * How the answer is received. Support differs per model and service, so each is tried in order from the first.
 * - `schema`: a fixed JSON shape (json_schema)
 * - `json`: JSON mode (json_object). The shape is given by an example in the instructions
 * - `text`: receive plain text and extract only the JSON part
 */
const OUTPUT_MODES = ["schema", "json", "text"];
/**
 * Whether the error warrants retrying with the next mode. Either the request format was rejected (400, 422), nowhere supports that format (404, OpenRouter),
 * or the answer broke the shape. Key, credit and rate-limit errors are the same on retry, so they are reported right away.
 */
const shouldTryNext = (error) => APICallError.isInstance(error)
    ? [400, 404, 422].includes(error.statusCode ?? 0)
    : !isAbort(error) && !isTruncated(error);
/** An error the SDK wrapped after retrying is unwrapped to the last error (so a service error is not mistaken for a format error). */
const unwrap = (error) => (RetryError.isInstance(error) ? unwrap(error.lastError) : error);
/** The answer was cut off by hitting the output limit. Retrying in another mode gives the same result, so it is reported right away. */
class TruncatedAnswerError extends Error {
}
const isTruncated = (error) => error instanceof TruncatedAnswerError ||
    (NoObjectGeneratedError.isInstance(error) && error.finishReason === "length");
/** Short failure reason to log. The model's answer and the text sent are not logged. */
function failureNote(error) {
    if (APICallError.isInstance(error))
        return `${error.statusCode} ${serviceMessage(error.responseBody ?? error.message)}`;
    if (NoObjectGeneratedError.isInstance(error)) {
        return `no object (finish=${error.finishReason}, text=${error.text?.length ?? 0} chars)`;
    }
    return error instanceof Error ? error.message : String(error);
}
/** Extracts a JSON object from text (ignoring code fences and surrounding words). */
function extractJson(text) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start)
        throw new Error("No JSON object in the answer");
    return JSON.parse(text.slice(start, end + 1));
}
export function createGenerator(site, config) {
    const t = site.createTranslator(providerMessages);
    const create = (supportsStructuredOutputs) => createOpenAICompatible({
        name: "cms-ai",
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
        supportsStructuredOutputs,
    });
    const strict = create(true);
    const loose = create(false);
    const call = async (request, mode) => {
        const base = {
            model: (mode === "schema" ? strict : loose)(config.model),
            system: request.system,
            messages: [
                {
                    role: "user",
                    content: request.content.map((block) => block.type === "text"
                        ? { type: "text", text: block.text }
                        : { type: "image", image: block.data, mediaType: block.mediaType }),
                },
            ],
            maxOutputTokens: request.maxTokens,
            maxRetries: 1,
            abortSignal: request.signal,
        };
        if (mode !== "text") {
            const { output } = await generateText({ ...base, output: Output.object({ schema: request.schema }) });
            return output;
        }
        const { text, finishReason } = await generateText(base);
        if (finishReason === "length")
            throw new TruncatedAnswerError();
        return request.schema.parse(extractJson(text));
    };
    return {
        name: "openai-compatible",
        model: config.model,
        async *stream(request) {
            const result = streamText({
                model: loose(config.model),
                system: request.system,
                messages: [
                    {
                        role: "user",
                        content: request.content.map((block) => block.type === "text"
                            ? { type: "text", text: block.text }
                            : { type: "image", image: block.data, mediaType: block.mediaType }),
                    },
                ],
                maxOutputTokens: request.maxTokens,
                maxRetries: 1,
                abortSignal: request.signal,
            });
            for await (const part of result.fullStream) {
                if (part.type === "text-delta")
                    yield part.text;
                else if (part.type === "error") {
                    const error = unwrap(part.error);
                    if (isAbort(error))
                        throw error;
                    console.warn(`[@monti-cms/ai] ${config.model} stream failed: ${failureNote(error)}`);
                    if (APICallError.isInstance(error)) {
                        throw providerError(site, error.statusCode, error.responseBody ?? error.message);
                    }
                    throw new AiError("ai_failed", t("streamCut"));
                }
                else if (part.type === "finish" && part.finishReason === "length") {
                    throw new AiError("ai_failed", t("tooLong"));
                }
            }
        },
        async generate(request) {
            let lastError;
            for (const mode of OUTPUT_MODES) {
                try {
                    return await call(request, mode);
                }
                catch (caught) {
                    const error = unwrap(caught);
                    lastError = error;
                    if (isAbort(error))
                        throw error;
                    console.warn(`[@monti-cms/ai] ${config.model} ${mode} failed: ${failureNote(error)}`);
                    if (!shouldTryNext(error))
                        break;
                }
            }
            if (APICallError.isInstance(lastError)) {
                throw providerError(site, lastError.statusCode, lastError.responseBody ?? lastError.message);
            }
            if (isTruncated(lastError)) {
                throw new AiError("ai_failed", t("tooLongModel"));
            }
            throw new AiError("ai_failed", t("unreadable"));
        },
    };
}
const decisionAnswerSchema = z.union([
    z.object({ type: z.literal("noul"), noul: z.number() }),
    z.object({ type: z.literal("choice"), choice: z.string(), probabilities: z.record(z.string(), z.number()) }),
]);
export function createDecider(site, config) {
    const t = site.createTranslator(providerMessages);
    return {
        name: "decisions",
        model: config.model,
        async decide(request) {
            let response;
            try {
                response = await fetch(config.url, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ model: config.model, state: request.state, questions: request.questions }),
                    signal: request.signal,
                });
            }
            catch (error) {
                if (isAbort(error))
                    throw error;
                throw new AiError("ai_failed", t("deciderUnreachable"));
            }
            const text = await response.text();
            if (!response.ok)
                throw providerError(site, response.status, text);
            const parsed = z.object({ answers: z.record(z.string(), decisionAnswerSchema) }).safeParse((() => {
                try {
                    return JSON.parse(text);
                }
                catch {
                    return null;
                }
            })());
            if (!parsed.success) {
                console.error("Decision response has an unexpected shape:", text.slice(0, 500));
                throw new AiError("ai_failed", t("deciderShape"));
            }
            return parsed.data.answers;
        },
    };
}
/** Model list of an OpenAI-style URL (`GET {baseUrl}/models`). Empty array for services that do not provide a list. */
export async function listModels(site, baseUrl, apiKey, signal) {
    const t = site.createTranslator(providerMessages);
    let response;
    try {
        response = await fetch(`${baseUrl.replace(/\/+$/, "")}/models`, {
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            signal,
        });
    }
    catch (error) {
        if (isAbort(error))
            throw error;
        throw new AiError("ai_failed", t("unreachable"));
    }
    if (response.status === 404)
        return [];
    if (!response.ok)
        throw providerError(site, response.status, await response.text());
    const body = (await response.json().catch(() => null));
    const items = Array.isArray(body?.data) ? body.data : [];
    return items
        .flatMap((item) => {
        const record = item;
        return typeof record.id === "string"
            ? [{ id: record.id, ...(typeof record.name === "string" ? { name: record.name } : {}) }]
            : [];
    })
        .sort((a, b) => a.id.localeCompare(b.id));
}
/** Extracts English words from the material (fake connection only). */
const words = (text) => (text.match(/[A-Za-z][A-Za-z0-9]+/g) ?? []).map((word) => word.toLowerCase());
/** First material of the matching kind. */
const firstOf = (hint, kinds) => Object.values(hint.inputs).find((input) => kinds.includes(input.kind) && input.value.trim())?.value;
/** All text material (text, MDX, current value) joined together. */
const allText = (hint) => Object.values(hint.inputs)
    .filter((input) => input.kind === "text" || input.kind === "mdx" || input.kind === "value")
    .map((input) => input.value)
    .join(" ");
/** MDX that starts with letters (a paragraph). Prefixing a marker does not change the block shape. */
const startsWithWords = (mdx) => /^[\p{L}\p{N}]/u.test(mdx.trim());
/**
 * Fake text/MDX answer. Uses the action's own answer (`fake`) if it has one, otherwise builds it from the result shape and material kinds.
 * - If there is MDX material, that MDX (so even actions that must preserve the skeleton, like translation, pass validation). Streaming prefixes a marker to
 *   paragraphs so the changed parts are visible.
 * - Otherwise, a draft built from the first text material.
 */
function fakeText(result, hint, streaming) {
    if (hint.answer)
        return hint.answer();
    const title = firstOf(hint, ["text"])?.trim().slice(0, 60);
    if (result === "note")
        return "(fake) note";
    if (result === "text")
        return `(fake) ${(title || firstOf(hint, ["mdx", "value"]) || "text").slice(0, 60)}`;
    const source = firstOf(hint, ["mdx"]);
    if (source !== undefined)
        return streaming && startsWithWords(source) ? `(fake) ${source}` : source;
    const heading = title || "New post";
    return `## ${heading}\n\n(fake) First paragraph about ${heading}. It fills in little by little while streaming.\n\n(fake) Second paragraph.`;
}
/** Fake candidates. Chosen in this order: the action's own answer (one per line), options, a regex found in the code, a word bundle made from text. */
function fakeCandidates(hint) {
    if (hint.answer) {
        return hint
            .answer()
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
    }
    if (hint.choices && hint.choices.length > 0)
        return hint.choices.slice(0, 3);
    const code = firstOf(hint, ["code"]);
    if (code !== undefined) {
        const firstWord = words(code)[0];
        return firstWord ? [firstWord, "\\d+"] : ["\\S+"];
    }
    const source = words(allText(hint));
    const base = source.length > 0 ? source.slice(0, 3).join("-") : "sample";
    return [base, `${base}-guide`, slugify(`fake ${base}`)];
}
/** Generation model that gives a fixed answer without a key. The same input always gives the same answer. */
export function createFakeGenerator() {
    return {
        name: "fake",
        model: "fake-generator",
        async *stream(request) {
            // Pause briefly per word so the gradual display can be checked.
            for (const piece of fakeText(request.result, request.fake, true).split(/(?<=\s)/)) {
                if (request.signal?.aborted)
                    throw new DOMException("Aborted", "AbortError");
                await new Promise((resolve) => setTimeout(resolve, 40));
                yield piece;
            }
        },
        async generate(request) {
            const { result, fake } = request;
            if (result === "candidates")
                return { candidates: fakeCandidates(fake) };
            return { [result]: fakeText(result, fake, false) };
        },
    };
}
/** Decision model that gives fixed probabilities without a key. The earlier the option, the higher the probability. */
export function createFakeDecider() {
    return {
        name: "fake",
        model: "fake-decider",
        async decide(request) {
            const answers = {};
            Object.entries(request.questions).forEach(([key, question], index) => {
                if (question.type === "noul") {
                    answers[key] = { type: "noul", noul: Math.max(0.05, 0.95 - index * 0.2) };
                }
                else {
                    const options = Object.keys(question.criteria);
                    answers[key] = {
                        type: "choice",
                        choice: options[0] ?? "",
                        probabilities: Object.fromEntries(options.map((option, i) => [option, i === 0 ? 0.8 : 0.2 / options.length])),
                    };
                }
            });
            return answers;
        },
    };
}
