import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createTranslator, slugify } from "@monti-cms/core/client";
import { APICallError, generateText, NoObjectGeneratedError, Output, RetryError, streamText } from "ai";
import { z } from "zod";
import type { AiInputKind } from "./action";
import type { AiModelInfo } from "./connection";
import type { AiResult } from "./definition";
import { AiError } from "./errors";
import { providerMessages } from "./provider.messages";

const t = createTranslator(providerMessages);

/**
 * AI 서비스 포트. 연결(주소·키)과 모델 하나로 만든다. 연결은 AI 화면 설정(`settings.ts`)에서 받는다.
 *
 * - 생성: OpenAI와 같은 방식의 주소를 Vercel AI SDK로 부른다. 정해 둔 JSON 모양으로 답을 받는다.
 * - 판단: System One 주소(TypeSafe `/v1/systemone`, OpenRouter Decisions API)로 선택지마다 확률을 받는다.
 * - 가짜: `CMS_AI_FAKE=1`(개발 전용)이면 키 없이 정해진 답을 준다.
 */

export type AiContent =
	| { type: "text"; text: string }
	| { type: "image"; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string };

/** 가짜 연결(개발 전용)이 답을 만들 재료. 실제 연결은 읽지 않는다. */
export interface AiFakeHint {
	/** 보낸 자료(입력 이름 → 종류·글). */
	readonly inputs: Readonly<Record<string, { readonly kind: AiInputKind; readonly value: string }>>;
	/** 고를 수 있는 값(선택지가 있는 후보). */
	readonly choices?: readonly string[];
	/** 기능이 정한 가짜 답(`AiActionDefinition.fake`). */
	readonly answer?: () => string;
}

export interface AiRequest<T> {
	system: string;
	content: AiContent[];
	schema: z.ZodType<T>;
	maxTokens: number;
	/** 결과 모양. 가짜 연결이 답 모양을 정할 때 쓴다. */
	result: AiResult;
	fake: AiFakeHint;
	signal?: AbortSignal;
}

/** 흘려받기 요청(M8-1). 글(MDX·긴 글) 결과만 흘려받는다. 답은 JSON이 아닌 일반 글이다. */
export type AiStreamRequest = Omit<AiRequest<unknown>, "schema">;

export interface AiProvider {
	readonly name: "openai-compatible" | "fake";
	readonly model: string;
	generate<T>(request: AiRequest<T>): Promise<T>;
	/** 답을 조각으로 흘려준다. 다 받으면 끝난다. */
	stream(request: AiStreamRequest): AsyncIterable<string>;
}

export type DecisionQuestion =
	| { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
	| { type: "choice"; instructions: string; criteria: Record<string, string> };

export type DecisionAnswer =
	| { type: "noul"; noul: number }
	| { type: "choice"; choice: string; probabilities: Record<string, number> };

export interface DecisionRequest {
	state: Record<string, string>;
	questions: Record<string, DecisionQuestion>;
	signal?: AbortSignal;
}

export interface AiDecider {
	readonly name: "decisions" | "fake";
	readonly model: string;
	decide(request: DecisionRequest): Promise<Record<string, DecisionAnswer>>;
}

export const isFakeAi = () => process.env.CMS_AI_FAKE === "1" && process.env.NODE_ENV !== "production";

/** 서비스가 오류 본문에 담아 보낸 설명(`{"error": {"message": …}}` 등). 없으면 빈 글자. */
function serviceMessage(detail: string): string {
	let message = detail;
	try {
		const body = JSON.parse(detail) as { error?: { message?: unknown } | string; message?: unknown };
		const candidate = typeof body.error === "string" ? body.error : (body.error?.message ?? body.message);
		if (typeof candidate === "string") message = candidate;
	} catch {
		// JSON이 아니면 본문 그대로 쓴다.
	}
	return message.replace(/\s+/g, " ").trim().slice(0, 200);
}

/** 서비스 오류를 화면에 보여 줄 AI 오류로 바꾼다. 서비스가 보낸 설명을 뒤에 붙이고 로그에도 남긴다. */
function providerError(status: number | undefined, detail: string): AiError {
	const message = serviceMessage(detail);
	console.error("AI provider error:", status, message);
	const withDetail = (text: string) => (message ? `${text} — ${message}` : text);
	if (status === 401 || status === 403) return new AiError("ai_unavailable", withDetail(t("service.key")));
	if (status === 402) return new AiError("ai_unavailable", withDetail(t("service.credit")));
	if (status === 404) return new AiError("ai_failed", withDetail(t("service.address")));
	if (status === 429) return new AiError("ai_rate_limited", withDetail(t("service.rateLimited")));
	return new AiError("ai_failed", withDetail(t("service.problem")));
}

const isAbort = (error: unknown) => error instanceof Error && error.name === "AbortError";

/**
 * 답을 받는 방식. 모델·서비스마다 지원이 달라 앞에서부터 차례로 시도한다.
 * - `schema`: 정해진 JSON 모양(json_schema)
 * - `json`: JSON 모드(json_object). 모양은 지시문의 예시로 알려 준다
 * - `text`: 일반 글로 받아 JSON 부분만 뽑는다
 */
const OUTPUT_MODES = ["schema", "json", "text"] as const;
type OutputMode = (typeof OUTPUT_MODES)[number];

/**
 * 다음 방식으로 다시 시도할 오류인가. 요청 형식을 거절했거나(400·422), 그 형식을 지원하는 곳이 없거나(404, OpenRouter),
 * 답이 모양을 어긴 경우다. 키·크레딧·요청 수 오류는 다시 시도해도 같으므로 바로 알린다.
 */
const shouldTryNext = (error: unknown) =>
	APICallError.isInstance(error)
		? [400, 404, 422].includes(error.statusCode ?? 0)
		: !isAbort(error) && !isTruncated(error);

/** SDK가 다시 시도한 끝에 감싼 오류는 마지막 오류로 푼다(서비스 오류를 형식 오류로 잘못 보지 않게). */
const unwrap = (error: unknown): unknown => (RetryError.isInstance(error) ? unwrap(error.lastError) : error);

/** 출력 한도에 닿아 답이 끊겼다. 다른 방식으로 다시 받아도 같으므로 바로 알린다. */
class TruncatedAnswerError extends Error {}
const isTruncated = (error: unknown) =>
	error instanceof TruncatedAnswerError ||
	(NoObjectGeneratedError.isInstance(error) && error.finishReason === "length");

/** 로그에 남길 짧은 실패 이유. 모델 답·보낸 글은 남기지 않는다. */
function failureNote(error: unknown): string {
	if (APICallError.isInstance(error))
		return `${error.statusCode} ${serviceMessage(error.responseBody ?? error.message)}`;
	if (NoObjectGeneratedError.isInstance(error)) {
		return `no object (finish=${error.finishReason}, text=${error.text?.length ?? 0} chars)`;
	}
	return error instanceof Error ? error.message : String(error);
}

/** 글에서 JSON 객체를 뽑는다(코드 펜스·앞뒤 말 무시). */
function extractJson(text: string): unknown {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end <= start) throw new Error("No JSON object in the answer");
	return JSON.parse(text.slice(start, end + 1));
}

export function createGenerator(config: { baseUrl: string; apiKey: string; model: string }): AiProvider {
	const create = (supportsStructuredOutputs: boolean) =>
		createOpenAICompatible({
			name: "cms-ai",
			baseURL: config.baseUrl,
			apiKey: config.apiKey,
			supportsStructuredOutputs,
		});
	const strict = create(true);
	const loose = create(false);

	const call = async <T>(request: AiRequest<T>, mode: OutputMode): Promise<T> => {
		const base = {
			model: (mode === "schema" ? strict : loose)(config.model),
			system: request.system,
			messages: [
				{
					role: "user" as const,
					content: request.content.map((block) =>
						block.type === "text"
							? { type: "text" as const, text: block.text }
							: { type: "image" as const, image: block.data, mediaType: block.mediaType },
					),
				},
			],
			maxOutputTokens: request.maxTokens,
			maxRetries: 1,
			abortSignal: request.signal,
		};
		if (mode !== "text") {
			const { output } = await generateText({ ...base, output: Output.object({ schema: request.schema }) });
			return output as T;
		}
		const { text, finishReason } = await generateText(base);
		if (finishReason === "length") throw new TruncatedAnswerError();
		return request.schema.parse(extractJson(text));
	};

	return {
		name: "openai-compatible",
		model: config.model,
		async *stream(request: AiStreamRequest): AsyncIterable<string> {
			const result = streamText({
				model: loose(config.model),
				system: request.system,
				messages: [
					{
						role: "user" as const,
						content: request.content.map((block) =>
							block.type === "text"
								? { type: "text" as const, text: block.text }
								: { type: "image" as const, image: block.data, mediaType: block.mediaType },
						),
					},
				],
				maxOutputTokens: request.maxTokens,
				maxRetries: 1,
				abortSignal: request.signal,
			});
			for await (const part of result.fullStream) {
				if (part.type === "text-delta") yield part.text;
				else if (part.type === "error") {
					const error = unwrap(part.error);
					if (isAbort(error)) throw error;
					console.warn(`[@monti-cms/ai] ${config.model} stream failed: ${failureNote(error)}`);
					if (APICallError.isInstance(error)) {
						throw providerError(error.statusCode, error.responseBody ?? error.message);
					}
					throw new AiError("ai_failed", t("streamCut"));
				} else if (part.type === "finish" && part.finishReason === "length") {
					throw new AiError("ai_failed", t("tooLong"));
				}
			}
		},
		async generate<T>(request: AiRequest<T>): Promise<T> {
			let lastError: unknown;
			for (const mode of OUTPUT_MODES) {
				try {
					return await call(request, mode);
				} catch (caught) {
					const error = unwrap(caught);
					lastError = error;
					if (isAbort(error)) throw error;
					console.warn(`[@monti-cms/ai] ${config.model} ${mode} failed: ${failureNote(error)}`);
					if (!shouldTryNext(error)) break;
				}
			}
			if (APICallError.isInstance(lastError)) {
				throw providerError(lastError.statusCode, lastError.responseBody ?? lastError.message);
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

export function createDecider(config: { url: string; apiKey: string; model: string }): AiDecider {
	return {
		name: "decisions",
		model: config.model,
		async decide(request) {
			let response: Response;
			try {
				response = await fetch(config.url, {
					method: "POST",
					headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
					body: JSON.stringify({ model: config.model, state: request.state, questions: request.questions }),
					signal: request.signal,
				});
			} catch (error) {
				if (isAbort(error)) throw error;
				throw new AiError("ai_failed", t("deciderUnreachable"));
			}
			const text = await response.text();
			if (!response.ok) throw providerError(response.status, text);
			const parsed = z.object({ answers: z.record(z.string(), decisionAnswerSchema) }).safeParse(
				(() => {
					try {
						return JSON.parse(text);
					} catch {
						return null;
					}
				})(),
			);
			if (!parsed.success) {
				console.error("Decision response has an unexpected shape:", text.slice(0, 500));
				throw new AiError("ai_failed", t("deciderShape"));
			}
			return parsed.data.answers;
		},
	};
}

/** OpenAI 방식 주소의 모델 목록(`GET {baseUrl}/models`). 목록을 주지 않는 서비스면 빈 배열. */
export async function listModels(baseUrl: string, apiKey: string | null, signal?: AbortSignal): Promise<AiModelInfo[]> {
	let response: Response;
	try {
		response = await fetch(`${baseUrl.replace(/\/+$/, "")}/models`, {
			headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
			signal,
		});
	} catch (error) {
		if (isAbort(error)) throw error;
		throw new AiError("ai_failed", t("unreachable"));
	}
	if (response.status === 404) return [];
	if (!response.ok) throw providerError(response.status, await response.text());
	const body = (await response.json().catch(() => null)) as { data?: unknown } | null;
	const items = Array.isArray(body?.data) ? body.data : [];
	return items
		.flatMap((item) => {
			const record = item as { id?: unknown; name?: unknown };
			return typeof record.id === "string"
				? [{ id: record.id, ...(typeof record.name === "string" ? { name: record.name } : {}) }]
				: [];
		})
		.sort((a, b) => a.id.localeCompare(b.id));
}

/** 자료에서 영어 낱말을 뽑는다(가짜 연결 전용). */
const words = (text: string) => (text.match(/[A-Za-z][A-Za-z0-9]+/g) ?? []).map((word) => word.toLowerCase());

/** 종류가 맞는 첫 자료. */
const firstOf = (hint: AiFakeHint, kinds: readonly AiInputKind[]) =>
	Object.values(hint.inputs).find((input) => kinds.includes(input.kind) && input.value.trim())?.value;

/** 글 자료(글·MDX·현재 값)를 모두 이은 것. */
const allText = (hint: AiFakeHint) =>
	Object.values(hint.inputs)
		.filter((input) => input.kind === "text" || input.kind === "mdx" || input.kind === "value")
		.map((input) => input.value)
		.join(" ");

/** 글자로 시작하는 MDX(문단). 앞에 표시를 붙여도 블록 모양이 바뀌지 않는다. */
const startsWithWords = (mdx: string) => /^[\p{L}\p{N}]/u.test(mdx.trim());

/**
 * 가짜 글·MDX 답. 기능이 정한 답(`fake`)이 있으면 그것을, 없으면 결과 모양과 자료 종류로 만든다.
 * - MDX 자료가 있으면 그 MDX(번역처럼 뼈대를 지켜야 하는 기능도 검사를 통과한다). 흘려받기는 바뀐 곳이 보이게
 *   문단 앞에 표시를 붙인다.
 * - 없으면 첫 글 자료로 만든 초안.
 */
function fakeText(result: AiResult, hint: AiFakeHint, streaming: boolean): string {
	if (hint.answer) return hint.answer();
	const title = firstOf(hint, ["text"])?.trim().slice(0, 60);
	if (result === "note") return "(fake) note";
	if (result === "text") return `(fake) ${(title || firstOf(hint, ["mdx", "value"]) || "text").slice(0, 60)}`;
	const source = firstOf(hint, ["mdx"]);
	if (source !== undefined) return streaming && startsWithWords(source) ? `(fake) ${source}` : source;
	const heading = title || "New post";
	return `## ${heading}\n\n(fake) First paragraph about ${heading}. It fills in little by little while streaming.\n\n(fake) Second paragraph.`;
}

/** 가짜 후보. 기능이 정한 답(줄마다 하나), 선택지, 코드에서 찾을 정규식, 글로 만든 낱말 묶음 순으로 고른다. */
function fakeCandidates(hint: AiFakeHint): string[] {
	if (hint.answer) {
		return hint
			.answer()
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
	}
	if (hint.choices && hint.choices.length > 0) return hint.choices.slice(0, 3);
	const code = firstOf(hint, ["code"]);
	if (code !== undefined) {
		const firstWord = words(code)[0];
		return firstWord ? [firstWord, "\\d+"] : ["\\S+"];
	}
	const source = words(allText(hint));
	const base = source.length > 0 ? source.slice(0, 3).join("-") : "sample";
	return [base, `${base}-guide`, slugify(`fake ${base}`)];
}

/** 키 없이 정해진 답을 주는 생성 모델. 같은 입력이면 늘 같은 답이다. */
export function createFakeGenerator(): AiProvider {
	return {
		name: "fake",
		model: "fake-generator",
		async *stream(request: AiStreamRequest): AsyncIterable<string> {
			// 조금씩 보이는지 확인할 수 있게 낱말마다 조금 쉰다.
			for (const piece of fakeText(request.result, request.fake, true).split(/(?<=\s)/)) {
				if (request.signal?.aborted) throw new DOMException("Aborted", "AbortError");
				await new Promise((resolve) => setTimeout(resolve, 40));
				yield piece;
			}
		},
		async generate<T>(request: AiRequest<T>): Promise<T> {
			const { result, fake } = request;
			if (result === "candidates") return { candidates: fakeCandidates(fake) } as T;
			return { [result]: fakeText(result, fake, false) } as T;
		},
	};
}

/** 키 없이 정해진 확률을 주는 판단 모델. 앞의 선택지일수록 확률이 높다. */
export function createFakeDecider(): AiDecider {
	return {
		name: "fake",
		model: "fake-decider",
		async decide(request) {
			const answers: Record<string, DecisionAnswer> = {};
			Object.entries(request.questions).forEach(([key, question], index) => {
				if (question.type === "noul") {
					answers[key] = { type: "noul", noul: Math.max(0.05, 0.95 - index * 0.2) };
				} else {
					const options = Object.keys(question.criteria);
					answers[key] = {
						type: "choice",
						choice: options[0] ?? "",
						probabilities: Object.fromEntries(
							options.map((option, i) => [option, i === 0 ? 0.8 : 0.2 / options.length]),
						),
					};
				}
			});
			return answers;
		},
	};
}
